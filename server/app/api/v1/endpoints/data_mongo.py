from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
import csv
import io

from app.api.v1.endpoints.auth_mongo import get_current_active_user
from app.models.user_mongo import User
from app.models.extracted_data_mongo import ExtractedData

router = APIRouter()

# CSV出力用のフォーマット定義
CSV_FORMATS = {
    "shopify": {
        "headers": ["ハンドル", "商品名", "商品説明 (HTML)", "ベンダー", "商品カテゴリ", "タイプ", "タグ", "公開", "オプション1名", "オプション1値", "バリエーションSKU", "バリエーション重量(g)", "在庫トラッカー", "在庫数", "在庫ポリシー", "配送サービス", "価格", "比較価格", "配送必要", "課税対象", "バーコード", "画像URL", "画像位置", "画像ALTテキスト", "ギフトカード", "SEOタイトル", "SEO説明", "Googleショッピング/商品カテゴリ", "Googleショッピング/性別", "Googleショッピング/年齢層", "Googleショッピング/MPN", "Googleショッピング/AdWordsグループ", "Googleショッピング/AdWordsラベル", "Googleショッピング/状態", "Googleショッピング/カスタム商品", "Googleショッピング/カスタムラベル0", "Googleショッピング/カスタムラベル1", "Googleショッピング/カスタムラベル2", "Googleショッピング/カスタムラベル3", "Googleショッピング/カスタムラベル4", "バリエーション画像", "バリエーション重量単位", "バリエーション税コード", "商品単価", "ステータス"],
        "mapping": lambda item: [
            item.get("sku", ""),
            item.get("productName", ""),
            item.get("description", ""),
            item.get("brand", ""),
            item.get("category", ""),
            item.get("category", ""),
            "",
            "TRUE",
            "Title",
            "Default Title",
            item.get("sku", ""),
            "0",
            "shopify",
            str(item.get("stock", 0)),
            "deny",
            "manual",
            str(item.get("price", 0)),
            "",
            "TRUE",
            "TRUE",
            item.get("jan_code", ""),
            "",
            "",
            "",
            "FALSE",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "active"
        ]
    },
    "magento": {
        "headers": ["SKU", "商品名", "商品説明", "短い説明", "重量", "価格", "特別価格", "特別価格開始日", "特別価格終了日", "ステータス", "表示設定", "税クラスID", "属性セットコード", "商品タイプ", "カテゴリ", "商品ウェブサイト", "色", "原価", "製造国", "作成日", "カスタムデザイン", "カスタムデザイン開始", "カスタムデザイン終了", "カスタムレイアウト更新", "ギフトメッセージ利用可", "オプション有り", "画像", "画像ラベル", "返品可能", "製造元", "メタ説明", "メタキーワード", "メタタイトル", "最小価格", "希望小売価格", "MSRP表示タイプ", "ニュース開始日", "ニュース終了日", "オプションコンテナ", "ページレイアウト", "価格タイプ", "価格表示", "必須オプション", "配送タイプ", "短い説明", "小画像", "小画像ラベル", "特別価格開始日", "特別価格終了日", "サムネイル", "サムネイルラベル", "段階価格", "更新日", "URLキー", "URLパス", "重量タイプ", "数量", "最小数量", "設定最小数量使用", "数量小数点", "バックオーダー", "設定バックオーダー使用", "最小販売数量", "設定最小販売数量使用", "最大販売数量", "設定最大販売数量使用", "在庫有り", "在庫通知数量", "設定在庫通知数量使用", "在庫管理", "設定在庫管理使用", "在庫ステータス自動変更", "設定数量増分使用", "数量増分", "設定数量増分有効使用", "数量増分有効", "小数分割"],
        "mapping": lambda item: [
            item.get("sku", ""),
            item.get("productName", ""),
            item.get("description", ""),
            item.get("description", "")[:100] if item.get("description") else "",
            item.get("weight", ""),
            str(item.get("price", 0)),
            "",
            "",
            "",
            "1",
            "4",
            "2",
            "Default",
            "simple",
            item.get("category", ""),
            "base",
            item.get("color", ""),
            "",
            item.get("origin", ""),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "",
            "",
            "",
            "",
            "",
            "0",
            "",
            "",
            "2",
            item.get("manufacturer", ""),
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Product Info Column",
            "",
            "0",
            "0",
            "0",
            "0",
            item.get("description", "")[:100] if item.get("description") else "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "",
            "",
            "0",
            str(item.get("stock", 0)),
            "1",
            "1",
            "0",
            "0",
            "1",
            "1",
            "1",
            "10000",
            "1",
            "1",
            "1",
            "1",
            "1",
            "0",
            "1",
            "0",
            "1",
            "0",
            "0"
        ]
    },
    "ec_cube": {
        "headers": ["商品ID", "商品名", "商品カナ", "商品説明(一覧)", "商品説明(詳細)", "商品コード", "通常価格", "販売価格", "在庫数", "在庫数無制限フラグ", "販売制限数", "カテゴリID", "商品種別ID", "規格1(名称)", "規格1(値)", "規格2(名称)", "規格2(値)", "商品画像", "商品詳細画像", "フリーエリア", "検索ワード", "メーカーURL", "商品ステータス", "商品削除フラグ", "作成日", "更新日", "メモ", "確認URL"],
        "mapping": lambda item: [
            "",
            item.get("productName", ""),
            "",
            item.get("description", "")[:100] if item.get("description") else "",
            item.get("description", ""),
            item.get("sku", ""),
            str(item.get("price", 0)),
            str(item.get("price", 0)),
            str(item.get("stock", 0)),
            "0",
            "",
            "",
            "1",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "1",
            "0",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "",
            ""
        ]
    },
    "raw": {
        "headers": ["ID", "商品名", "SKU", "価格", "在庫", "カテゴリ", "説明", "ブランド", "製造元", "JANコード", "重量", "色", "素材", "原産地", "保証", "信頼度", "ステータス", "作成日", "更新日"],
        "mapping": lambda item: [
            item.get("id", ""),
            item.get("productName", ""),
            item.get("sku", ""),
            str(item.get("price", 0)) if item.get("price") else "",
            str(item.get("stock", 0)) if item.get("stock") else "",
            item.get("category", ""),
            item.get("description", ""),
            item.get("brand", ""),
            item.get("manufacturer", ""),
            item.get("jan_code", ""),
            item.get("weight", ""),
            item.get("color", ""),
            item.get("material", ""),
            item.get("origin", ""),
            item.get("warranty", ""),
            str(item.get("confidence_score", 0)) if item.get("confidence_score") else "",
            item.get("status", ""),
            item.get("created_at", ""),
            item.get("updated_at", "")
        ]
    }
}


