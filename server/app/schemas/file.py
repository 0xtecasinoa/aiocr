from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FileUploadResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size: int
    file_type: str
    status: str
    message: str


class FileListResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size: int
    file_type: str
    status: str
    created_at: str


class ConversionJobCreate(BaseModel):
    file_id: str
    name: str
    ocr_language: str = "eng"
    confidence_threshold: float = 0.8


class ConversionJobResponse(BaseModel):
    id: str
    name: str
    status: str
    progress: float
    created_at: str
    file_name: Optional[str] = None


class ConversionJobStatus(BaseModel):
    id: str
    status: str
    progress: float
    error_message: Optional[str] = None
    pages_processed: int = 0
    total_pages: Optional[int] = None 