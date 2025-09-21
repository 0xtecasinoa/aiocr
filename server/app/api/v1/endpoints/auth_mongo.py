from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)

from app.core.security import (
    verify_password, 
    get_password_hash,
    create_token_pair,
    verify_token
)
from app.crud import user_mongo as user_crud
from app.schemas.user import UserCreate, User, UserProfile, UserProfileUpdate, ProvisionalUserCreate, ProvisionalUserResponse, UserCompleteRegistration, UserCreateWithCompany
from app.schemas.auth import Token, TokenData
from app.models.user_mongo import User as UserModel

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def convert_user_for_response(user: UserModel) -> dict:
    """Convert MongoDB user to dict with string ID for Pydantic validation."""
    user_dict = user.model_dump()
    user_dict["id"] = str(user.id)
    return user_dict


async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> UserModel:
    """Get current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Verify token
    payload = verify_token(token, token_type="access")
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # Get user from database
    user = await user_crud.get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: UserModel = Depends(get_current_user)
) -> UserModel:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user."""
    # Check if user already exists
    existing_user = await user_crud.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = await user_crud.get_user_by_username(user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    user = await user_crud.create_user(user_data)
    return User.model_validate(convert_user_for_response(user))


@router.post("/register-with-company", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_with_company(user_data: UserCreateWithCompany):
    """Register a new user with company information."""
    # Check if user already exists
    existing_user = await user_crud.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = await user_crud.get_user_by_username(user_data.username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check if company already exists
    existing_company = await user_crud.get_company_by_name(user_data.company_name)
    
    if existing_company:
        # Company exists, check if user is already a member
        # Get the representative user to check their email
        representative_user = await user_crud.get_user_by_id(existing_company.representative_user_id)
        if representative_user and representative_user.email == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already registered as the representative of this company"
            )
        
        # Check if any member has this email
        company_members = await user_crud.get_company_members(str(existing_company.id))
        for member in company_members:
            if member.email == user_data.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already a member of this company"
                )
        
        # Company exists but user is not a member, create user and add to existing company
        user = await user_crud.create_user_for_existing_company(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            company_id=str(existing_company.id),
            role="member"
        )
        
        # Add user to company members list
        await user_crud.add_company_member(str(existing_company.id), str(user.id))
        
    else:
        # Company doesn't exist, create new company and user
        user = await user_crud.create_user_with_company(user_data)
    
    return User.model_validate(convert_user_for_response(user))


@router.post("/provisional-register", response_model=ProvisionalUserResponse, status_code=status.HTTP_201_CREATED)
async def provisional_register(provisional_user_data: ProvisionalUserCreate):
    """Create a provisional registration for a new user."""
    # Check if user already exists
    existing_user = await user_crud.get_user_by_email(provisional_user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if provisional user already exists
    existing_provisional = await user_crud.get_provisional_user_by_email(provisional_user_data.email)
    if existing_provisional:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provisional registration already exists for this email"
        )
    
    # Create provisional user
    provisional_user = await user_crud.create_provisional_user(provisional_user_data)
    
    # TODO: Send verification email with the verification token
    # For now, we'll just return the provisional user data
    # In production, you would send an email with the verification link
    
    return ProvisionalUserResponse.model_validate({
        "id": str(provisional_user.id),
        "email": provisional_user.email,
        "company_name": provisional_user.company_name,
        "company_name_furigana": provisional_user.company_name_furigana,
        "person_in_charge": provisional_user.person_in_charge,
        "person_in_charge_furigana": provisional_user.person_in_charge_furigana,
        "phone_number": provisional_user.phone_number,
        "is_verified": provisional_user.is_verified,
        "expires_at": provisional_user.expires_at,
        "created_at": provisional_user.created_at
    })


@router.post("/verify-email", response_model=dict)
async def verify_email(verification_data: dict):
    """Verify email using verification token."""
    verification_token = verification_data.get("verification_token")
    if not verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is required"
        )
    
    # Get provisional user by token
    provisional_user = await user_crud.get_provisional_user_by_token(verification_token)
    if not provisional_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    # Check if token has expired
    if provisional_user.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired"
        )
    
    # Mark as verified
    provisional_user.is_verified = True
    await provisional_user.save()
    
    return {
        "message": "Email verified successfully",
        "provisional_user_id": str(provisional_user.id),
        "email": provisional_user.email
    }


