from fastapi import Header, HTTPException, status
from app.core.supabase import get_supabase


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Extracts and verifies the Supabase JWT from the Authorization header.
    Returns the user's UUID.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth header")

    token = authorization.removeprefix("Bearer ")
    db = get_supabase()

    try:
        user = db.auth.get_user(token)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
