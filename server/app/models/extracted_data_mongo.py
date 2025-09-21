from beanie import Document
from pydantic import Field, ConfigDict
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from bson import ObjectId


class ExtractedData(Document):
    """Extracted data model for MongoDB."""
    
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    # User and job relationship
    user_id: str  # String representation of user ObjectId
    conversion_job_id: Optional[str] = None  # String representation of job ObjectId
    uploaded_file_id: Optional[str] = None  # String representation of uploaded file ObjectId
    folder_name: Optional[str] = None  # Folder name for organizing data
    
    # Enhanced product-specific fields (for OCR extracted product data)
    product_name: Optional[str] = None
    sku: Optional[str] = None
    jan_code: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None
    origin: Optional[str] = None
    warranty: Optional[str] = None
    dimensions: Optional[Union[str, Dict[str, Any]]] = None
    specifications: Optional[Union[str, Dict[str, Any]]] = None
    
    # OCR technical fields
    page_number: Optional[int] = None
    raw_text: Optional[str] = None
    structured_data: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    word_confidences: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None  # Accept both dict and list
    bounding_boxes: Optional[List[Dict[str, Any]]] = None
    text_blocks: Optional[List[Dict[str, Any]]] = None
    tables: Optional[List[Dict[str, Any]]] = None
    forms: Optional[List[Dict[str, Any]]] = None
    images: Optional[List[Dict[str, Any]]] = None
    language_detected: Optional[str] = None
    processing_metadata: Optional[Dict[str, Any]] = None
    
    # Review and validation
    needs_review: bool = False
    is_validated: bool = False
    validation_notes: Optional[str] = None
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    status: str = "extracted"  # extracted, validated, reviewed, completed, needs_review
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Settings:
        collection = "extracted_data"
        
    def __repr__(self):
        return f"<ExtractedData {self.id}>" 