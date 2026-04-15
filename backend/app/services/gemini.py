"""
Gemini study plan generation service.

Takes upcoming assignments + existing calendar events + user preferences,
calls Gemini with a structured prompt, and returns a list of ProposedBlock
objects. No side effects — caller decides what to do with the result.
"""
import json
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from google import genai
from google.genai import types
from google.genai.errors import ServerError

from app.core.config import get_settings
from app.models.schemas import PlanningPrefs, ProposedBlock

logger = logging.getLogger(__name__)


async def generate_study_plan(
    assignments: list[dict],
    calendar_events: list[dict],
    prefs: PlanningPrefs,
) -> list[ProposedBlock]:
    """
    Call Gemini to generate study blocks.

    assignments: list of {id, name, course, due_at, points_possible}
    calendar_events: list of {title, start, end}
    prefs: user scheduling preferences

    Returns a list of ProposedBlock. May return [] if no assignments are upcoming.
    Raises on Gemini API errors or invalid JSON response.
    """
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)

    today = datetime.now(timezone.utc)
    plan_end = today + timedelta(days=prefs.days_ahead)

    # Resolve the user's local UTC offset so Gemini uses local hours, not UTC.
    # Without this, "8am–10pm" gets interpreted as UTC and Gemini schedules at
    # 3am local time for users in US time zones.
    try:
        tz = ZoneInfo(prefs.timezone)
        local_now = today.astimezone(tz)
        utc_offset_seconds = int(local_now.utcoffset().total_seconds())
        sign = "+" if utc_offset_seconds >= 0 else "-"
        abs_s = abs(utc_offset_seconds)
        tz_offset = f"{sign}{abs_s // 3600:02d}:{(abs_s % 3600) // 60:02d}"
        local_today = local_now.date().isoformat()
        local_plan_end = (local_now + timedelta(days=prefs.days_ahead)).date().isoformat()
    except (ZoneInfoNotFoundError, Exception):
        tz_offset = "+00:00"
        local_today = today.date().isoformat()
        local_plan_end = plan_end.date().isoformat()

    assignments_json = json.dumps(assignments, default=str, indent=2)
    events_json = json.dumps(calendar_events, default=str, indent=2)

    prompt = f"""You are a study scheduler. Given the upcoming assignments and existing calendar events below, generate a realistic study schedule.

ASSIGNMENTS (not yet submitted, due within {prefs.days_ahead} days):
{assignments_json}

EXISTING CALENDAR EVENTS (do NOT schedule overlapping these):
{events_json}

Rules:
- The user's timezone is {prefs.timezone} (UTC{tz_offset}).
- Plan covers {local_today} through {local_plan_end} in the user's local timezone.
- Schedule sessions only between {prefs.day_start_hour:02d}:00 and {prefs.day_end_hour:02d}:00 LOCAL TIME ({prefs.timezone}).
- Each session must be between 30 and {prefs.max_session_minutes} minutes.
- Do not overlap any existing calendar events (check start/end carefully).
- Each assignment gets 1-3 sessions depending on points_possible and days until due.
- Prioritise assignments due sooner. Do not schedule any session past the assignment due_at date.
- If an assignment has no due_at, skip it.
- Today (UTC) is {today.isoformat()}.

Return ONLY a valid JSON array with no markdown fences. Each element must have these exact keys:
- assignment_id (string, from the assignments list above)
- title (string, e.g. "Study: Assignment Name")
- description (string, brief note on what to focus on)
- start_at (ISO 8601 datetime string with the user's UTC offset {tz_offset}, e.g. "2026-04-15T09:00:00{tz_offset}")
- end_at (ISO 8601 datetime string with the user's UTC offset {tz_offset})
- duration_minutes (integer)

Example:
[{{"assignment_id": "abc123", "title": "Study: Midterm Essay", "description": "Outline and draft introduction", "start_at": "2026-04-15T09:00:00{tz_offset}", "end_at": "2026-04-15T11:00:00{tz_offset}", "duration_minutes": 120}}]
"""

    generate_config = types.GenerateContentConfig(response_mime_type="application/json")
    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=generate_config,
        )
    except ServerError as exc:
        if exc.code != 503:
            raise
        logger.warning(
            "Primary model %s unavailable (503), retrying with fallback %s",
            settings.gemini_model,
            settings.gemini_fallback_model,
        )
        response = await client.aio.models.generate_content(
            model=settings.gemini_fallback_model,
            contents=prompt,
            config=generate_config,
        )

    raw = response.text.strip()
    # Strip markdown fences if Gemini adds them despite instructions
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    blocks_raw: list[dict] = json.loads(raw)

    # Build assignment_id → course_id lookup from the input list
    assignment_course_map = {a["id"]: a.get("course_id") for a in assignments}

    result: list[ProposedBlock] = []
    for b in blocks_raw:
        try:
            assignment_id = b.get("assignment_id")
            result.append(
                ProposedBlock(
                    assignment_id=assignment_id,
                    course_id=assignment_course_map.get(assignment_id),
                    title=b["title"],
                    description=b.get("description"),
                    start_at=datetime.fromisoformat(b["start_at"]),
                    end_at=datetime.fromisoformat(b["end_at"]),
                    duration_minutes=int(b["duration_minutes"]),
                )
            )
        except (KeyError, ValueError):
            # Skip malformed blocks rather than failing the whole response
            continue

    return result
