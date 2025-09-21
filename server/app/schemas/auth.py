from pydantic import BaseModel
from typing import Optional
from app.schemas.user import User


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: User


class RefreshToken(BaseModel):
    refresh_token: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User 