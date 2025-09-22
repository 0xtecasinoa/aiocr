// Environment configuration utility
export const env = {
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  
  // Application Configuration
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Conex AI-OCR',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // Debug Configuration
  DEBUG: import.meta.env.VITE_DEBUG === 'true',
  
  // Development Configuration
  DEV_SERVER_PORT: parseInt(import.meta.env.VITE_DEV_SERVER_PORT) || 5173,
  DEV_SERVER_HOST: import.meta.env.VITE_DEV_SERVER_HOST === 'true',
  
  // Check if we're in development mode
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// Helper function to get environment variable with fallback
export const getEnvVar = (key: string, fallback: string = ''): string => {
  return import.meta.env[key] || fallback;
};

// Helper function to get boolean environment variable
export const getBooleanEnvVar = (key: string, fallback: boolean = false): boolean => {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

// Helper function to get number environment variable
export const getNumberEnvVar = (key: string, fallback: number = 0): number => {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
};

export default env;
