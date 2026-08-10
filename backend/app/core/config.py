"""Application settings, read from environment variables (or a local .env
file) with sensible defaults for local development."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Kept as a named constant (not just an inline default) so main.py can warn
# at startup if the effective secret still equals this well-known value.
DEFAULT_DEV_JWT_SECRET = "dev-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://exam_user:exam_password@localhost:5432/exam_system"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = DEFAULT_DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Comma-separated list of allowed browser origins for CORS.
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
