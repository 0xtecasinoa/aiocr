from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
import csv
import io
import json

from app.api.v1.endpoints.auth_mongo import get_current_active_user
from app.models.user_mongo import User
from app.models.extracted_data_mongo import ExtractedData

router = APIRouter()


@router.get("/csv")
async def export_data_as_csv(
    data_ids: Optional[str] = None,  # Comma-separated list of data IDs
    current_user: User = Depends(get_current_active_user)
):
    """Export extracted data as CSV (matches frontend API call)."""
    
    try:
        # Determine which data to export
        if data_ids:
            # Export specific data items
            id_list = [id.strip() for id in data_ids.split(",")]
            
            # Validate ObjectId formats
            for data_id in id_list:
                if not ObjectId.is_valid(data_id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid data ID format: {data_id}"
                    )
            
            # Find the specific data items
            extracted_data = []
            for data_id in id_list:
                data_item = await ExtractedData.get(ObjectId(data_id))
                if data_item and (data_item.user_id == str(current_user.id) or current_user.is_admin):
                    extracted_data.append(data_item)
        else:
            # Export all user's data
            extracted_data = await ExtractedData.find(
                ExtractedData.user_id == str(current_user.id)
            ).to_list()
        
        if not extracted_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data found to export"
            )
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        headers = [
            "ID",
            "商品名",
            "SKU",
            "価格",
            "在庫数",
            "カテゴリ",
            "商品説明",
            "信頼度スコア",
            "ステータス",
            "作成日",
            "更新日"
        ]
        writer.writerow(headers)
        
        # Write data rows
        for item in extracted_data:
            row = [
                str(item.id),
                item.product_name or "",
                item.sku or "",
                item.price or "",
                item.stock or "",
                item.category or "",
                item.description or "",
                item.confidence_score or "",
                item.status or "",
                item.created_at.isoformat() if item.created_at else "",
                item.updated_at.isoformat() if item.updated_at else ""
            ]
            writer.writerow(row)
        
        csv_content = output.getvalue()
        output.close()
        
        # Return CSV file
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=extracted_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting CSV: {str(e)}"
        )


@router.get("/json")
async def export_data_as_json(
    data_ids: Optional[str] = None,  # Comma-separated list of data IDs
    current_user: User = Depends(get_current_active_user)
):
    """Export extracted data as JSON."""
    
    try:
        # Determine which data to export
        if data_ids:
            # Export specific data items
            id_list = [id.strip() for id in data_ids.split(",")]
            
            # Validate ObjectId formats
            for data_id in id_list:
                if not ObjectId.is_valid(data_id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid data ID format: {data_id}"
                    )
            
            # Find the specific data items
            extracted_data = []
            for data_id in id_list:
                data_item = await ExtractedData.get(ObjectId(data_id))
                if data_item and (data_item.user_id == str(current_user.id) or current_user.is_admin):
                    extracted_data.append(data_item)
        else:
            # Export all user's data
            extracted_data = await ExtractedData.find(
                ExtractedData.user_id == str(current_user.id)
            ).to_list()
        
        if not extracted_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data found to export"
            )
        
        # Convert to JSON format
        data_list = []
        for item in extracted_data:
            data_list.append({
                "id": str(item.id),
                "productName": item.product_name,
                "sku": item.sku,
                "price": item.price,
                "stock": item.stock,
                "category": item.category,
                "description": item.description,
                "confidenceScore": item.confidence_score,
                "status": item.status,
                "rawText": item.raw_text,
                "createdAt": item.created_at.isoformat() if item.created_at else None,
                "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
            })
        
        export_data = {
            "exportedAt": datetime.utcnow().isoformat(),
            "totalRecords": len(data_list),
            "exportedBy": str(current_user.id),
            "data": data_list
        }
        
        json_content = json.dumps(export_data, ensure_ascii=False, indent=2)
        
        # Return JSON file
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=extracted_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting JSON: {str(e)}"
        )


@router.get("/excel")
async def export_data_as_excel(
    data_ids: Optional[str] = None,  # Comma-separated list of data IDs
    current_user: User = Depends(get_current_active_user)
):
    """Export extracted data as Excel file."""
    
    try:
        # This would require openpyxl or xlsxwriter
        # For now, return a message indicating the feature is planned
        return {
            "message": "Excel export feature is planned for future implementation",
            "suggestion": "Please use CSV export for now, which can be opened in Excel"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting Excel: {str(e)}"
        )


@router.get("/stats")
async def get_export_stats(
    current_user: User = Depends(get_current_active_user)
):
    """Get statistics about exportable data."""
    
    try:
        # Get total count of user's data
        total_count = await ExtractedData.find(
            ExtractedData.user_id == str(current_user.id)
        ).count()
        
        # Get count by status
        status_counts = {}
        for status_val in ["completed", "needs_review", "processing", "failed"]:
            count = await ExtractedData.find({
                "user_id": str(current_user.id),
                "status": status_val
            }).count()
            status_counts[status_val] = count
        
        # Get recent data count (last 30 days)
        thirty_days_ago = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        thirty_days_ago = thirty_days_ago.replace(day=thirty_days_ago.day - 30 if thirty_days_ago.day > 30 else 1)
        
        recent_count = await ExtractedData.find({
            "user_id": str(current_user.id),
            "created_at": {"$gte": thirty_days_ago}
        }).count()
        
        return {
            "totalRecords": total_count,
            "statusBreakdown": status_counts,
            "recentRecords": recent_count,
            "availableFormats": ["csv", "json"],
            "plannedFormats": ["excel"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting export stats: {str(e)}"
        ) 