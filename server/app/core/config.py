from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List, Optional
import secrets
import os
from dotenv import load_dotenv
import logging

# Load environment variables from .env file with error handling
try:
    load_dotenv(encoding='utf-8')
    print("✅ .env file loaded successfully")
except UnicodeDecodeError:
    print("⚠️  .env file encoding error, trying without encoding specification")
    try:
        load_dotenv()
    except Exception as e:
        print(f"⚠️  Could not load .env file: {e}")
except FileNotFoundError:
    print("⚠️  .env file not found, using environment variables only")
except Exception as e:
    print(f"⚠️  Error loading .env file: {e}")

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    PROJECT_NAME: str = "Conex AI-OCR API"
    VERSION: str = "1.0.0"
    DEBUG: bool = True  # Enable debug mode for development
    API_V1_PREFIX: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # MongoDB Database
    MONGODB_URL: Optional[str] = None
    MONGODB_HOST: str = "localhost"
    MONGODB_PORT: int = 27017
    MONGODB_DATABASE: str = "ocr_db"
    MONGODB_USERNAME: Optional[str] = None
    MONGODB_PASSWORD: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 100  # MB - increased for Excel files
    ALLOWED_EXTENSIONS: List[str] = ["pdf", "png", "jpg", "jpeg", "tiff", "bmp", "xls", "xlsx", "doc", "docx", "txt"]
    
    # OCR Configuration
    OCR_LANGUAGES: List[str] = ["eng", "jpn"]
    DEFAULT_DPI: int = 300
    
    # OpenAI Configuration (Required for OCR)
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = "gpt-4o"  # Using gpt-4o which has vision capabilities
    
    # AWS S3 (Optional)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_BUCKET_NAME: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    
    # Email Configuration
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
        "https://localhost:5174",
        "https://127.0.0.1:5174"
    ]
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        """Parse CORS origins from string if needed."""
        if isinstance(v, str) and v:
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        # Default origins - add your production domain here
        default_origins = [
            "http://localhost:3000", 
            "http://localhost:5173", 
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:3000"
        ]
        # Add production origins from environment
        production_origins = os.getenv("PRODUCTION_ORIGINS", "").split(",")
        production_origins = [origin.strip() for origin in production_origins if origin.strip()]
        return default_origins + production_origins
    
    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def assemble_allowed_extensions(cls, v):
        """Parse allowed extensions from string if needed."""
        if isinstance(v, str) and v:
            return [i.strip().lower() for i in v.split(",")]
        elif isinstance(v, list):
            return [ext.lower() for ext in v]
        return ["pdf", "png", "jpg", "jpeg", "tiff", "bmp"]
    
    @field_validator("OCR_LANGUAGES", mode="before")
    @classmethod
    def assemble_ocr_languages(cls, v):
        """Parse OCR languages from string if needed."""
        if isinstance(v, str) and v:
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return ["eng"]
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"


# Create global settings instance
settings = Settings()

# Debug: Check if OpenAI API key is loaded
if settings.OPENAI_API_KEY:
    print(f"✅ OpenAI API Key loaded: {settings.OPENAI_API_KEY[:10]}...")
else:
    print("❌ OpenAI API Key not found in environment variables") 