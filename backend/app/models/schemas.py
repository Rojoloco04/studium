from pydantic import BaseModel, HttpUrl, Field, model_validator
from typing import Optional
from datetime import datetime


# Canvas
class CanvasConnectRequest(BaseModel):
    domain: str  # e.g. https://slu.instructure.com
    token: str


class CanvasConnectResponse(BaseModel):
    success: bool
    user_name: str
    courses_synced: int


# Course
class Course(BaseModel):
    id: str
    canvas_id: int
    user_id: str
    name: str
    course_code: str
    term: Optional[str] = None
    current_grade: Optional[str] = None
    current_score: Optional[float] = None
    hidden: bool = False
    created_at: datetime


# Assignment group (grade category with weight)
class AssignmentGroup(BaseModel):
    id: str
    canvas_id: int
    course_id: str
    user_id: str
    name: str
    group_weight: float = 0
    created_at: datetime


# Assignment
class Assignment(BaseModel):
    id: str
    canvas_id: int
    course_id: str
    user_id: str
    name: str
    due_at: Optional[datetime] = None
    points_possible: Optional[float] = None
    submission_types: list[str] = []
    score: Optional[float] = None
    submitted: bool = False
    assignment_group_id: Optional[str] = None
    created_at: datetime


# Sync status
class SyncStatus(BaseModel):
    connected: bool
    domain: Optional[str] = None
    canvas_user_name: Optional[str] = None
    last_synced: Optional[datetime] = None
    courses_count: int = 0
    assignments_count: int = 0


# ── Google Calendar ──────────────────────────────────────────────────────────

class GCalAuthUrlResponse(BaseModel):
    auth_url: str


class GCalStatus(BaseModel):
    connected: bool
    google_email: Optional[str] = None
    token_expiry: Optional[datetime] = None


# ── Study planning ───────────────────────────────────────────────────────────

class PlanningPrefs(BaseModel):
    days_ahead: int = Field(default=7, ge=1, le=14)
    day_start_hour: int = Field(default=8, ge=5, le=20)
    day_end_hour: int = Field(default=22, ge=8, le=23)
    max_session_minutes: int = Field(default=120, ge=30, le=180)
    # IANA timezone string detected from browser (e.g. "America/Chicago").
    # Must be sent by the frontend so Gemini schedules in local time, not UTC.
    timezone: str = Field(default="UTC", max_length=60)

    @model_validator(mode="after")
    def end_after_start(self):
        if self.day_end_hour <= self.day_start_hour:
            raise ValueError("day_end_hour must be after day_start_hour")
        return self


class ProposedBlock(BaseModel):
    assignment_id: Optional[str] = None
    course_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    start_at: datetime
    end_at: datetime
    duration_minutes: int


class CalendarEventOut(BaseModel):
    """A single Google Calendar event returned to the frontend for display."""
    id: str = ""
    title: str
    start: str  # ISO datetime string or YYYY-MM-DD for all-day events
    end: str


class PreviewPlanRequest(BaseModel):
    prefs: PlanningPrefs = Field(default_factory=PlanningPrefs)


class PreviewPlanResponse(BaseModel):
    blocks: list[ProposedBlock]
    # Existing calendar events are returned alongside proposed blocks so the
    # frontend can render both on the same visual calendar without a second
    # round-trip (cache the events in TanStack, read locally during preview).
    calendar_events: list[CalendarEventOut] = []


class ConfirmPlanRequest(BaseModel):
    blocks: list[ProposedBlock]


class ConfirmPlanResponse(BaseModel):
    pushed: int
    study_block_ids: list[str]


class StudyBlockOut(BaseModel):
    id: str
    assignment_id: Optional[str] = None
    course_id: Optional[str] = None
    gcal_event_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    start_at: datetime
    end_at: datetime
    duration_minutes: int
    status: str
