// Local type definitions (previously from shared/schema)
export interface ExtractedData {
  id: string;
  uploadedFileId?: string;
  conversionJobId?: string;
  folderName?: string;
  productName?: string;
  
  // Legacy fields
  sku?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  weight?: string;
  color?: string;
  material?: string;
  origin?: string;
  warranty?: string;
  dimensions?: any;
  specifications?: any;
  stock?: number;
  images?: string[];
  imageUrl?: string;
  
  // 38 Company-Specified Fields
  lot_number?: string;                    // 1. ロット番号
  classification?: string;                // 2. 区分
  major_category?: string;                // 3. 大分類
  minor_category?: string;                // 4. 中分類
  release_date?: string;                  // 5. 発売日
  jan_code?: string;                      // 6. JANコード
  product_code?: string;                  // 7. 商品番号
  in_store?: string;                      // 8. インストア
  genre_name?: string;                    // 9. ジャンル名称
  supplier_name?: string;                 // 10. 仕入先
  ip_name?: string;                       // 11. メーカー名称
  character_name?: string;                // 12. キャラクター名(IP名)
  reference_sales_price?: number;         // 14. 参考販売価格
  wholesale_price?: number;               // 15. 卸単価（抜）
  wholesale_quantity?: number;            // 16. 卸可能数
  order_amount?: number;                  // 18. 発注金額
  quantity_per_pack?: string;             // 19. 入数
  reservation_release_date?: string;      // 20. 予約解禁日
  reservation_deadline?: string;          // 21. 予約締め切り日
  reservation_shipping_date?: string;     // 22. 予約商品発送予定日
  case_pack_quantity?: number;            // 23. ケース梱入数
  single_product_size?: string;           // 24. 単品サイズ
  inner_box_size?: string;                // 25. 内箱サイズ
  carton_size?: string;                   // 26. カートンサイズ
  inner_box_gtin?: string;                // 27. 内箱GTIN
  outer_box_gtin?: string;                // 28. 外箱GTIN
  protective_film_material?: string;      // 30. 機材フィルム
  country_of_origin?: string;             // 31. 原産国
  target_age?: string;                    // 32. 対象年齢
  image1?: string;                        // 33. 画像1
  image2?: string;                        // 34. 画像2
  image3?: string;                        // 35. 画像3
  image4?: string;                        // 36. 画像4
  image5?: string;                        // 37. 画像5
  image6?: string;                        // 38. 画像6
  
  // System fields
  confidence?: number;
  confidence_score?: number;
  rawText?: string;
  extractedAt?: string;
  created_at?: string;
  updated_at?: string;
  userId?: string;
  status?: string;
  is_validated?: boolean;
  needs_review?: boolean;
  validation_notes?: string;
  
  // Multi-product fields
  sourceFileId?: string;
  isMultiProduct?: boolean;
  totalProductsInFile?: number;
  productIndex?: number;
}

export interface UpdateExtractedData {
  product_name?: string;
  productName?: string;
  
  // Legacy fields
  sku?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  weight?: string;
  color?: string;
  material?: string;
  origin?: string;
  warranty?: string;
  dimensions?: any;
  specifications?: any;
  stock?: number;
  images?: string[];
  
  // 38 Company-Specified Fields
  lot_number?: string;
  classification?: string;
  major_category?: string;
  minor_category?: string;
  release_date?: string;
  jan_code?: string;
  product_code?: string;
  in_store?: string;
  genre_name?: string;
  supplier_name?: string;
  ip_name?: string;
  character_name?: string;
  reference_sales_price?: number;
  wholesale_price?: number;
  wholesale_quantity?: number;
  order_amount?: number;
  quantity_per_pack?: string;
  reservation_release_date?: string;
  reservation_deadline?: string;
  reservation_shipping_date?: string;
  case_pack_quantity?: number;
  single_product_size?: string;
  inner_box_size?: string;
  carton_size?: string;
  inner_box_gtin?: string;
  outer_box_gtin?: string;
  protective_film_material?: string;
  country_of_origin?: string;
  target_age?: string;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  image5?: string;
  image6?: string;
  
  // System fields
  is_validated?: boolean;
  validation_notes?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
  userId: number;
}

export interface ConversionJob {
  id: number;
  uploadedFileId: number;
  status: string;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  userId: number;
} 