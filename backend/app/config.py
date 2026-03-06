from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Saudi Media Monitor"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "your-secret-key-change-in-production"

    # Database (SQLite للتطوير، PostgreSQL للإنتاج)
    DATABASE_URL: str = "sqlite+aiosqlite:///./media_monitor.db"
    DATABASE_URL_SYNC: str = "sqlite:///./media_monitor.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # RSS Sources
    RSS_FETCH_INTERVAL: int = 300  # seconds (5 minutes)
    MAX_ARTICLES_PER_SOURCE: int = 50

    # NLP — منتدى الإعلام السعودي (عتبة منخفضة لرصد أشمل)
    SENTIMENT_MODEL: str = "CAMeL-Lab/bert-base-arabic-camelbert-msa-sentiment"
    CRISIS_THRESHOLD: float = 0.40

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:80",
        "http://frontend:3000",
    ]

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30

    # Anthropic / Claude API (اختياري)
    ANTHROPIC_API_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
