// Real API client for backend communication
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  username: string; // Can be email or username
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface RegisterWithCompanyRequest {
  username: string;
  email: string;
  password: string;
  company_name: string;
  company_name_furigana: string;
  person_in_charge: string;
  person_in_charge_furigana: string;
  phone_number: string;
}

export interface ProvisionalUserCreate {
  email: string;
  company_name: string;
  company_name_furigana: string;
  person_in_charge: string;
  person_in_charge_furigana: string;
  phone_number: string;
}

export interface ProvisionalUserResponse {
  id: string;
  email: string;
  company_name: string;
  company_name_furigana: string;
  person_in_charge: string;
  person_in_charge_furigana: string;
  phone_number: string;
  is_verified: boolean;
  expires_at: string;
  created_at: string;
}

export interface Company {
  id: string;
  company_name: string;
  company_name_furigana: string;
  representative_user_id: string;
  members: string[];
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CompanyMember {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    is_active: boolean;
    is_admin: boolean;
    company_id?: string;
    role?: string;
    permissions?: string[];
    created_at: string;
    ocr_usage_this_month?: number;
    ocr_usage_last_month?: number;
    last_ocr_usage?: string;
    profile_image?: string;
    last_login?: string;
  };
}

class ApiClient {
  private _baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this._baseUrl = baseUrl;
    this.loadTokensFromStorage();
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private loadTokensFromStorage() {
    this.accessToken = localStorage.getItem("access_token");
    this.refreshToken = localStorage.getItem("refresh_token");
  }

  private saveTokensToStorage(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
  }

  private clearTokensFromStorage() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    requiresAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {};

    if (requiresAuth && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const config: RequestInit = {
      method,
      headers,
      mode: 'cors',
    };

    if (data) {
      if (method === "POST" && endpoint.includes("/login")) {
        // OAuth2 form data for login
        const formData = new URLSearchParams();
        formData.append("username", data.username);
        formData.append("password", data.password);
        config.body = formData;
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      } else if (data instanceof FormData) {
        // File upload - don't set Content-Type, let browser set it with boundary
        config.body = data;
      } else {
        // JSON data
        headers["Content-Type"] = "application/json";
        config.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401 && requiresAuth) {
          // Try to refresh token
          await this.refreshAccessToken();
          // Retry the request with new token
          if (this.accessToken) {
            headers["Authorization"] = `Bearer ${this.accessToken}`;
            const retryResponse = await fetch(url, { ...config, headers });
            if (!retryResponse.ok) {
              throw new Error(`HTTP ${retryResponse.status}: ${retryResponse.statusText}`);
            }
            return await retryResponse.json();
          }
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error occurred");
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.makeRequest<AuthResponse>(
      "POST",
      "/api/v1/auth/login",
      { username: email, password }
    );
    
    this.saveTokensToStorage(response.access_token, response.refresh_token);
    return response;
  }

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    const registerData: RegisterRequest = {
      username,
      email,
      password,
    };
    
    // First register the user
    await this.makeRequest("POST", "/api/v1/auth/register", registerData);
    
    // Then login to get tokens
    return await this.login(email, password);
  }

  async registerWithCompany(userData: RegisterWithCompanyRequest): Promise<AuthResponse> {
    // First register the user with company
    await this.makeRequest("POST", "/api/v1/auth/register-with-company", userData);
    
    // Then login to get tokens
    return await this.login(userData.email, userData.password);
  }

  async provisionalRegister(userData: ProvisionalUserCreate): Promise<ProvisionalUserResponse> {
    return await this.makeRequest<ProvisionalUserResponse>(
      "POST",
      "/api/v1/auth/provisional-register",
      userData
    );
  }

  async verifyEmail(verificationToken: string): Promise<any> {
    return await this.makeRequest(
      "POST",
      "/api/v1/auth/verify-email",
      { verification_token: verificationToken }
    );
  }

  async completeRegistration(verificationToken: string, username: string, password: string): Promise<AuthResponse> {
    const registrationData = {
      verification_token: verificationToken,
      username,
      password,
    };
    
    // Complete the registration
    const user = await this.makeRequest<{email: string}>("POST", "/api/v1/auth/complete-registration", registrationData);
    
    // Then login to get tokens
    return await this.login(user.email, password);
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      this.clearTokensFromStorage();
      throw new Error("No refresh token available");
    }

    try {
      const response = await this.makeRequest<AuthResponse>(
        "POST",
        "/api/v1/auth/refresh",
        { refresh_token: this.refreshToken }
      );
      
      this.saveTokensToStorage(response.access_token, response.refresh_token);
    } catch (error) {
      this.clearTokensFromStorage();
      throw error;
    }
  }

