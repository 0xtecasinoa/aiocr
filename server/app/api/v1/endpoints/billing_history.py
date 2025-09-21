from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
import os

from app.api.v1.endpoints.auth_mongo import get_current_active_user
from app.models.user_mongo import User
from app.models.billing_history_mongo import BillingHistory
from app.crud.billing_history_mongo import (
    get_company_billing_history,
    get_billing_history_by_id,
    generate_monthly_billing_history,
    get_billing_summary,
    generate_all_company_billing_history,
    calculate_monthly_usage
)
from app.crud.user_mongo import get_user_company

router = APIRouter()


@router.get("/company/{company_id}")
async def get_company_billing_history_endpoint(
    company_id: str,
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Get billing history for a specific company."""
    
    # Check if user belongs to the company
    user_company = await get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this company's billing history"
        )
    
    try:
        billing_records = await get_company_billing_history(company_id, year, month)
        
        return {
            "success": True,
            "billing_history": [
                {
                    "id": str(record.id),
                    "year": record.year,
                    "month": record.month,
                    "total_items": record.total_items,
                    "total_amount": record.total_amount,
                    "invoice_url": record.invoice_url,
                    "invoice_filename": record.invoice_filename,
                    "status": record.status,
                    "created_at": record.created_at.isoformat(),
                    "updated_at": record.updated_at.isoformat()
                }
                for record in billing_records
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving billing history: {str(e)}"
        )


@router.get("/user/{user_id}")
async def get_user_billing_history_endpoint(
    user_id: str,
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Get billing history for a specific user (fallback when no company exists)."""
    
    # Check if user is requesting their own data or is admin
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's billing history"
        )
    
    try:
        # For now, return empty billing history for users without companies
        # In a real implementation, you might want to create user-based billing records
        return {
            "success": True,
            "billing_history": []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving billing history: {str(e)}"
        )


@router.get("/company/{company_id}/summary")
async def get_company_billing_summary(
    company_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get billing summary for a company."""
    
    # Check if user belongs to the company
    user_company = await get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this company's billing summary"
        )
    
    try:
        summary = await get_billing_summary(company_id)
        
        return {
            "success": True,
            "summary": summary
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving billing summary: {str(e)}"
        )


@router.post("/company/{company_id}/generate")
async def generate_monthly_billing(
    company_id: str,
    billing_data: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Generate monthly billing history for a company."""
    
    # Check if user belongs to the company
    user_company = await get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to generate billing for this company"
        )
    
    try:
        year = billing_data.get("year")
        month = billing_data.get("month")
        total_items = billing_data.get("total_items")
        total_amount = billing_data.get("total_amount")
        
        if not year or not month:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Year and month are required"
            )
        
        billing_history = await generate_monthly_billing_history(
            company_id, year, month, total_items, total_amount
        )
        
        return {
            "success": True,
            "billing_history": {
                "id": str(billing_history.id),
                "year": billing_history.year,
                "month": billing_history.month,
                "total_items": billing_history.total_items,
                "total_amount": billing_history.total_amount,
                "status": billing_history.status,
                "created_at": billing_history.created_at.isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating billing history: {str(e)}"
        )


@router.post("/company/{company_id}/generate-all")
async def generate_all_billing_history(
    company_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Generate billing history for all months with activity."""
    
    # Check if user belongs to the company
    user_company = await get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to generate billing for this company"
        )
    
    try:
        billing_records = await generate_all_company_billing_history(company_id)
        
        return {
            "success": True,
            "billing_history": [
                {
                    "id": str(record.id),
                    "year": record.year,
                    "month": record.month,
                    "total_items": record.total_items,
                    "total_amount": record.total_amount,
                    "status": record.status,
                    "created_at": record.created_at.isoformat()
                }
                for record in billing_records
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating billing history: {str(e)}"
        )


@router.get("/company/{company_id}/usage/{year}/{month}")
async def get_monthly_usage(
    company_id: str,
    year: int,
    month: int,
    current_user: User = Depends(get_current_active_user)
):
    """Get monthly usage statistics for a company."""
    
    # Check if user belongs to the company
    user_company = await get_user_company(str(current_user.id))
    if not user_company or str(user_company.id) != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this company's usage"
        )
    
    try:
        usage_data = await calculate_monthly_usage(company_id, year, month)
        
        return {
            "success": True,
            "usage": usage_data
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating usage: {str(e)}"
        )


@router.get("/invoice/{billing_id}/download")
async def download_invoice(
    billing_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Download invoice for a specific billing record."""
    
    try:
        billing_record = await get_billing_history_by_id(billing_id)
        if not billing_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Billing record not found"
            )
        
        # Check if user belongs to the company
        user_company = await get_user_company(str(current_user.id))
        if not user_company or str(user_company.id) != billing_record.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to download this invoice"
            )
        
        if not billing_record.invoice_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice file not available"
            )
        
        # In a real implementation, you would serve the file here
        # For now, return the file information
        return {
            "success": True,
            "invoice_info": {
                "filename": billing_record.invoice_filename,
                "url": billing_record.invoice_url,
                "size": "Generated on demand"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading invoice: {str(e)}"
        ) 