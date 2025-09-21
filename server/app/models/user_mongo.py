from beanie import Document, Indexed
from pydantic import Field, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
import secrets
import string

from app.core.security import get_password_hash
from app.schemas.user import UserCreate


class Company(Document):
    """Company model for MongoDB."""
    
    company_name: Indexed(str, unique=True)
    company_name_furigana: str = Field(..., max_length=200)
    representative_user_id: str = Field(..., unique=True)
    members: List[str] = Field(default_factory=list)  # List of member user IDs
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Settings:
        collection = "companies"
        
    def __repr__(self):
        return f"<Company {self.company_name}>"
    
    def __str__(self):
        return self.company_name


class User(Document):
    """User model for MongoDB."""
    
    email: Indexed(EmailStr, unique=True)
    username: Indexed(str, unique=True)
    hashed_password: str
    is_active: bool = True
    is_admin: bool = False
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image: Optional[str] = None
    last_login: Optional[datetime] = None
    ocr_usage_this_month: int = 0  # Track current month OCR usage
    ocr_usage_last_month: int = 0  # Track last month OCR usage
    last_ocr_usage: Optional[datetime] = None
    # Company management fields
    company_id: Optional[str] = None
    role: str = Field(default="member", description="'representative' or 'member'")
    permissions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Settings:
        collection = "users"
        
    def __repr__(self):
        return f"<User {self.username}>"
    
    def __str__(self):
        return self.username 


class ProvisionalUser(Document):
    """Provisional user model for MongoDB during registration process."""
    
    email: Indexed(EmailStr, unique=True)
    company_name: str = Field(..., max_length=200)
    company_name_furigana: str = Field(..., max_length=200)
    person_in_charge: str = Field(..., max_length=100)
    person_in_charge_furigana: str = Field(..., max_length=100)
    phone_number: str = Field(..., max_length=20)
    verification_token: str = Field(..., unique=True)
    is_verified: bool = False
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        collection = "provisional_users"
        
    def __repr__(self):
        return f"<ProvisionalUser {self.email}>"
    
    def __str__(self):
        return self.email 