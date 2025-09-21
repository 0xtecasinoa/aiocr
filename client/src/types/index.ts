// Local type definitions (previously from shared/schema)
export interface ExtractedData {
  id: string;
  uploadedFileId?: string;
  conversionJobId?: string;
  folderName?: string;
  productName?: string;
  sku?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  jan_code?: string;
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
}

export interface UpdateExtractedData {
  product_name?: string;
  productName?: string;
  sku?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  jan_code?: string;
  weight?: string;
  color?: string;
  material?: string;
  origin?: string;
  warranty?: string;
  dimensions?: any;
  specifications?: any;
  stock?: number;
  images?: string[];
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