from beanie import Document, Link
from pydantic import Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

from .user_mongo import User


class FileUpload(Document):
    """File upload model for MongoDB."""
    
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    # User relationship (using string ID for consistency)
    user_id: str  # String representation of user ObjectId
    
    # File details
    filename: str
    original_name: str  # Match frontend expectation
    file_path: str
    file_size: int  # in bytes
    mime_type: str
    
    # Optional file details
    file_hash: Optional[str] = None  # SHA256 hash
    folder_name: Optional[str] = None  # For organizing files
    
    # Status and storage
    upload_status: str = "uploaded"  # uploaded, processing, completed, failed
    s3_key: Optional[str] = None  # For S3 storage
    s3_bucket: Optional[str] = None
    file_metadata: Optional[Dict[str, Any]] = None  # JSON metadata
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Settings:
        collection = "file_uploads"
        
    def __repr__(self):
        return f"<FileUpload {self.original_filename}>" 