from datetime import datetime
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class BillingHistory(Document):
    """Billing history model for storing invoice information."""
    
    company_id: str = Field(..., description="Company ID")
    year: int = Field(..., description="Billing year")
    month: int = Field(..., description="Billing month")
    total_items: int = Field(..., description="Total number of items processed")
    total_amount: float = Field(..., description="Total billing amount")
    invoice_url: Optional[str] = Field(None, description="URL to download the invoice")
    invoice_filename: Optional[str] = Field(None, description="Invoice filename")
    status: str = Field(default="pending", description="Invoice status: pending, generated, sent")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    
    class Settings:
        name = "billing_history"
        indexes = [
            "company_id",
            "year",
            "month",
            ("company_id", "year", "month"),  # Compound index for efficient queries
            "status"
        ]
    
    class Config:
        json_schema_extra = {
            "example": {
                "company_id": "507f1f77bcf86cd799439011",
                "year": 2025,
                "month": 8,
                "total_items": 500,
                "total_amount": 50000.0,
                "invoice_url": "/invoices/invoice-2025-08.pdf",
                "invoice_filename": "invoice-2025-08.pdf",
                "status": "generated",
                "created_at": "2025-08-31T00:00:00Z",
                "updated_at": "2025-08-31T00:00:00Z"
            }
        } 