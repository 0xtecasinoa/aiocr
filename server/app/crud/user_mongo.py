from beanie import PydanticObjectId
from typing import Optional, List
from datetime import datetime, timedelta
import secrets
import string

from app.models.user_mongo import User, ProvisionalUser, Company
from app.core.security import get_password_hash
from app.schemas.user import UserCreate


async def get_user_by_id(user_id: str) -> Optional[User]:
    """Get user by ID."""
    try:
        return await User.get(PydanticObjectId(user_id))
    except:
        return None


async def get_user_by_email(email: str) -> Optional[User]:
    """Get user by email."""
    return await User.find_one(User.email == email)


async def get_user_by_username(username: str) -> Optional[User]:
    """Get user by username."""
    return await User.find_one(User.username == username)


async def create_user(user_data: UserCreate) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(user_data.password)
    
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        is_admin=user_data.is_admin or False
    )
    
    await user.insert()
    return user


async def create_user_with_company(user_data) -> User:
    """Create a new user with company information."""
    hashed_password = get_password_hash(user_data.password)
    
    # Create the user first
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        is_admin=user_data.is_admin or False,
        role="representative"  # First user becomes company representative
    )
    
    await user.insert()
    
    # Create the company
    company = Company(
        company_name=user_data.company_name,
        company_name_furigana=user_data.company_name_furigana,
        representative_user_id=str(user.id),
        members=[str(user.id)]  # Representative is first member
    )
    
    await company.insert()
    
    # Update user with company_id
    user.company_id = str(company.id)
    await user.save()
    
    return user


async def create_company_member(username: str, email: str, password: str, company_id: str, role: str = "member") -> User:
    """Create a new user account for a company member."""
    hashed_password = get_password_hash(password)
    
    # Determine permissions based on role
    if role == "admin":
        permissions = ["company_manage", "member_manage", "all_features"]
    else:
        permissions = ["basic_features"]
    
    # Create the user
    user = User(
        email=email,
        username=username,
        hashed_password=hashed_password,
        is_admin=False,
        company_id=company_id,
        role=role,
        permissions=permissions
    )
    
    await user.insert()
    return user


async def create_user_for_existing_company(username: str, email: str, password: str, company_id: str, role: str = "member") -> User:
    """Create a new user account for an existing company."""
    hashed_password = get_password_hash(password)
    
    # Determine permissions based on role
    if role == "admin":
        permissions = ["company_manage", "member_manage", "all_features"]
    else:
        permissions = ["basic_features"]
    
    # Create the user
    user = User(
        email=email,
        username=username,
        hashed_password=hashed_password,
        is_admin=False,
        company_id=company_id,
        role=role,
        permissions=permissions
    )
    
    await user.insert()
    return user


async def update_user_last_login(user_id: str) -> bool:
    """Update user's last login timestamp."""
    try:
        user = await User.get(PydanticObjectId(user_id))
        if user:
            user.last_login = datetime.utcnow()
            await user.save()
            return True
        return False
    except:
        return False


# Company CRUD operations
async def create_company(company_data) -> Company:
    """Create a new company."""
    company = Company(
        company_name=company_data.company_name,
        company_name_furigana=company_data.company_name_furigana,
        representative_user_id=company_data.representative_user_id,
        members=[company_data.representative_user_id]  # Representative is first member
    )
    
    await company.insert()
    return company


async def get_company_by_id(company_id: str) -> Optional[Company]:
    """Get company by ID."""
    try:
        return await Company.get(PydanticObjectId(company_id))
    except:
        return None


async def get_company_by_name(company_name: str) -> Optional[Company]:
    """Get company by name."""
    return await Company.find_one(Company.company_name == company_name)


async def get_company_by_representative(representative_user_id: str) -> Optional[Company]:
    """Get company by representative user ID."""
    return await Company.find_one(Company.representative_user_id == representative_user_id)


async def get_user_company(user_id: str) -> Optional[Company]:
    """Get company that a user belongs to."""
    user = await get_user_by_id(user_id)
    if user and user.company_id:
        return await get_company_by_id(user.company_id)
    return None


async def add_company_member(company_id: str, user_id: str) -> bool:
    """Add a user to a company."""
    try:
        company = await Company.get(PydanticObjectId(company_id))
        if company and user_id not in company.members:
            company.members.append(user_id)
            company.updated_at = datetime.utcnow()
            await company.save()
            return True
        return False
    except:
        return False


async def remove_company_member(company_id: str, user_id: str) -> bool:
    """Remove a user from a company."""
    try:
        company = await Company.get(PydanticObjectId(company_id))
        if company and user_id in company.members:
            company.members.remove(user_id)
            company.updated_at = datetime.utcnow()
            await company.save()
            return True
        return False
    except:
        return False


