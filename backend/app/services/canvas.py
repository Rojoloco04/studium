import httpx
from typing import Any
from app.core.encryption import encrypt_token, decrypt_token
from app.core.supabase import get_supabase


CANVAS_TIMEOUT = 30.0


class CanvasService:
    def __init__(self, domain: str, token: str):
        self.domain = domain.rstrip("/")
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}"}

    async def validate_and_get_user(self) -> dict[str, Any]:
        """Hit /api/v1/users/self to validate the token and get user info."""
        async with httpx.AsyncClient(timeout=CANVAS_TIMEOUT) as client:
            res = await client.get(
                f"{self.domain}/api/v1/users/self",
                headers=self.headers,
            )
            res.raise_for_status()
            return res.json()

    async def get_courses(self) -> list[dict[str, Any]]:
        """Fetch active courses with enrollment state."""
        courses = []
        url = f"{self.domain}/api/v1/courses"
        params = {
            "enrollment_state": "active",
            "include[]": ["total_scores", "current_grading_period_scores", "term"],
            "per_page": 50,
        }
        async with httpx.AsyncClient(timeout=CANVAS_TIMEOUT) as client:
            while url:
                res = await client.get(url, headers=self.headers, params=params)
                res.raise_for_status()
                courses.extend(res.json())
                # Handle Canvas pagination via Link header
                link = res.headers.get("Link", "")
                url = _parse_next_link(link)
                params = {}  # only on first request
        return courses

    async def get_assignments(self, course_id: int) -> list[dict[str, Any]]:
        """Fetch assignments for a single course."""
        assignments = []
        url = f"{self.domain}/api/v1/courses/{course_id}/assignments"
        params = {
            "include[]": ["submission"],
            "per_page": 100,
            "order_by": "due_at",
        }
        async with httpx.AsyncClient(timeout=CANVAS_TIMEOUT) as client:
            while url:
                res = await client.get(url, headers=self.headers, params=params)
                res.raise_for_status()
                assignments.extend(res.json())
                link = res.headers.get("Link", "")
                url = _parse_next_link(link)
                params = {}
        return assignments


def _parse_next_link(link_header: str) -> str | None:
    """Parse the Canvas Link header to get the next page URL."""
    if not link_header:
        return None
    for part in link_header.split(","):
        url, *rels = part.strip().split(";")
        for rel in rels:
            if 'rel="next"' in rel:
                return url.strip().strip("<>")
    return None


async def connect_canvas(user_id: str, domain: str, token: str) -> dict:
    """
    Validate token, store encrypted, and kick off initial sync.
    Returns canvas user name and number of courses synced.
    """
    service = CanvasService(domain, token)

    # Validate token
    canvas_user = await service.validate_and_get_user()

    # Encrypt and store token
    encrypted = encrypt_token(token)
    db = get_supabase()
    db.table("canvas_tokens").upsert({
        "user_id": user_id,
        "domain": domain,
        "encrypted_token": encrypted,
        "canvas_user_id": canvas_user["id"],
        "canvas_user_name": canvas_user["name"],
    }).execute()

    # Initial sync
    courses = await service.get_courses()
    synced = await _sync_courses(user_id, service, courses)

    return {
        "success": True,
        "user_name": canvas_user["name"],
        "courses_synced": synced,
    }


async def sync_user(user_id: str) -> dict:
    """Re-sync an existing connected user."""
    db = get_supabase()
    row = db.table("canvas_tokens").select("*").eq("user_id", user_id).single().execute()
    if not row.data:
        raise ValueError("Canvas not connected")

    token = decrypt_token(row.data["encrypted_token"])
    service = CanvasService(row.data["domain"], token)
    courses = await service.get_courses()
    synced = await _sync_courses(user_id, service, courses)
    return {"courses_synced": synced}


async def _sync_courses(user_id: str, service: CanvasService, raw_courses: list) -> int:
    """Upsert courses and their assignments into Supabase."""
    db = get_supabase()
    synced = 0

    for c in raw_courses:
        if c.get("access_restricted_by_date"):
            continue

        enrollment = next(
            (e for e in c.get("enrollments", []) if e.get("type") == "student"), {}
        )

        db.table("courses").upsert({
            "canvas_id": c["id"],
            "user_id": user_id,
            "name": c.get("name", "Untitled"),
            "course_code": c.get("course_code", ""),
            "term": c.get("term", {}).get("name"),
            "current_grade": enrollment.get("computed_current_grade"),
            "current_score": enrollment.get("computed_current_score"),
        }, on_conflict="canvas_id,user_id").execute()

        # Fetch and store assignments for this course
        assignments = await service.get_assignments(c["id"])
        course_row = db.table("courses").select("id").eq("canvas_id", c["id"]).eq("user_id", user_id).single().execute()
        if not course_row.data:
            continue

        course_uuid = course_row.data["id"]
        for a in assignments:
            submission = a.get("submission") or {}
            db.table("assignments").upsert({
                "canvas_id": a["id"],
                "course_id": course_uuid,
                "user_id": user_id,
                "name": a.get("name", "Untitled"),
                "due_at": a.get("due_at"),
                "points_possible": a.get("points_possible"),
                "submission_types": a.get("submission_types", []),
                "score": submission.get("score"),
                "submitted": submission.get("submitted_at") is not None,
            }, on_conflict="canvas_id,user_id").execute()

        synced += 1

    return synced
