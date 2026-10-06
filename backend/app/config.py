from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    app_name: str = "SERP Monitor API"
    app_env: str = "production"
    cors_origins: str = "http://localhost:5173"
    excel_path: str = Field(default="", validation_alias="SERP_EXCEL_PATH")
    serp_scripts_dir: str = Field(default="", validation_alias="SERP_SCRIPTS_DIR")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
