from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    database_url: str
    app_name: str = "SERP Monitor API"
    app_env: str = "production"
    cors_origins: str = "http://localhost:5173"
    excel_path: str = Field(default="", validation_alias="SERP_EXCEL_PATH")
    serp_scripts_dir: str = Field(default="", validation_alias="SERP_SCRIPTS_DIR")

    # Resolve the ignored, machine-specific project .env regardless of the
    # directory used to launch uvicorn (project root or backend/).
    model_config = SettingsConfigDict(
        # Keep the old backend/.env location as a fallback for existing clones.
        env_file=(PROJECT_ROOT / ".env", PROJECT_ROOT / "backend" / ".env"),
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
