from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime

from app.crud import user_mongo as user_crud
from app.schemas.user import CompanyCreate, CompanyResponse, CompanyMember, UserInvite
from app.models.user_mongo import User as UserModel
from app.api.v1.endpoints.auth_mongo import get_current_active_user

router = APIRouter()


def convert_company_for_response(company) -> dict:
    """Convert MongoDB company to dict with string ID for Pydantic validation."""
    company_dict = company.model_dump()
    company_dict["id"] = str(company.id)
    return company_dict


def convert_user_for_response(user: UserModel) -> dict:
    """Convert MongoDB user to dict with string ID for Pydantic validation."""
    user_dict = user.model_dump()
    user_dict["id"] = str(user.id)
    return user_dict


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_data: CompanyCreate,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Create a new company."""
    # Check if user already has a company
    existing_company = await user_crud.get_user_company(str(current_user.id))
    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already belongs to a company"
        )
    
    # Check if company name already exists
    existing_company_name = await user_crud.get_company_by_name(company_data.company_name)
    if existing_company_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company name already exists"
        )
    
    # Create company
    company = await user_crud.create_company(company_data)
    
    # Update user role to representative
    await user_crud.update_user_company_role(
        str(current_user.id),
        str(company.id),
        "representative",
        ["company_manage", "member_manage", "all_features"]
    )
    
    return CompanyResponse.model_validate(convert_company_for_response(company))


@router.get("/my-company", response_model=CompanyResponse)
async def get_my_company(
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get current user's company information."""
    company = await user_crud.get_user_company(str(current_user.id))
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not belong to any company"
        )
    
    return CompanyResponse.model_validate(convert_company_for_response(company))


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: str,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get company information by ID."""
    # Check if user belongs to this company
    user_company = await user_crud.get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    company = await user_crud.get_company_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    return CompanyResponse.model_validate(convert_company_for_response(company))


@router.get("/{company_id}/members", response_model=List[CompanyMember])
async def get_company_members(
    company_id: str,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get all members of a company."""
    # Check if user belongs to this company
    user_company = await user_crud.get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    members = await user_crud.get_company_members(company_id)
    return [CompanyMember.model_validate(convert_user_for_response(member)) for member in members]


@router.post("/{company_id}/members", response_model=dict)
async def invite_company_member(
    company_id: str,
    user_invite: UserInvite,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Invite a new member to the company by creating their account."""
    # Check if user is company representative
    user_company = await user_crud.get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if current_user.role != "representative":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company representatives can invite members"
        )
    
    # Check if user already exists
    existing_user = await user_crud.get_user_by_email(user_invite.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    existing_username = await user_crud.get_user_by_username(user_invite.username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create the new user account
    # Generate a temporary password (user will need to change it on first login)
    import secrets
    import string
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    
    # Create user with company association
    new_user = await user_crud.create_company_member(
        username=user_invite.username,
        email=user_invite.email,
        password=temp_password,
        company_id=company_id,
        role=user_invite.role or "member"
    )
    
    # Add user to company members list
    await user_crud.add_company_member(company_id, str(new_user.id))
    
    # TODO: Send email with temporary password and instructions to change password
    # For now, just return success message with temporary password
    
    return {
        "message": "Member account created successfully",
        "email": user_invite.email,
        "username": user_invite.username,
        "temporary_password": temp_password,
        "note": "User should change password on first login"
    }


@router.delete("/{company_id}/members/{member_id}", response_model=dict)
async def remove_company_member(
    company_id: str,
    member_id: str,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Remove a member from the company."""
    # Check if user is company representative
    user_company = await user_crud.get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if current_user.role != "representative":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company representatives can remove members"
        )
    
    # Cannot remove yourself
    if str(current_user.id) == member_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself from company"
        )
    
    # Remove member
    success = await user_crud.remove_company_member(company_id, member_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove member"
        )
    
    # Update user's company association
    await user_crud.update_user_company_role(member_id, None, "member", [])
    
    return {"message": "Member removed successfully"}


@router.put("/{company_id}/members/{member_id}/role", response_model=dict)
async def update_member_role(
    company_id: str,
    member_id: str,
    role_update: dict,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Update a member's role and permissions."""
    # Check if user is company representative
    user_company = await user_crud.get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if current_user.role != "representative":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company representatives can update member roles"
        )
    
    # Update member role
    success = await user_crud.update_user_company_role(
        member_id,
        company_id,
        role_update.get("role", "member"),
        role_update.get("permissions", [])
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update member role"
        )
    
    return {"message": "Member role updated successfully"}


@router.delete("/{company_id}", response_model=dict)
async def delete_company(
    company_id: str,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Delete a company (only by representative)."""
    # Check if user is company representative
    user_company = await user_crud.get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if current_user.role != "representative":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company representatives can delete companies"
        )
    
    # TODO: Implement company deletion logic
    # This would involve removing all members and cleaning up associated data
    
    return {"message": "Company deletion not yet implemented"} 