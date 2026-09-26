from pathlib import Path
from functools import lru_cache
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    app_name: str = "King AI Workspace"
    environment: str = "development"
    database_url: str = f"sqlite:///{(ROOT / 'storage' / 'workspace.db').as_posix()}"
    jwt_secret: str = Field(min_length=32)
    access_minutes: int = 15
    workspace_hours: int = 8
    refresh_days: int = 30
    frontend_url: str = "http://127.0.0.1:4300"
    allowed_origins: str = "http://localhost:4200,http://localhost:4300,http://127.0.0.1:4200,http://127.0.0.1:4300,http://localhost:4000,http://127.0.0.1:4000"
    cookie_secure: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    ai_base_url: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    webrtc_stun_urls: str = "stun:stun.l.google.com:19302"
    webrtc_turn_url: str = ""
    webrtc_turn_username: str = ""
    webrtc_turn_password: str = ""
    upload_max_bytes: int = 5 * 1024 * 1024

    @property
    def origins(self):
        return [value.strip() for value in self.allowed_origins.split(",") if value.strip()]

    @model_validator(mode="after")
    def production_settings(self):
        if self.environment == "production":
            if not self.cookie_secure or not self.frontend_url.startswith("https://"):
                raise ValueError("Production requires secure cookies and an HTTPS frontend URL.")
            if not self.database_url.startswith("mysql"):
                raise ValueError("Production requires a configured MySQL database.")
        return self

@lru_cache
def get_settings():
    return Settings()