@router.get("/debug/count")
async def debug_count_data(
    current_user: User = Depends(get_current_active_user)
):
    """Debug endpoint to count total extracted data."""
    
    total_count = await ExtractedData.find().count()
    user_count = await ExtractedData.find(ExtractedData.user_id == str(current_user.id)).count()
    
    # Get a sample of data
    sample_data = await ExtractedData.find(ExtractedData.user_id == str(current_user.id)).limit(3).to_list()
    sample_info = []
    for item in sample_data:
        sample_info.append({
            "id": str(item.id),
            "user_id": item.user_id,
            "product_name": item.product_name,
            "raw_text_length": len(item.raw_text or ""),
            "confidence": item.confidence_score,
            "status": item.status
        })
    
    return {
        "total_count": total_count,
        "user_count": user_count,
        "current_user_id": str(current_user.id),
        "sample_data": sample_info
    }


@router.get("/debug/all")
async def debug_all_data():
    """Debug endpoint to get all extracted data without authentication."""
    
    total_count = await ExtractedData.find().count()
    
    # Get all data for the known user
    user_id = "68b90a266bafd493bf7e5b0b"
    extracted_data = await ExtractedData.find(ExtractedData.user_id == user_id).limit(10).to_list()
    
    # Convert to frontend format
    data_list = []
    for item in extracted_data:
        data_list.append({
            "id": str(item.id),
            "productName": item.product_name or f"File_{str(item.id)[-8:]}",
            "sku": item.sku or "",
            "price": item.price,
            "stock": item.stock,
            "category": item.category or "",
            "brand": getattr(item, 'brand', None),
            "manufacturer": getattr(item, 'manufacturer', None),
            "jan_code": getattr(item, 'jan_code', None),
            "weight": getattr(item, 'weight', None),
            "color": getattr(item, 'color', None),
            "material": getattr(item, 'material', None),
            "origin": getattr(item, 'origin', None),
            "warranty": getattr(item, 'warranty', None),
            "dimensions": getattr(item, 'dimensions', None),
            "specifications": getattr(item, 'specifications', None),
            "description": item.description or "",
            "confidence_score": item.confidence_score,
            "status": item.status,
            "rawText": (item.raw_text[:200] + "..." if item.raw_text and len(item.raw_text) > 200 else item.raw_text) or "",
            "uploadedFileId": getattr(item, 'uploaded_file_id', None),
            "conversionJobId": item.conversion_job_id,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
            "is_validated": getattr(item, 'is_validated', False),
            "needs_review": getattr(item, 'needs_review', False)
        })
    
    return {
        "data": data_list,
        "total_count": total_count,
        "user_count": len(data_list),
        "debug_user_id": user_id
    }


