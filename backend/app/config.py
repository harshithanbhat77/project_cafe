from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Values that have appeared in example files or old defaults. Anyone can read these,
# so a token signed with one of them can be forged.
KNOWN_PLACEHOLDER_SECRETS = {
    "dev-only-change-me",
    "replace-with-a-long-random-secret",
    "change-me",
    "secret",
}


class Settings(BaseSettings):
    environment: Literal["development", "production"] = "development"
    database_url: str = "postgresql+psycopg://cafeflow:cafeflow@db:5432/cafeflow"
    jwt_secret: str  # required, no default: generate with `openssl rand -hex 32`
    access_token_minutes: int = 480
    session_ttl_minutes: int = 180
    frontend_origin: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("jwt_secret")
    @classmethod
    def secret_must_be_strong(cls, value: str) -> str:
        if value.strip().lower() in KNOWN_PLACEHOLDER_SECRETS or len(value) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 random characters. Generate one with: openssl rand -hex 32"
            )
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
