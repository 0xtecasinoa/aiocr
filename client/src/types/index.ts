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
  
  // 38 Company-Specified Fields (camelCase)
  lotNumber?: string;                     // 1. ロット番号
  classification?: string;                // 2. 区分
  majorCategory?: string;                 // 3. 大分類
  minorCategory?: string;                 // 4. 中分類
  releaseDate?: string;                   // 5. 発売日
  janCode?: string;                       // 6. JANコード
  productCode?: string;                   // 7. 商品番号
  inStore?: string;                       // 8. インストア
  genreName?: string;                     // 9. ジャンル名称
  supplierName?: string;                  // 10. 仕入先
  ipName?: string;                        // 11. メーカー名称
  characterName?: string;                 // 12. キャラクター名(IP名)
  referenceSalesPrice?: number;           // 14. 参考販売価格
  wholesalePrice?: number;                // 15. 卸単価（抜）
  wholesaleQuantity?: number;             // 16. 卸可能数
  orderAmount?: number;                   // 18. 発注金額
  quantityPerPack?: string;               // 19. 入数
  reservationReleaseDate?: string;        // 20. 予約解禁日
  reservationDeadline?: string;           // 21. 予約締め切り日
  reservationShippingDate?: string;       // 22. 予約商品発送予定日
  casePackQuantity?: number;              // 23. ケース梱入数
  singleProductSize?: string;             // 24. 単品サイズ
  innerBoxSize?: string;                  // 25. 内箱サイズ
  cartonSize?: string;                    // 26. カートンサイズ
  innerBoxGtin?: string;                  // 27. 内箱GTIN
  outerBoxGtin?: string;                  // 28. 外箱GTIN
  protectiveFilmMaterial?: string;        // 30. 機材フィルム
  countryOfOrigin?: string;               // 31. 原産国
  targetAge?: string;                     // 32. 対象年齢
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
  
  // 38 Company-Specified Fields (camelCase)
  lotNumber?: string;
  classification?: string;
  majorCategory?: string;
  minorCategory?: string;
  releaseDate?: string;
  janCode?: string;
  productCode?: string;
  inStore?: string;
  genreName?: string;
  supplierName?: string;
  ipName?: string;
  characterName?: string;
  referenceSalesPrice?: number;
  wholesalePrice?: number;
  wholesaleQuantity?: number;
  orderAmount?: number;
  quantityPerPack?: string;
  reservationReleaseDate?: string;
  reservationDeadline?: string;
  reservationShippingDate?: string;
  casePackQuantity?: number;
  singleProductSize?: string;
  innerBoxSize?: string;
  cartonSize?: string;
  innerBoxGtin?: string;
  outerBoxGtin?: string;
  protectiveFilmMaterial?: string;
  countryOfOrigin?: string;
  targetAge?: string;
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