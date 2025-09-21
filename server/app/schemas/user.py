from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Any, List
from datetime import datetime
from bson import ObjectId


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)
    is_admin: Optional[bool] = False


class UserCreateWithCompany(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    company_name: str = Field(..., max_length=200)
    company_name_furigana: str = Field(..., max_length=200)
    person_in_charge: str = Field(..., max_length=100)
    person_in_charge_furigana: str = Field(..., max_length=100)
    phone_number: str = Field(..., max_length=20)
    is_admin: Optional[bool] = False


class ProvisionalUserCreate(BaseModel):
    email: EmailStr
    company_name: str = Field(..., max_length=200)
    company_name_furigana: str = Field(..., max_length=200)
    person_in_charge: str = Field(..., max_length=100)
    person_in_charge_furigana: str = Field(..., max_length=100)
    phone_number: str = Field(..., max_length=20)


class ProvisionalUserResponse(BaseModel):
    id: str
    email: str
    company_name: str
    company_name_furigana: str
    person_in_charge: str
    person_in_charge_furigana: str
    phone_number: str
    is_verified: bool
    expires_at: datetime
    created_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v: Any) -> str:
        """Convert ObjectId to string."""
        if isinstance(v, ObjectId):
            return str(v)
        return v

    class Config:
        from_attributes = True


class UserCompleteRegistration(BaseModel):
    verification_token: str
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)


class CompanyCreate(BaseModel):
    company_name: str = Field(..., max_length=200)
    company_name_furigana: str = Field(..., max_length=200)
    representative_user_id: str


class CompanyResponse(BaseModel):
    id: str
    company_name: str
    company_name_furigana: str
    representative_user_id: str
    members: List[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v: Any) -> str:
        """Convert ObjectId to string."""
        if isinstance(v, ObjectId):
            return str(v)
        return v

    class Config:
        from_attributes = True


class CompanyMember(BaseModel):
    id: str
    username: str
    email: str
    role: str
    permissions: List[str]
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v: Any) -> str:
        """Convert ObjectId to string."""
        if isinstance(v, ObjectId):
            return str(v)
        return v

    class Config:
        from_attributes = True


class UserInvite(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    role: str = Field(default="member", description="Role: member or admin")


class UserLogin(BaseModel):
    username: str = Field(..., description="Username or email")
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


class User(UserBase):
    id: str  # Changed from int to str for MongoDB ObjectId
    is_active: bool
    is_admin: bool
    profile_image: Optional[str] = None
    last_login: Optional[datetime] = None
    company_id: Optional[str] = None
    role: str
    permissions: List[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v: Any) -> str:
        """Convert ObjectId to string."""
        if isinstance(v, ObjectId):
            return str(v)
        return v

    class Config:
        from_attributes = True


class UserProfile(BaseModel):
    id: str  # Changed from int to str for MongoDB ObjectId
    email: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image: Optional[str] = None
    is_admin: bool
    last_login: Optional[datetime] = None
    company_id: Optional[str] = None
    role: str
    permissions: List[str]
    created_at: datetime
    ocr_usage_this_month: int = 0
    ocr_usage_last_month: int = 0
    last_ocr_usage: Optional[datetime] = None

    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v: Any) -> str:
        """Convert ObjectId to string."""
        if isinstance(v, ObjectId):
            return str(v)
        return v

    class Config:
        from_attributes = True 


class UserProfileUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = None
    profile_image: Optional[str] = None 