@router.get("/")
async def list_extracted_data(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user)
):
    """List user's extracted data."""
    
    # Query extracted data for current user
    extracted_data = await ExtractedData.find(
        ExtractedData.user_id == str(current_user.id)
    ).skip(skip).limit(limit).to_list()
    
    # Debug logging
    print(f"DEBUG: User {current_user.id} requesting data")
    print(f"DEBUG: Found {len(extracted_data)} extracted data items")
    
    # Convert to frontend format
    data_list = []
    for item in extracted_data:
        data_list.append({
            "id": str(item.id),
            "productName": item.product_name or f"File_{item.uploaded_file_id[:8]}" if item.uploaded_file_id else "Unknown",
            "sku": item.sku,
            "price": item.price,
            "stock": item.stock,
            "category": item.category,
            "description": item.description,
            "confidence_score": item.confidence_score,
            "status": item.status,
            "rawText": item.raw_text[:200] + "..." if item.raw_text and len(item.raw_text) > 200 else item.raw_text,
            "uploadedFileId": item.uploaded_file_id,
            "conversionJobId": item.conversion_job_id,
            "folderName": getattr(item, 'folder_name', None),
            "brand": getattr(item, 'brand', None),
            "manufacturer": getattr(item, 'manufacturer', None),
            "jan_code": getattr(item, 'jan_code', None),
            "weight": getattr(item, 'weight', None),
            "color": getattr(item, 'color', None),
            "material": getattr(item, 'material', None),
            "origin": getattr(item, 'origin', None),
            "warranty": getattr(item, 'warranty', None),
            "dimensions": getattr(item, 'dimensions', None),
            "specifications": getattr(item, 'specifications', None),
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })
    
    print(f"DEBUG: Returning {len(data_list)} items")
    return {"data": data_list}


