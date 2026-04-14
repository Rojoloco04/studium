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