@router.post("/complete-registration", response_model=User, status_code=status.HTTP_201_CREATED)
async def complete_registration(registration_data: UserCompleteRegistration):
    """Complete user registration with password after email verification."""
    # Get provisional user by token
    provisional_user = await user_crud.get_provisional_user_by_token(registration_data.verification_token)
    if not provisional_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    # Check if token has expired
    if provisional_user.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired"
        )
    
    # Check if email is verified
    if not provisional_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email must be verified before completing registration"
        )
    
    # Check if username is already taken
    existing_user = await user_crud.get_user_by_username(registration_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create the actual user
    user_data = UserCreate(
        email=provisional_user.email,
        username=registration_data.username,
        password=registration_data.password
    )
    
    user = await user_crud.create_user(user_data)
    
    # Create company for the user
    from app.schemas.user import CompanyCreate
    company_data = CompanyCreate(
        company_name=provisional_user.company_name,
        company_name_furigana=provisional_user.company_name_furigana,
        representative_user_id=str(user.id)
    )
    
    company = await user_crud.create_company(company_data)
    
    # Update user role to representative
    await user_crud.update_user_company_role(
        str(user.id),
        str(company.id),
        "representative",
        ["company_manage", "member_manage", "all_features"]
    )
    
    # Delete the provisional user
    await user_crud.delete_provisional_user(str(provisional_user.id))
    
    return User.model_validate(convert_user_for_response(user))


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login and get access token."""
    # Get user by email or username
    user = await user_crud.get_user_by_email(form_data.username)
    if not user:
        user = await user_crud.get_user_by_username(form_data.username)
    
    # Verify user and password
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Update last login
    await user_crud.update_user_last_login(str(user.id))
    
    # Create token pair
    token_data = {"sub": str(user.id), "email": user.email, "username": user.username}
    tokens = create_token_pair(token_data)
    
    return Token(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        user=User.model_validate(convert_user_for_response(user))
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_data: dict):
    """Refresh access token using refresh token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    refresh_token = refresh_data.get("refresh_token")
    if not refresh_token:
        raise credentials_exception
    
    # Verify refresh token
    payload = verify_token(refresh_token, token_type="refresh")
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # Get user from database
    user = await user_crud.get_user_by_id(user_id)
    if user is None or not user.is_active:
        raise credentials_exception
    
    # Create new token pair
    token_data = {"sub": str(user.id), "email": user.email, "username": user.username}
    tokens = create_token_pair(token_data)
    
    return Token(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        user=User.model_validate(convert_user_for_response(user))
    )


@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get current user information."""
    return User.model_validate(convert_user_for_response(current_user))


@router.post("/logout")
async def logout():
    """Logout user (client should remove tokens)."""
    return {"message": "Successfully logged out"} 


@router.get("/profile", response_model=UserProfile)
async def get_user_profile(
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get current user profile with OCR usage statistics."""
    return UserProfile.model_validate(convert_user_for_response(current_user))


@router.put("/profile", response_model=UserProfile)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Update current user profile."""
    update_data = profile_data.model_dump(exclude_unset=True)
    logger.info(f"Profile update request for user: {current_user.username}")
    
    if update_data:
        # Check if username is being updated and if it's already taken
        if "username" in update_data:
            if update_data["username"] != current_user.username:
                logger.info(f"Username change detected: {current_user.username} -> {update_data['username']}")
                existing_user = await user_crud.get_user_by_username(update_data["username"])
                if existing_user and str(existing_user.id) != str(current_user.id):
                    logger.warning(f"Username conflict detected with user: {existing_user.id}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Username already taken"
                    )
        
        for key, value in update_data.items():
            setattr(current_user, key, value)
        
        current_user.updated_at = datetime.utcnow()
        await current_user.save()
        logger.info(f"User profile updated successfully: {current_user.username}")
        
        # Verify the save worked by re-fetching the user
        await current_user.refresh()
    
    result = UserProfile.model_validate(convert_user_for_response(current_user))
    return result 