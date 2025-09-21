from beanie import Document
from pydantic import Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId


class ConversionJob(Document):
    """Conversion job model for MongoDB."""
    
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    # User and file relationships (using string IDs for consistency)
    user_id: str  # String representation of user ObjectId
    file_ids: list[str] = []  # List of file IDs to process
    folder_name: Optional[str] = None  # Folder name for organizing conversion jobs
    
    # Job details
    name: str
    status: str = "pending"  # pending, processing, completed, failed, cancelled
    progress: float = 0.0
    
    # OCR settings
    ocr_language: str = "eng"
    ocr_engine: str = "openai"
    confidence_threshold: float = 0.7
    ocr_settings: Optional[Dict[str, Any]] = None
    preprocessing_options: Optional[Dict[str, Any]] = None
    
    # Progress and results
    error_message: Optional[str] = None
    processing_time: Optional[float] = None
    processed_files: int = 0
    total_files: int = 0
    pages_processed: int = 0
    total_pages: int = 0
    results: list[Dict[str, Any]] = []
    estimated_time_remaining: Optional[float] = None
    
    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Settings:
        collection = "conversion_jobs"
        
    def __repr__(self):
        return f"<ConversionJob {self.job_id}>" 