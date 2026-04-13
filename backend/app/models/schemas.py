from pydantic import BaseModel, HttpUrl
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
    current_grade: Optional[float] = None
    current_score: Optional[float] = None
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
    created_at: datetime


# Sync status
class SyncStatus(BaseModel):
    last_synced: Optional[datetime]
    courses_count: int
    assignments_count: int
    connected: bool
