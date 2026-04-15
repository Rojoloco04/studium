"""
Google Calendar integration service.

Handles the full OAuth 2.0 flow (build auth URL → exchange code → refresh),
token encryption/storage in Supabase, and Google Calendar API calls
(read events, create events, delete events).

State encoding for OAuth: we embed the user_id in the OAuth `state` parameter
by Fernet-encrypting a JSON payload {user_id, ts}. This lets the backend
callback identify the user without requiring an active session.
"""
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import get_settings
from app.core.encryption import encrypt_token, decrypt_token
from app.core.supabase import get_supabase
from app.models.schemas import ProposedBlock

SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]

_STATE_MAX_AGE = 600  # seconds (10 min)


def _get_flow() -> Flow:
    settings = get_settings()
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.google_redirect_uri],
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


# ── State encoding (stateless; user_id embedded via Fernet) ──────────────────

def encode_oauth_state(user_id: str, code_verifier: Optional[str] = None) -> str:
    """Return a Fernet-encrypted state token encoding user_id + timestamp (+ optional code_verifier)."""
    from cryptography.fernet import Fernet
    key = get_settings().canvas_token_encryption_key
    f = Fernet(key.encode() if isinstance(key, str) else key)
    payload: dict = {"user_id": user_id, "ts": time.time()}
    if code_verifier:
        payload["code_verifier"] = code_verifier
    return f.encrypt(json.dumps(payload).encode()).decode()


def decode_oauth_state(state: str) -> tuple[str, Optional[str]]:
    """Decode state → (user_id, code_verifier). Raises ValueError if expired or tampered."""
    from cryptography.fernet import Fernet, InvalidToken
    key = get_settings().canvas_token_encryption_key
    f = Fernet(key.encode() if isinstance(key, str) else key)
    try:
        payload = json.loads(f.decrypt(state.encode()))
    except (InvalidToken, Exception) as exc:
        raise ValueError("Invalid OAuth state") from exc
    if time.time() - payload["ts"] > _STATE_MAX_AGE:
        raise ValueError("OAuth state expired")
    return payload["user_id"], payload.get("code_verifier")


# ── OAuth flow ────────────────────────────────────────────────────────────────

def build_auth_url(user_id: str) -> str:
    """Return the Google consent-page URL with user_id + PKCE code_verifier in state."""
    from urllib.parse import quote
    flow = _get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # always ask, ensures refresh_token is returned
        state="placeholder",
    )
    # google-auth-oauthlib 1.3+ auto-generates a code_verifier; it lives on flow.code_verifier
    real_state = encode_oauth_state(user_id, flow.code_verifier)
    auth_url = auth_url.replace("state=placeholder", f"state={quote(real_state, safe='')}")
    return auth_url


def exchange_code(code: str, code_verifier: Optional[str] = None) -> dict:
    """Exchange an auth code for tokens. Returns raw token dict."""
    import os
    # Google returns extra scopes (openid, profile, email); relax the scope check.
    os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
    flow = _get_flow()
    # Restore the code_verifier so fetch_token includes it in the token request.
    flow.code_verifier = code_verifier
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "expiry": creds.expiry,
    }


# ── Token storage ─────────────────────────────────────────────────────────────

def save_tokens(
    user_id: str,
    access_token: str,
    refresh_token: str,
    expiry: Optional[datetime],
    google_email: Optional[str],
) -> None:
    db = get_supabase()
    db.table("google_tokens").upsert(
        {
            "user_id": user_id,
            "encrypted_access_token": encrypt_token(access_token),
            "encrypted_refresh_token": encrypt_token(refresh_token),
            "token_expiry": expiry.isoformat() if expiry else None,
            "google_email": google_email,
        },
        on_conflict="user_id",
    ).execute()


def delete_tokens(user_id: str) -> None:
    db = get_supabase()
    db.table("google_tokens").delete().eq("user_id", user_id).execute()


def load_credentials(user_id: str) -> Credentials:
    """
    Load tokens from DB, build Credentials, refresh if expired, re-save if refreshed.
    Raises ValueError if not connected.
    """
    db = get_supabase()
    row = (
        db.table("google_tokens")
        .select("encrypted_access_token,encrypted_refresh_token,token_expiry")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not row or not row.data:
        raise ValueError("Google Calendar not connected")

    access_token = decrypt_token(row.data[0]["encrypted_access_token"])
    refresh_token = decrypt_token(row.data[0]["encrypted_refresh_token"])
    expiry_str = row.data[0].get("token_expiry")
    if expiry_str:
        dt = datetime.fromisoformat(expiry_str)
        expiry = dt.replace(tzinfo=None) if dt.tzinfo else dt
    else:
        expiry = None

    settings = get_settings()
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
        expiry=expiry,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleAuthRequest())
        # Persist the refreshed access token
        save_tokens(
            user_id,
            creds.token,
            creds.refresh_token,
            creds.expiry,
            google_email=None,  # don't overwrite email on refresh
        )

    return creds


# ── Calendar API helpers ──────────────────────────────────────────────────────

def _calendar_service(creds: Credentials):
    return build("calendar", "v3", credentials=creds)


def get_upcoming_events(user_id: str, days: int = 14) -> list[dict]:
    """
    Return events from the user's primary calendar for the next `days` days.
    Each item: {title, start, end} as ISO strings.
    """
    creds = load_credentials(user_id)
    service = _calendar_service(creds)

    now = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=days)).isoformat()

    result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            maxResults=250,
        )
        .execute()
    )

    events = []
    for item in result.get("items", []):
        start = item["start"].get("dateTime") or item["start"].get("date")
        end = item["end"].get("dateTime") or item["end"].get("date")
        events.append({
            "id": item.get("id", ""),
            "title": item.get("summary", ""),
            "start": start,
            "end": end,
        })
    return events


def create_calendar_event(user_id: str, block: ProposedBlock) -> str:
    """Create a GCal event from a ProposedBlock. Returns the event ID."""
    creds = load_credentials(user_id)
    service = _calendar_service(creds)

    event_body = {
        "summary": block.title,
        "description": block.description or "",
        "start": {"dateTime": block.start_at.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": block.end_at.isoformat(), "timeZone": "UTC"},
        "colorId": "2",  # sage green — distinguishable from regular events
    }

    created = service.events().insert(calendarId="primary", body=event_body).execute()
    return created["id"]


def delete_calendar_event(user_id: str, gcal_event_id: str) -> None:
    """Delete a GCal event. Silently ignores 404 (already deleted)."""
    creds = load_credentials(user_id)
    service = _calendar_service(creds)
    try:
        service.events().delete(calendarId="primary", eventId=gcal_event_id).execute()
    except HttpError as e:
        if e.resp.status != 404:
            raise
