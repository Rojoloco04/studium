"""
Gemini study plan generation service.

Takes upcoming assignments + existing calendar events + user preferences,
calls Gemini with a structured prompt, and returns a list of ProposedBlock
objects. No side effects — caller decides what to do with the result.
"""
import json
import logging
from datetime import datetime, timezone, timedelta

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

    assignments_json = json.dumps(assignments, default=str, indent=2)
    events_json = json.dumps(calendar_events, default=str, indent=2)

    prompt = f"""You are a study scheduler. Given the upcoming assignments and existing calendar events below, generate a realistic study schedule.

ASSIGNMENTS (not yet submitted, due within {prefs.days_ahead} days):
{assignments_json}

EXISTING CALENDAR EVENTS (do NOT schedule overlapping these):
{events_json}

Rules:
- Plan covers {today.date().isoformat()} through {plan_end.date().isoformat()}.
- Schedule sessions only between {prefs.day_start_hour:02d}:00 and {prefs.day_end_hour:02d}:00 UTC.
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
- start_at (ISO 8601 datetime string with UTC offset, e.g. "2026-04-15T09:00:00+00:00")
- end_at (ISO 8601 datetime string with UTC offset)
- duration_minutes (integer)

Example:
[{{"assignment_id": "abc123", "title": "Study: Midterm Essay", "description": "Outline and draft introduction", "start_at": "2026-04-15T09:00:00+00:00", "end_at": "2026-04-15T11:00:00+00:00", "duration_minutes": 120}}]
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
