from typing import List, Optional
from datetime import datetime
from app.models.billing_history_mongo import BillingHistory
from app.models.conversion_job_mongo import ConversionJob
from app.models.extracted_data_mongo import ExtractedData


async def create_billing_history(billing_data: dict) -> BillingHistory:
    """Create a new billing history record."""
    billing_history = BillingHistory(**billing_data)
    await billing_history.save()
    return billing_history


async def get_company_billing_history(
    company_id: str, 
    year: Optional[int] = None, 
    month: Optional[int] = None
) -> List[BillingHistory]:
    """Get billing history for a specific company."""
    query = {"company_id": company_id}
    
    if year is not None:
        query["year"] = year
    if month is not None:
        query["month"] = month
    
    return await BillingHistory.find(query).sort("-year", "-month").to_list()


async def get_billing_history_by_id(billing_id: str) -> Optional[BillingHistory]:
    """Get billing history by ID."""
    return await BillingHistory.get(billing_id)


async def update_billing_history(billing_id: str, update_data: dict) -> Optional[BillingHistory]:
    """Update billing history record."""
    billing_history = await BillingHistory.get(billing_id)
    if billing_history:
        update_data["updated_at"] = datetime.utcnow()
        await billing_history.update({"$set": update_data})
        return await BillingHistory.get(billing_id)
    return None


async def delete_billing_history(billing_id: str) -> bool:
    """Delete billing history record."""
    billing_history = await BillingHistory.get(billing_id)
    if billing_history:
        await billing_history.delete()
        return True
    return False


async def calculate_monthly_usage(company_id: str, year: int, month: int) -> dict:
    """Calculate actual monthly usage from conversion jobs and extracted data."""
    
    # Calculate total items processed from conversion jobs
    # Find conversion jobs completed in the specified month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year, month + 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # Get conversion jobs for the month
    conversion_jobs = await ConversionJob.find({
        "created_at": {
            "$gte": start_date,
            "$lt": end_date
        },
        "status": "completed"
    }).to_list()
    
    # Calculate total items from extracted data for the month
    extracted_data = await ExtractedData.find({
        "created_at": {
            "$gte": start_date,
            "$lt": end_date
        }
    }).to_list()
    
    total_items = len(extracted_data)
    total_amount = total_items * 10.0  # Assuming 10 yen per item processed
    
    return {
        "total_items": total_items,
        "total_amount": total_amount,
        "conversion_jobs_count": len(conversion_jobs),
        "extracted_data_count": len(extracted_data)
    }


async def calculate_user_monthly_usage(user_id: str, year: int, month: int) -> dict:
    """Calculate actual monthly usage for a specific user from conversion jobs and extracted data."""
    
    # Calculate total items processed from conversion jobs
    # Find conversion jobs completed in the specified month for the specific user
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year, month + 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # Get conversion jobs for the month for the specific user
    conversion_jobs = await ConversionJob.find({
        "user_id": user_id,
        "created_at": {
            "$gte": start_date,
            "$lt": end_date
        },
        "status": "completed"
    }).to_list()
    
    # Calculate total items from extracted data for the month for the specific user
    extracted_data = await ExtractedData.find({
        "user_id": user_id,
        "created_at": {
            "$gte": start_date,
            "$lt": end_date
        }
    }).to_list()
    
    total_items = len(extracted_data)
    total_amount = total_items * 10.0  # Assuming 10 yen per item processed
    
    return {
        "total_items": total_items,
        "total_amount": total_amount,
        "conversion_jobs_count": len(conversion_jobs),
        "extracted_data_count": len(extracted_data)
    }


async def generate_monthly_billing_history(
    company_id: str, 
    year: int, 
    month: int,
    total_items: Optional[int] = None,
    total_amount: Optional[float] = None
) -> BillingHistory:
    """Generate monthly billing history based on actual conversion jobs and data."""
    
    # Check if billing history already exists for this month
    existing_billing = await BillingHistory.find_one({
        "company_id": company_id,
        "year": year,
        "month": month
    })
    
    # Calculate actual usage if not provided
    if total_items is None or total_amount is None:
        usage_data = await calculate_monthly_usage(company_id, year, month)
        total_items = usage_data["total_items"]
        total_amount = usage_data["total_amount"]
    
    if existing_billing:
        # Update existing billing history
        update_data = {
            "total_items": total_items,
            "total_amount": total_amount,
            "updated_at": datetime.utcnow()
        }
        return await update_billing_history(str(existing_billing.id), update_data)
    else:
        # Create new billing history
        billing_data = {
            "company_id": company_id,
            "year": year,
            "month": month,
            "total_items": total_items,
            "total_amount": total_amount,
            "status": "pending"
        }
        return await create_billing_history(billing_data)


async def get_billing_summary(company_id: str) -> dict:
    """Get billing summary for a company."""
    billing_records = await get_company_billing_history(company_id)
    
    total_items = sum(record.total_items for record in billing_records)
    total_amount = sum(record.total_amount for record in billing_records)
    total_invoices = len(billing_records)
    
    return {
        "total_items": total_items,
        "total_amount": total_amount,
        "total_invoices": total_invoices,
        "billing_records": billing_records
    }


async def generate_all_company_billing_history(company_id: str) -> List[BillingHistory]:
    """Generate billing history for all months where the company has activity."""
    
    # Find all months with conversion activity
    conversion_jobs = await ConversionJob.find({
        "status": "completed"
    }).sort("created_at").to_list()
    
    # Group by year and month
    months_with_activity = set()
    for job in conversion_jobs:
        year = job.created_at.year
        month = job.created_at.month
        months_with_activity.add((year, month))
    
    # Generate billing for each month
    billing_records = []
    for year, month in sorted(months_with_activity):
        billing_record = await generate_monthly_billing_history(company_id, year, month)
        billing_records.append(billing_record)
    
    return billing_records 