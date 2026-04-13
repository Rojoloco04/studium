from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import CanvasConnectRequest, CanvasConnectResponse, SyncStatus
from app.services.canvas import connect_canvas, sync_user
from app.core.auth import get_current_user_id
from app.core.supabase import get_supabase

router = APIRouter(prefix="/api/canvas", tags=["canvas"])


@router.post("/connect", response_model=CanvasConnectResponse)
async def canvas_connect(
    body: CanvasConnectRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        result = await connect_canvas(user_id, body.domain, body.token)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync")
async def canvas_sync(user_id: str = Depends(get_current_user_id)):
    try:
        result = await sync_user(user_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=SyncStatus)
async def canvas_status(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    token_row = db.table("canvas_tokens").select("updated_at").eq("user_id", user_id).maybe_single().execute()
    courses = db.table("courses").select("id", count="exact").eq("user_id", user_id).execute()
    assignments = db.table("assignments").select("id", count="exact").eq("user_id", user_id).execute()

    return SyncStatus(
        connected=token_row.data is not None,
        last_synced=token_row.data["updated_at"] if token_row.data else None,
        courses_count=courses.count or 0,
        assignments_count=assignments.count or 0,
    )