  async getCurrentUser() {
    return await this.makeRequest("GET", "/api/v1/auth/me", null, true);
  }

  // Company management methods
  async getMyCompany(): Promise<Company> {
    return await this.makeRequest<Company>("GET", "/api/v1/companies/my-company", null, true);
  }

  async getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    return await this.makeRequest<CompanyMember[]>("GET", `/api/v1/companies/${companyId}/members`, null, true);
  }

  async inviteCompanyMember(companyId: string, memberData: { email: string; username: string; role: string }): Promise<any> {
    return await this.makeRequest("POST", `/api/v1/companies/${companyId}/members`, memberData, true);
  }

  async removeCompanyMember(companyId: string, memberId: string): Promise<any> {
    return await this.makeRequest("DELETE", `/api/v1/companies/${companyId}/members/${memberId}`, null, true);
  }

  async updateMemberRole(companyId: string, memberId: string, role: string): Promise<any> {
    return await this.makeRequest("PUT", `/api/v1/companies/${companyId}/members/${memberId}/role`, { role }, true);
  }

  // File management methods
  async uploadFiles(files: File[], folderName?: string): Promise<any> {
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    if (folderName) {
      formData.append('folder_name', folderName);
    }
    
    console.log('Uploading files:', files.length, 'folder:', folderName);
    
    return this.makeRequest('POST', '/api/v1/files/upload-multiple', formData, true);
  }

  async getUserFiles(userId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/files/user/${userId}`, null, true);
  }

  async getUserFolders(userId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/files/user/${userId}/folders`, null, true);
  }

  async getUserItems(userId: string, page: number = 1, limit: number = 20): Promise<any> {
    return this.makeRequest('GET', `/api/v1/files/user/${userId}/items?page=${page}&limit=${limit}`, null, true);
  }

  async getFiles(): Promise<any[]> {
    return await this.makeRequest("GET", "/api/v1/files", null, true);
  }

  async updateFile(fileId: string, updateData: any): Promise<any> {
    return await this.makeRequest("PUT", `/api/v1/files/${fileId}`, updateData, true);
  }

  // Delete a file
  async deleteFile(fileId: string): Promise<any> {
    const response = await this.makeRequest("DELETE", `/api/v1/files/${fileId}`, null, true);
    return response;
  }

  async updateFolder(folderId: string, updateData: any): Promise<any> {
    return await this.makeRequest("PUT", `/api/v1/files/folders/${folderId}`, updateData, true);
  }

  // Delete a folder and all its files
  async deleteFolder(folderName: string): Promise<any> {
    const response = await this.makeRequest("DELETE", `/api/v1/files/folder/${folderName}`, null, true);
    return response;
  }

  async logout() {
    try {
      await this.makeRequest("POST", "/api/v1/auth/logout", null, true);
    } catch (error) {
      // Ignore errors on logout
    } finally {
      this.clearTokensFromStorage();
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // User profile methods
  async getUserProfile() {
    return await this.makeRequest("GET", "/api/v1/auth/profile", null, true);
  }

  async updateUserProfile(profileData: any) {
    return await this.makeRequest("PUT", "/api/v1/auth/profile", profileData, true);
  }

  // Generic request method for use with React Query
  async request<T>(method: string, url: string, data?: any): Promise<T> {
    return await this.makeRequest<T>(method, url, data, true);
  }

  // Conversion methods
  async startConversion(conversionData: any): Promise<any> {
    return this.makeRequest('POST', '/api/v1/conversion/start', conversionData, true);
  }

  async startConversionWithFolders(conversionData: any): Promise<any> {
    return this.makeRequest('POST', '/api/v1/conversion/start-with-folders', conversionData, true);
  }

  async startConversionWithFiles(conversionData: any): Promise<any> {
    return this.makeRequest('POST', '/api/v1/conversion/start-with-files', conversionData, true);
  }

  async getConversionJobs(userId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/conversion/user/${userId}`, null, true);
  }

  async deleteConversionJob(jobId: string): Promise<any> {
    return this.makeRequest('DELETE', `/api/v1/conversion/${jobId}`, null, true);
  }

  async retryConversionJob(jobId: string): Promise<any> {
    return this.makeRequest('POST', `/api/v1/conversion/${jobId}/retry`, null, true);
  }

  async cancelConversionJob(jobId: string): Promise<any> {
    return this.makeRequest('POST', `/api/v1/conversion/${jobId}/cancel`, null, true);
  }

  async getConversionJobDetails(jobId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/conversion/${jobId}`, null, true);
  }

  async deleteUserConversionJobs(userId: string, jobIds: string[]): Promise<any> {
    return this.makeRequest('DELETE', `/api/v1/conversion/user/${userId}/bulk`, { job_ids: jobIds }, true);
  }

  async deleteUserConversionJobsWithQuery(userId: string, jobIds: string[]): Promise<any> {
    const queryParams = jobIds.map(id => `job_ids=${encodeURIComponent(id)}`).join('&');
    return this.makeRequest('DELETE', `/api/v1/conversion/user/${userId}/bulk?${queryParams}`, null, true);
  }

  // Billing history methods
  async getCompanyBillingHistory(companyId: string, year?: number, month?: number): Promise<any> {
    let url = `/api/v1/billing-history/company/${companyId}`;
    if (year || month) {
      const params = new URLSearchParams();
      if (year) params.append('year', year.toString());
      if (month) params.append('month', month.toString());
      url += `?${params.toString()}`;
    }
    return this.makeRequest('GET', url, null, true);
  }

  async getUserBillingHistory(userId: string, year?: number, month?: number): Promise<any> {
    let url = `/api/v1/billing-history/user/${userId}`;
    if (year || month) {
      const params = new URLSearchParams();
      if (year) params.append('year', year.toString());
      if (month) params.append('month', month.toString());
      url += `?${params.toString()}`;
    }
    return this.makeRequest('GET', url, null, true);
  }

  async getCompanyBillingSummary(companyId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/billing-history/company/${companyId}/summary`, null, true);
  }

  async generateMonthlyBilling(companyId: string, billingData: any): Promise<any> {
    return this.makeRequest('POST', `/api/v1/billing-history/company/${companyId}/generate`, billingData, true);
  }

  async generateAllBillingHistory(companyId: string): Promise<any> {
    return this.makeRequest('POST', `/api/v1/billing-history/company/${companyId}/generate-all`, null, true);
  }

  async getMonthlyUsage(companyId: string, year: number, month: number): Promise<any> {
    return this.makeRequest('GET', `/api/v1/billing-history/company/${companyId}/usage/${year}/${month}`, null, true);
  }

  async downloadInvoice(billingId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/billing-history/invoice/${billingId}/download`, null, true);
  }

  // File download and view methods
  async downloadFile(fileId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/files/download/${fileId}`, null, true);
  }

  async viewFile(fileId: string): Promise<any> {
    return this.makeRequest('GET', `/api/v1/files/view/${fileId}`, null, true);
  }

  // Extracted data methods
  async getExtractedData(skip: number = 0, limit: number = 100): Promise<any> {
    return this.makeRequest('GET', `/api/v1/data?skip=${skip}&limit=${limit}`, null, true);
  }

  async getUserExtractedData(userId: string, skip: number = 0, limit: number = 100): Promise<any> {
    return this.makeRequest('GET', `/api/v1/data/user/${userId}?skip=${skip}&limit=${limit}`, null, true);
  }

  async updateExtractedData(dataId: string, updateData: any): Promise<any> {
    console.log("API: Updating data", { dataId, updateData });
    const result = await this.makeRequest('PUT', `/api/v1/data/${dataId}`, updateData, true);
    console.log("API: Update result", result);
    return result;
  }

  async deleteExtractedData(dataId: string): Promise<any> {
    return this.makeRequest('DELETE', `/api/v1/data/${dataId}`, null, true);
  }

  async exportDataToCsv(format: string = 'raw'): Promise<Blob> {
    const url = `${this.baseUrl}/api/v1/data/export/csv?format=${format}`;
    const headers: Record<string, string> = {};
    
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.blob();
  }

  async serveFile(fileId: string): Promise<Blob> {
    const url = `${this.baseUrl}/api/v1/files/serve/${fileId}`;
    const headers: Record<string, string> = {};
    
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    console.log('serveFile request:', { url, headers });

    const response = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors',
    });

    console.log('serveFile response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('serveFile error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const blob = await response.blob();
    console.log('serveFile blob received:', {
      size: blob.size,
      type: blob.type
    });

    return blob;
  }
}

export const apiClient = new ApiClient(); 