from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator
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

    # Added to every bill. Service charge is a % of the food total; tax is a % of food + service.
    service_charge_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    tax_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    tax_label: str = "GST"
    # The restaurant's local time zone, used to decide what "today" means in the daily summary.
    timezone: str = "Asia/Kolkata"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("jwt_secret")
    @classmethod
    def secret_must_be_strong(cls, value: str) -> str:
        if value.strip().lower() in KNOWN_PLACEHOLDER_SECRETS or len(value) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 random characters. Generate one with: openssl rand -hex 32"
            )
        return value

    @field_validator("timezone")
    @classmethod
    def timezone_must_exist(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"Unknown TIMEZONE {value!r}. Use a name like Asia/Kolkata")
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
