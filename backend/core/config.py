from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    ENV: str = "development"
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/globalanalytics"
    REDIS_URL: str = "redis://localhost:6379"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://your-frontend.railway.app"]

    # Ключи внешних API (задать в .env)
    WORLD_BANK_BASE_URL: str = "https://api.worldbank.org/v2"
    ALPHA_VANTAGE_API_KEY: str = ""
    FRED_API_KEY: str = ""
    NEWS_API_KEY: str = ""
    GDELT_BASE_URL: str = "https://api.gdeltproject.org/api/v2"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
