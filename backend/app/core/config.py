from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "DCAT-OCA API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Security
    SECRET_KEY: str = "tu-clave-secreta-muy-segura-cambiar-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS - comma-separated string from env, e.g. "https://myapp.vercel.app,http://localhost:3000"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # ODIS API (OCA)
    OCA_EMAIL: str = ""
    OCA_PASSWORD: str = ""
    OCA_API_URL: str = "https://odisbk.com/api/v2.0"

    # Data paths
    DATA_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

    # Database
    DATABASE_URL: Optional[str] = None

    @property
    def ASYNC_DATABASE_URL(self) -> Optional[str]:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if "postgresql+asyncpg://" in url:
                return url
            return url.replace("postgresql://", "postgresql+asyncpg://")
        return None

    @property
    def SYNC_DATABASE_URL(self) -> Optional[str]:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            return url.replace("postgresql+asyncpg://", "postgresql://")
        return None

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env")
        case_sensitive = True
        extra = "ignore"


settings = Settings()
