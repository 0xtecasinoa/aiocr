from beanie import Document
from pydantic import Field, ConfigDict, field_validator
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from bson import ObjectId


class ExtractedData(Document):
    """Extracted data model for MongoDB."""
    
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    # User and job relationship
    user_id: str  # String representation of user ObjectId
    conversion_job_id: Optional[str] = None  # String representation of job ObjectId
    uploaded_file_id: Optional[str] = None  # String representation of uploaded file ObjectId
    folder_name: Optional[str] = None  # Folder name for organizing data
    
    # Enhanced product-specific fields (for OCR extracted product data)
    product_name: Optional[str] = None
    sku: Optional[str] = None
    jan_code: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None
    origin: Optional[str] = None
    warranty: Optional[str] = None
    dimensions: Optional[Union[str, Dict[str, Any]]] = None
    specifications: Optional[Union[str, Dict[str, Any]]] = None
    
    # 38 Company-Specified Fields (完全な38項目)
    lot_number: Optional[str] = None                    # 1. ロット番号
    classification: Optional[str] = None                # 2. 区分
    major_category: Optional[str] = None                # 3. 大分類
    minor_category: Optional[str] = None                # 4. 中分類
    release_date: Optional[str] = None                  # 5. 発売日
    # jan_code already defined above                   # 6. JANコード
    product_code: Optional[str] = None                  # 7. 商品番号
    in_store: Optional[str] = None                      # 8. インストア
    genre_name: Optional[str] = None                    # 9. ジャンル名称
    supplier_name: Optional[str] = None                 # 10. 仕入先
    ip_name: Optional[str] = None                       # 11. メーカー名称
    character_name: Optional[str] = None                # 12. キャラクター名(IP名)
    # product_name already defined above               # 13. 商品名称
    reference_sales_price: Optional[float] = None       # 14. 参考販売価格
    wholesale_price: Optional[float] = None             # 15. 卸単価（抜）
    wholesale_quantity: Optional[int] = None            # 16. 卸可能数
    # stock already defined above                      # 17. 発注数
    order_amount: Optional[float] = None                # 18. 発注金額
    quantity_per_pack: Optional[str] = None             # 19. 入数
    reservation_release_date: Optional[str] = None      # 20. 予約解禁日
    reservation_deadline: Optional[str] = None          # 21. 予約締め切り日
    reservation_shipping_date: Optional[str] = None     # 22. 予約商品発送予定日
    case_pack_quantity: Optional[int] = None            # 23. ケース梱入数
    single_product_size: Optional[str] = None           # 24. 単品サイズ
    inner_box_size: Optional[str] = None                # 25. 内箱サイズ
    carton_size: Optional[str] = None                   # 26. カートンサイズ
    inner_box_gtin: Optional[str] = None                # 27. 内箱GTIN
    outer_box_gtin: Optional[str] = None                # 28. 外箱GTIN
    # description already defined above                # 29. 商品説明
    protective_film_material: Optional[str] = None      # 30. 機材フィルム
    country_of_origin: Optional[str] = None             # 31. 原産国
    target_age: Optional[str] = None                    # 32. 対象年齢
    image1: Optional[str] = None                        # 33. 画像1
    image2: Optional[str] = None                        # 34. 画像2
    image3: Optional[str] = None                        # 35. 画像3
    image4: Optional[str] = None                        # 36. 画像4
    image5: Optional[str] = None                        # 37. 画像5
    image6: Optional[str] = None                        # 38. 画像6
    
    # Legacy fields for backward compatibility
    package_size: Optional[str] = None
    product_size: Optional[str] = None
    packaging_material: Optional[str] = None
    campaign_name: Optional[str] = None
    supplier: Optional[str] = None
    
    # OCR technical fields
    page_number: Optional[int] = None
    raw_text: Optional[str] = None
    structured_data: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    word_confidences: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None  # Accept both dict and list
    bounding_boxes: Optional[List[Dict[str, Any]]] = None
    text_blocks: Optional[List[Dict[str, Any]]] = None
    tables: Optional[List[Dict[str, Any]]] = None
    forms: Optional[List[Dict[str, Any]]] = None
    images: Optional[List[Dict[str, Any]]] = None
    language_detected: Optional[str] = None
    processing_metadata: Optional[Dict[str, Any]] = None
    
    # Multi-product support
    source_file_id: Optional[str] = None  # ID of the source file (for grouping multi-products)
    is_multi_product: bool = False  # Whether this item is part of a multi-product file
    total_products_in_file: Optional[int] = 1  # Total number of products in the source file
    product_index: Optional[int] = None  # Index of this product within the file (1, 2, 3, etc.)
    
    @field_validator('stock', mode='before')
    @classmethod
    def validate_stock(cls, v):
        """Validate stock field - convert empty strings to None."""
        if v == '' or v is None:
            return None
        if isinstance(v, str):
            try:
                return int(v) if v.strip() else None
            except (ValueError, TypeError):
                return None
        return v
    
    @field_validator('price', mode='before')
    @classmethod
    def validate_price(cls, v):
        """Validate price field - convert empty strings to None."""
        if v == '' or v is None:
            return None
        if isinstance(v, str):
            try:
                return float(v) if v.strip() else None
            except (ValueError, TypeError):
                return None
        return v
    
    @field_validator('total_products_in_file', mode='before')
    @classmethod
    def validate_total_products_in_file(cls, v):
        """Validate total_products_in_file field - convert empty strings to None."""
        if v == '' or v is None:
            return 1  # Default to 1
        if isinstance(v, str):
            try:
                return int(v) if v.strip() else 1
            except (ValueError, TypeError):
                return 1
        return v
    
    @field_validator('product_index', mode='before')
    @classmethod
    def validate_product_index(cls, v):
        """Validate product_index field - convert empty strings to None."""
        if v == '' or v is None:
            return None
        if isinstance(v, str):
            try:
                return int(v) if v.strip() else None
            except (ValueError, TypeError):
                return None
        return v
    
    # Review and validation
    needs_review: bool = False
    is_validated: bool = False
    validation_notes: Optional[str] = None
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    status: str = "extracted"  # extracted, validated, reviewed, completed, needs_review
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Settings:
        collection = "extracted_data"
        
    def __repr__(self):
        return f"<ExtractedData {self.id}>" 