@router.get("/user/{user_id}")
async def get_user_extracted_data(
    user_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user)
):
    """Get extracted data for a specific user (matches frontend API call)."""
    
    # Check if user is requesting their own data or is admin
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this data"
        )
    
    # Query extracted data for specified user
    extracted_data = await ExtractedData.find(
        ExtractedData.user_id == user_id
    ).skip(skip).limit(limit).to_list()
    
    # Debug logging
    print(f"DEBUG: User {current_user.id} requesting data for user {user_id}")
    print(f"DEBUG: Found {len(extracted_data)} extracted data items for user {user_id}")
    
    # Convert to frontend format
    data_list = []
    for item in extracted_data:
        data_list.append({
            "id": str(item.id),
            "productName": item.product_name or f"File_{item.uploaded_file_id[:8]}" if item.uploaded_file_id else "Unknown",
            "sku": item.sku,
            "price": item.price,
            "stock": item.stock,
            "category": item.category,
            "description": item.description,
            "confidence_score": item.confidence_score,
            "status": item.status,
            "rawText": item.raw_text[:200] + "..." if item.raw_text and len(item.raw_text) > 200 else item.raw_text,
            "uploadedFileId": item.uploaded_file_id,
            "conversionJobId": item.conversion_job_id,
            "folderName": getattr(item, 'folder_name', None),
            "brand": getattr(item, 'brand', None),
            "manufacturer": getattr(item, 'manufacturer', None),
            "jan_code": getattr(item, 'jan_code', None),
            "weight": getattr(item, 'weight', None),
            "color": getattr(item, 'color', None),
            "material": getattr(item, 'material', None),
            "origin": getattr(item, 'origin', None),
            "warranty": getattr(item, 'warranty', None),
            "dimensions": getattr(item, 'dimensions', None),
            "specifications": getattr(item, 'specifications', None),
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })
    
    print(f"DEBUG: Returning {len(data_list)} items for user {user_id}")
    return {"data": data_list}


@router.get("/user/{user_id}/folders")
async def get_user_data_by_folders(
    user_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get extracted data organized by folders for a specific user."""
    
    # Check if user is requesting their own data or is admin
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this data"
        )
    
    try:
        # Get all extracted data for the user
        extracted_data = await ExtractedData.find(
            ExtractedData.user_id == user_id
        ).to_list()
        
        # Organize by folders/categories
        folders = {}
        for item in extracted_data:
            category = item.category or "未分類"
            if category not in folders:
                folders[category] = []
            
            folders[category].append({
                "id": str(item.id),
                "productName": item.product_name,
                "sku": item.sku,
                "price": item.price,
                "stock": item.stock,
                "category": item.category,
                "description": item.description,
                "confidence_score": item.confidence_score,
                "status": item.status,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None,
            })
        
        return {
            "success": True,
            "folders": folders,
            "total_items": len(extracted_data)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving data by folders: {str(e)}"
        )


@router.get("/{data_id}")
async def get_extracted_data(
    data_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get specific extracted data."""
    
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(data_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data ID format"
            )
        
        # Find the data item
        data_item = await ExtractedData.get(ObjectId(data_id))
        if not data_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data not found"
            )
        
        # Check if user owns this data or is admin
        if data_item.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this data"
            )
        
        return {
            "id": str(data_item.id),
            "productName": data_item.product_name,
            "sku": data_item.sku,
            "price": data_item.price,
            "stock": data_item.stock,
            "category": data_item.category,
            "description": data_item.description,
            "confidence_score": data_item.confidence_score,
            "status": data_item.status,
            "raw_text": data_item.raw_text,
            "created_at": data_item.created_at.isoformat() if data_item.created_at else None,
            "updated_at": data_item.updated_at.isoformat() if data_item.updated_at else None,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving data: {str(e)}"
        )