async def update_user_company_role(user_id: str, company_id: str, role: str, permissions: List[str]) -> bool:
    """Update user's company role and permissions."""
    try:
        user = await User.get(PydanticObjectId(user_id))
        if user:
            user.company_id = company_id
            user.role = role
            user.permissions = permissions
            user.updated_at = datetime.utcnow()
            await user.save()
            return True
        return False
    except:
        return False


async def get_company_members(company_id: str) -> List[User]:
    """Get all members of a company."""
    try:
        company = await Company.get(PydanticObjectId(company_id))
        if company:
            members = []
            for member_id in company.members:
                user = await get_user_by_id(member_id)
                if user:
                    members.append(user)
            return members
        return []
    except:
        return []


# Provisional User CRUD operations
def generate_verification_token(length: int = 32) -> str:
    """Generate a random verification token."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def create_provisional_user(provisional_user_data) -> ProvisionalUser:
    """Create a new provisional user."""
    # Generate verification token
    verification_token = generate_verification_token()
    
    # Set expiration time (24 hours from now)
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    provisional_user = ProvisionalUser(
        email=provisional_user_data.email,
        company_name=provisional_user_data.company_name,
        company_name_furigana=provisional_user_data.company_name_furigana,
        person_in_charge=provisional_user_data.person_in_charge,
        person_in_charge_furigana=provisional_user_data.person_in_charge_furigana,
        phone_number=provisional_user_data.phone_number,
        verification_token=verification_token,
        expires_at=expires_at
    )
    
    await provisional_user.insert()
    return provisional_user


async def get_provisional_user_by_token(verification_token: str) -> Optional[ProvisionalUser]:
    """Get provisional user by verification token."""
    return await ProvisionalUser.find_one(ProvisionalUser.verification_token == verification_token)


async def get_provisional_user_by_email(email: str) -> Optional[ProvisionalUser]:
    """Get provisional user by email."""
    return await ProvisionalUser.find_one(ProvisionalUser.email == email)


async def delete_provisional_user(provisional_user_id: str) -> bool:
    """Delete a provisional user."""
    try:
        provisional_user = await ProvisionalUser.get(PydanticObjectId(provisional_user_id))
        if provisional_user:
            await provisional_user.delete()
            return True
        return False
    except:
        return False


async def cleanup_expired_provisional_users() -> int:
    """Clean up expired provisional users and return count of deleted users."""
    try:
        expired_users = await ProvisionalUser.find(ProvisionalUser.expires_at < datetime.utcnow()).to_list()
        count = len(expired_users)
        
        for user in expired_users:
            await user.delete()
        
        return count
    except:
        return 0


async def deactivate_user(user_id: str) -> Optional[User]:
    """Deactivate a user account."""
    user = await get_user_by_id(user_id)
    if not user:
        return None
    
    user.is_active = False
    user.updated_at = datetime.utcnow()
    await user.save()
    return user


async def get_users(
    skip: int = 0, 
    limit: int = 100,
    include_inactive: bool = False
) -> List[User]:
    """Get list of users with pagination."""
    query = User.find()
    
    if not include_inactive:
        query = User.find(User.is_active == True)
    
    users = await query.skip(skip).limit(limit).sort(-User.created_at).to_list()
    return users 


async def increment_ocr_usage(user_id: str) -> Optional[User]:
    """Increment user's OCR usage count."""
    user = await get_user_by_id(user_id)
    if not user:
        return None
    
    now = datetime.utcnow()
    
    # Check if it's a new month, move current month to last month and reset current month
    if (user.last_ocr_usage and 
        (user.last_ocr_usage.month != now.month or 
         user.last_ocr_usage.year != now.year)):
        user.ocr_usage_last_month = user.ocr_usage_this_month
        user.ocr_usage_this_month = 1
    else:
        user.ocr_usage_this_month += 1
    
    user.last_ocr_usage = now
    user.updated_at = now
    await user.save()
    return user


async def get_user_ocr_stats(user_id: str) -> Optional[dict]:
    """Get user's OCR usage statistics."""
    user = await get_user_by_id(user_id)
    if not user:
        return None
    
    return {
        "total_ocr_usage": user.ocr_usage_this_month + user.ocr_usage_last_month,
        "monthly_ocr_usage": user.ocr_usage_this_month,
        "last_month_ocr_usage": user.ocr_usage_last_month,
        "last_ocr_usage": user.last_ocr_usage,
        "member_since": user.created_at,
        "last_login": user.last_login
    } 