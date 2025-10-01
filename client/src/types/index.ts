// Local type definitions (previously from shared/schema)
export interface ExtractedData {
  id: string;
  uploadedFileId?: string;
  conversionJobId?: string;
  folderName?: string;
  productName?: string;
  
  // 15 Practical Fields for Japanese Product Specifications
  // 基本情報
  characterName?: string;                 // キャラクター名
  releaseDate?: string;                   // 発売予定日
  productCode?: string;                   // 品番/商品番号
  referenceSalesPrice?: number;           // 希望小売価格
  
  // JANコード/バーコード
  janCode?: string;                       // 単品 JANコード
  innerBoxGtin?: string;                  // BOX/内箱 JANコード
  
  // サイズ情報
  singleProductSize?: string;             // 商品サイズ
  packageSize?: string;                   // パッケージサイズ
  innerBoxSize?: string;                  // 内箱サイズ
  cartonSize?: string;                    // カートンサイズ
  
  // 数量・梱包情報
  quantityPerPack?: string;               // 入数
  casePackQuantity?: number;              // カートン入数/ケース梱入数
  
  // 商品詳細
  packageType?: string;                   // パッケージ形態
  description?: string;                   // セット内容・素材・仕様など
  
  // Legacy fields (for backward compatibility)
  sku?: string;
  price?: number;
  category?: string;
  brand?: string;
  manufacturer?: string;
  stock?: number;
  
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
  
  // 15 Practical Fields for Japanese Product Specifications
  // 基本情報
  characterName?: string;                 // キャラクター名
  releaseDate?: string;                   // 発売予定日
  productCode?: string;                   // 品番/商品番号
  referenceSalesPrice?: number;           // 希望小売価格
  
  // JANコード/バーコード
  janCode?: string;                       // 単品 JANコード
  innerBoxGtin?: string;                  // BOX/内箱 JANコード
  
  // サイズ情報
  singleProductSize?: string;             // 商品サイズ
  packageSize?: string;                   // パッケージサイズ
  innerBoxSize?: string;                  // 内箱サイズ
  cartonSize?: string;                    // カートンサイズ
  
  // 数量・梱包情報
  quantityPerPack?: string;               // 入数
  casePackQuantity?: number;              // カートン入数/ケース梱入数
  
  // 商品詳細
  packageType?: string;                   // パッケージ形態
  description?: string;                   // セット内容・素材・仕様など
  
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