@router.put("/{data_id}")
async def update_extracted_data(
    data_id: str,
    data_update: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Update extracted data (matches frontend PUT call)."""
    
    try:
        # デバッグログ
        print(f"DEBUG: Updating data {data_id}")
        print(f"DEBUG: Update data received: {data_update}")
        print(f"DEBUG: User: {current_user.id}")
        
        # Validate ObjectId format
        if not ObjectId.is_valid(data_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data ID format"
            )
        
        # Find the data item
        data_item = await ExtractedData.get(ObjectId(data_id))
        if not data_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data not found"
            )
        
        # Check if user owns this data or is admin
        if data_item.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this data"
            )
        
        # Update fields
        update_fields = {}
        if "product_name" in data_update:
            update_fields["product_name"] = data_update["product_name"]
        if "productName" in data_update:  # 互換性のため両方対応
            update_fields["product_name"] = data_update["productName"]
        if "sku" in data_update:
            update_fields["sku"] = data_update["sku"]
        if "price" in data_update:
            update_fields["price"] = data_update["price"]
        if "stock" in data_update:
            update_fields["stock"] = data_update["stock"]
        if "category" in data_update:
            update_fields["category"] = data_update["category"]
        if "description" in data_update:
            update_fields["description"] = data_update["description"]
        
        # 新しいフィールドを追加
        if "brand" in data_update:
            update_fields["brand"] = data_update["brand"]
        if "manufacturer" in data_update:
            update_fields["manufacturer"] = data_update["manufacturer"]
        if "jan_code" in data_update:
            update_fields["jan_code"] = data_update["jan_code"]
        if "weight" in data_update:
            update_fields["weight"] = data_update["weight"]
        if "color" in data_update:
            update_fields["color"] = data_update["color"]
        if "material" in data_update:
            update_fields["material"] = data_update["material"]
        if "origin" in data_update:
            update_fields["origin"] = data_update["origin"]
        if "warranty" in data_update:
            update_fields["warranty"] = data_update["warranty"]
        if "is_validated" in data_update:
            update_fields["is_validated"] = data_update["is_validated"]
        
        print(f"DEBUG: Fields to update: {update_fields}")
        
        if update_fields:
            update_fields["updated_at"] = datetime.utcnow()
            await data_item.update({"$set": update_fields})
            print(f"DEBUG: Data updated successfully")
        else:
            print(f"DEBUG: No fields to update")
        
        return {"success": True, "message": "Data updated successfully"}
        
    except Exception as e:
        print(f"DEBUG: Error updating data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating data: {str(e)}"
        )


@router.post("/{data_id}/validate")
async def validate_data(
    data_id: str,
    validation_notes: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Validate extracted data."""
    
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(data_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data ID format"
            )
        
        # Find the data item
        data_item = await ExtractedData.get(ObjectId(data_id))
        if not data_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Data not found"
            )
        
        # Check if user owns this data or is admin
        if data_item.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to validate this data"
            )
        
        # Update validation status
        await data_item.update({
            "$set": {
                "status": "validated",
                "validation_notes": validation_notes,
                "validated_by": str(current_user.id),
                "validated_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        })
        
        return {"success": True, "message": "Data validated successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating data: {str(e)}"
        )


@router.get("/export/csv")
async def export_data_to_csv(
    format: str = "raw",
    current_user: User = Depends(get_current_active_user)
):
    """Export extracted data to CSV format."""
    
    try:
        # Validate format
        if format not in CSV_FORMATS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format. Available formats: {list(CSV_FORMATS.keys())}"
            )
        
        # Get user's extracted data
        extracted_data = await ExtractedData.find(
            ExtractedData.user_id == str(current_user.id)
        ).to_list()
        
        if not extracted_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data found for export"
            )
        
        # Prepare CSV data
        format_config = CSV_FORMATS[format]
        headers = format_config["headers"]
        mapping_func = format_config["mapping"]
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow(headers)
        
        # Write data rows
        for item in extracted_data:
            item_dict = {
                "id": str(item.id),
                "productName": item.product_name or f"File_{item.uploaded_file_id[:8]}" if item.uploaded_file_id else "Unknown",
                "sku": item.sku,
                "price": item.price,
                "stock": item.stock,
                "category": item.category,
                "description": item.description,
                "brand": getattr(item, 'brand', ''),
                "manufacturer": getattr(item, 'manufacturer', ''),
                "jan_code": getattr(item, 'jan_code', ''),
                "weight": getattr(item, 'weight', ''),
                "color": getattr(item, 'color', ''),
                "material": getattr(item, 'material', ''),
                "origin": getattr(item, 'origin', ''),
                "warranty": getattr(item, 'warranty', ''),
                "confidence_score": item.confidence_score,
                "status": item.status,
                "created_at": item.created_at.isoformat() if item.created_at else "",
                "updated_at": item.updated_at.isoformat() if item.updated_at else ""
            }
            
            row_data = mapping_func(item_dict)
            writer.writerow(row_data)
        
        # Prepare response
        csv_content = output.getvalue()
        output.close()
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"extracted_data_{format}_{timestamp}.csv"
        
        # Return CSV file
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8-sig')),  # UTF-8 BOM for Excel compatibility
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting data: {str(e)}"
        ) 