from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    gemini_api_key: str
    gemini_model: str = "gemini-3.1-flash-lite-preview"
    gemini_fallback_model: str = "gemini-2.5-flash"
    canvas_token_encryption_key: str
    allowed_origins: str = "http://localhost:3000"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/google-calendar/callback"
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
