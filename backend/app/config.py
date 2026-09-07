from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://cafeflow:cafeflow@db:5432/cafeflow"
    jwt_secret: str = "dev-only-change-me"
    access_token_minutes: int = 480
    frontend_origin: str = "http://localhost:3000"
    seed_demo_data: bool = True
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
settings = Settings()
