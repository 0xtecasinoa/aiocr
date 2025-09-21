import { ExtractedData, User, UploadedFile, ConversionJob } from "../types";

// Mock data
const mockUser: User = {
  id: 1,
  username: "demo_user",
  email: "demo@example.com",
  createdAt: new Date(),
};

const mockExtractedData: ExtractedData[] = [
  {
    id: 1,
    uploadedFileId: 1,
    conversionJobId: 1,
    productName: "Wireless Bluetooth Headphones",
    sku: "WBH-001",
    description: "High-quality wireless headphones with noise cancellation",
    price: 99.99,
    currency: "USD",
    category: "Electronics",
    brand: "TechSound",
    weight: 250,
    dimensions: "20cm x 15cm x 8cm",
    stockQuantity: 50,
    stock: 50,
    images: ["headphones1.jpg", "headphones2.jpg"],
    imageUrl: "headphones1.jpg",
    confidence: 0.95,
    extractedAt: new Date(),
    userId: 1,
    status: "completed",
  },
  {
    id: 2,
    uploadedFileId: 2,
    conversionJobId: 2,
    productName: "Smart Watch Series 5",
    sku: "SW-005",
    description: "Advanced smartwatch with health monitoring features",
    price: 299.99,
    currency: "USD",
    category: "Wearables",
    brand: "SmartTech",
    weight: 45,
    dimensions: "4cm x 4cm x 1cm",
    stockQuantity: 25,
    stock: 25,
    images: ["smartwatch1.jpg"],
    imageUrl: "smartwatch1.jpg",
    confidence: 0.92,
    extractedAt: new Date(),
    userId: 1,
    status: "completed",
  },
];

const mockConversionJobs: ConversionJob[] = [
  {
    id: 1,
    uploadedFileId: 1,
    status: "completed",
    progress: 100,
    startedAt: new Date(Date.now() - 3600000), // 1 hour ago
    completedAt: new Date(Date.now() - 3000000), // 50 minutes ago
    userId: 1,
  },
  {
    id: 2,
    uploadedFileId: 2,
    status: "completed",
    progress: 100,
    startedAt: new Date(Date.now() - 1800000), // 30 minutes ago
    completedAt: new Date(Date.now() - 1200000), // 20 minutes ago
    userId: 1,
  },
];

const mockUploadedFiles: UploadedFile[] = [
  {
    id: 1,
    filename: "product_catalog_1.pdf",
    originalName: "Product Catalog Q1.pdf",
    mimeType: "application/pdf",
    size: 2048000,
    path: "/uploads/product_catalog_1.pdf",
    uploadedAt: new Date(Date.now() - 3600000),
    userId: 1,
  },
  {
    id: 2,
    filename: "inventory_sheet.xlsx",
    originalName: "Inventory Sheet.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 1024000,
    path: "/uploads/inventory_sheet.xlsx",
    uploadedAt: new Date(Date.now() - 1800000),
    userId: 1,
  },
];

// Mock API functions
export const mockApiRequest = async (method: string, endpoint: string, data?: any): Promise<any> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Parse endpoint and return appropriate mock data
  if (endpoint === "/api/auth/login") {
    return { user: mockUser, success: true };
  }
  
  if (endpoint === "/api/auth/register") {
    return { user: mockUser, success: true };
  }
  
  if (endpoint.startsWith("/api/data/user/")) {
    return mockExtractedData;
  }
  
  if (endpoint.startsWith("/api/conversion/user/")) {
    return mockConversionJobs;
  }
  
  if (endpoint.startsWith("/api/files/user/")) {
    return mockUploadedFiles;
  }
  
  if (endpoint === "/api/files/upload") {
    return { 
      success: true, 
      file: {
        ...mockUploadedFiles[0],
        id: Date.now(),
        filename: `uploaded_${Date.now()}.pdf`,
        originalName: data?.get?.('file')?.name || "uploaded_file.pdf",
      }
    };
  }
  
  if (endpoint === "/api/conversion/start") {
    return { 
      success: true, 
      job: {
        ...mockConversionJobs[0],
        id: Date.now(),
        status: "processing",
        progress: 0,
        startedAt: new Date(),
      }
    };
  }
  
  if (endpoint.startsWith("/api/data/") && method === "PUT") {
    return { success: true, data: { ...mockExtractedData[0], ...data } };
  }
  
  if (endpoint === "/api/export/csv") {
    return new Blob(["Product Name,SKU,Price\nWireless Headphones,WBH-001,99.99"], 
      { type: "text/csv" });
  }
  
  return { success: true };
};

// Mock authentication manager
export const mockAuthManager = {
  user: mockUser,
  login: async (email: string, password: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { user: mockUser, success: true };
  },
  register: async (username: string, email: string, password: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { user: mockUser, success: true };
  },
  logout: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  },
  getCurrentUser: () => mockUser,
}; 