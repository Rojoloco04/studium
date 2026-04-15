import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

logger = logging.getLogger(__name__)

from app.core.auth import get_current_user_id
from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.models.schemas import (
    GCalAuthUrlResponse,
    GCalStatus,
    CalendarEventOut,
    PreviewPlanRequest,
    PreviewPlanResponse,
    ConfirmPlanRequest,
    ConfirmPlanResponse,
    StudyBlockOut,
)
from app.services.google_calendar import (
    build_auth_url,
    decode_oauth_state,
    exchange_code,
    save_tokens,
    delete_tokens,
    get_upcoming_events,
    create_calendar_event,
    delete_calendar_event,
)
from app.services.gemini import generate_study_plan

router = APIRouter(prefix="/api/google-calendar", tags=["google-calendar"])


# ── Auth URL ──────────────────────────────────────────────────────────────────

@router.get("/auth-url", response_model=GCalAuthUrlResponse)
async def get_auth_url(user_id: str = Depends(get_current_user_id)):
    url = build_auth_url(user_id)
    return GCalAuthUrlResponse(auth_url=url)


# ── OAuth callback (no JWT — user_id encoded in state) ───────────────────────

@router.get("/callback")
async def oauth_callback(code: str = "", state: str = "", error: str = ""):
    settings = get_settings()
    frontend_settings = settings.frontend_url

    if error or not code:
        logger.error("gcal callback: error=%s, code missing=%s", error, not code)
        return RedirectResponse(f"{frontend_settings}/dashboard/settings?gcal=error")

    try:
        user_id, code_verifier = decode_oauth_state(state)
    except ValueError as exc:
        logger.error("gcal callback: state decode failed: %s", exc)
        return RedirectResponse(f"{frontend_settings}/dashboard/settings?gcal=error")

    logger.info("gcal callback: user_id=%s, code_verifier present=%s, exchanging code...", user_id, bool(code_verifier))

    try:
        tokens = exchange_code(code, code_verifier=code_verifier)
    except Exception as exc:
        logger.error("gcal callback: exchange_code failed: %s", exc)
        return RedirectResponse(f"{frontend_settings}/dashboard/settings?gcal=error")

    if not tokens.get("refresh_token"):
        logger.error("gcal callback: no refresh_token in response (tokens=%s)", {k: bool(v) for k, v in tokens.items()})
        return RedirectResponse(f"{frontend_settings}/dashboard/settings?gcal=error")

    logger.info("gcal callback: tokens obtained, refresh_token present=%s", bool(tokens.get("refresh_token")))

    # Fetch the user's Google email via userinfo
    google_email = None
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if resp.status_code == 200:
                google_email = resp.json().get("email")
    except Exception:
        pass

    try:
        save_tokens(
            user_id=user_id,
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            expiry=tokens.get("expiry"),
            google_email=google_email,
        )
        logger.info("gcal callback: tokens saved for user_id=%s, email=%s", user_id, google_email)
    except Exception as exc:
        logger.error("gcal callback: save_tokens failed: %s", exc, exc_info=True)
        return RedirectResponse(f"{frontend_settings}/dashboard/settings?gcal=error")

    return RedirectResponse(f"{frontend_settings}/dashboard/settings?gcal=connected")


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=GCalStatus)
async def gcal_status(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = (
        db.table("google_tokens")
        .select("google_email,token_expiry")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result or not result.data:
        return GCalStatus(connected=False)
    return GCalStatus(
        connected=True,
        google_email=result.data[0].get("google_email"),
        token_expiry=result.data[0].get("token_expiry"),
    )


# ── Disconnect ────────────────────────────────────────────────────────────────

@router.delete("/disconnect")
async def gcal_disconnect(user_id: str = Depends(get_current_user_id)):
    delete_tokens(user_id)
    return {"success": True}


# ── Preview plan (Gemini, no DB write) ───────────────────────────────────────

@router.post("/preview-plan", response_model=PreviewPlanResponse)
async def preview_plan(
    body: PreviewPlanRequest,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()

    # Check GCal connected
    gcal_row = (
        db.table("google_tokens").select("id").eq("user_id", user_id).limit(1).execute()
    )
    if not gcal_row or not gcal_row.data:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    prefs = body.prefs
    now = datetime.now(timezone.utc)
    due_cutoff = now + timedelta(days=prefs.days_ahead)

    # Fetch upcoming unsubmitted assignments with course info
    assignments_resp = (
        db.table("assignments")
        .select("id, name, due_at, points_possible, course_id, courses(name, course_code)")
        .eq("user_id", user_id)
        .eq("submitted", False)
        .not_.is_("due_at", "null")
        .lte("due_at", due_cutoff.isoformat())
        .gte("due_at", now.isoformat())
        .order("due_at")
        .execute()
    )

    assignments = []
    for a in (assignments_resp.data or []):
        course_info = a.get("courses") or {}
        assignments.append({
            "id": a["id"],
            "name": a["name"],
            "course": course_info.get("name", ""),
            "course_id": a["course_id"],
            "due_at": a["due_at"],
            "points_possible": a.get("points_possible"),
        })

    if not assignments:
        return PreviewPlanResponse(blocks=[])

    # Fetch existing calendar events
    try:
        calendar_events = get_upcoming_events(user_id, days=prefs.days_ahead)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read calendar: {e}")

    # Call Gemini
    try:
        blocks = await generate_study_plan(assignments, calendar_events, prefs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {e}")

    # Return existing events alongside proposed blocks so the frontend can
    # render both on the same calendar from a single cached response — no
    # second round-trip needed.
    cal_event_out = [
        CalendarEventOut(id=e.get("id", ""), title=e["title"], start=e["start"], end=e["end"])
        for e in calendar_events
    ]
    return PreviewPlanResponse(blocks=blocks, calendar_events=cal_event_out)


# ── Confirm plan (push to GCal + store in DB) ────────────────────────────────

@router.post("/confirm-plan", response_model=ConfirmPlanResponse)
async def confirm_plan(
    body: ConfirmPlanRequest,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    pushed = 0
    block_ids = []

    for block in body.blocks:
        gcal_event_id = None
        try:
            gcal_event_id = create_calendar_event(user_id, block)
        except Exception:
            pass  # create DB record even if GCal push fails

        row = {
            "user_id": user_id,
            "assignment_id": block.assignment_id,
            "course_id": block.course_id,
            "gcal_event_id": gcal_event_id,
            "title": block.title,
            "description": block.description,
            "start_at": block.start_at.isoformat(),
            "end_at": block.end_at.isoformat(),
            "duration_minutes": block.duration_minutes,
            "status": "scheduled",
        }
        result = db.table("study_blocks").insert(row).execute()
        if result.data:
            block_ids.append(result.data[0]["id"])
            pushed += 1

    return ConfirmPlanResponse(pushed=pushed, study_block_ids=block_ids)


# ── Calendar events (read-only, for UI display) ───────────────────────────────

@router.get("/events", response_model=list[CalendarEventOut])
async def list_calendar_events(
    days: int = 7,
    user_id: str = Depends(get_current_user_id),
):
    """
    Return upcoming Google Calendar events for the next `days` days.
    The frontend caches this via TanStack Query and reads locally — no
    repeated round-trips on re-render.
    """
    try:
        events = get_upcoming_events(user_id, days=min(days, 14))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read calendar: {e}")
    return [
        CalendarEventOut(id=e.get("id", ""), title=e["title"], start=e["start"], end=e["end"])
        for e in events
    ]


# ── Study blocks ──────────────────────────────────────────────────────────────

@router.get("/study-blocks", response_model=list[StudyBlockOut])
async def list_study_blocks(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = (
        db.table("study_blocks")
        .select("*")
        .eq("user_id", user_id)
        .order("start_at")
        .execute()
    )
    return result.data or []


@router.delete("/study-blocks/{block_id}")
async def delete_study_block(
    block_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    row = (
        db.table("study_blocks")
        .select("gcal_event_id")
        .eq("id", block_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not row or not row.data:
        raise HTTPException(status_code=404, detail="Study block not found")

    gcal_event_id = row.data[0].get("gcal_event_id")
    if gcal_event_id:
        try:
            delete_calendar_event(user_id, gcal_event_id)
        except Exception:
            pass  # don't block DB deletion if GCal call fails

    db.table("study_blocks").delete().eq("id", block_id).eq("user_id", user_id).execute()
    return {"success": True}
