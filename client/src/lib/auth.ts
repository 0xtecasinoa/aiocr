import { apiClient } from "./api";

export interface User {
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

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastValidationTime: number | null;
}

class AuthManager {
  private listeners: Array<(state: AuthState) => void> = [];
  private state: AuthState = {
    user: null,
    isAuthenticated: apiClient.isAuthenticated(),
    isLoading: false,
    lastValidationTime: null,
  };
  
  // Token validation interval (5 minutes)
  private readonly TOKEN_VALIDATION_INTERVAL = 5 * 60 * 1000;

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getState() {
    return this.state;
  }

  private setState(newState: AuthState) {
    this.state = newState;
    this.listeners.forEach(listener => listener(this.state));
  }

  async login(email: string, password: string): Promise<User> {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      const response = await apiClient.login(email, password);
      
      this.setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        lastValidationTime: Date.now(),
      });

      return response.user;
    } catch (error) {
      this.setState({
        ...this.state,
        isLoading: false,
      });
      throw error;
    }
  }

  async register(username: string, email: string, password: string): Promise<User> {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      const response = await apiClient.register(username, email, password);
      
      this.setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        lastValidationTime: Date.now(),
      });

      return response.user;
    } catch (error) {
      this.setState({
        ...this.state,
        isLoading: false,
      });
      throw error;
    }
  }

  async registerWithCompany(userData: any): Promise<User> {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      const response = await apiClient.registerWithCompany(userData);
      
      this.setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        lastValidationTime: Date.now(),
      });

      return response.user;
    } catch (error) {
      this.setState({
        ...this.state,
        isLoading: false,
      });
      throw error;
    }
  }

  async provisionalRegister(userData: ProvisionalUserCreate): Promise<ProvisionalUserResponse> {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      const response = await apiClient.provisionalRegister(userData);
      
      this.setState({
        ...this.state,
        isLoading: false,
      });

      return response;
    } catch (error) {
      this.setState({
        ...this.state,
        isLoading: false,
      });
      throw error;
    }
  }

  async verifyEmail(verificationToken: string): Promise<any> {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      const response = await apiClient.verifyEmail(verificationToken);
      
      this.setState({
        ...this.state,
        isLoading: false,
      });

      return response;
    } catch (error) {
      this.setState({
        ...this.state,
        isLoading: false,
      });
      throw error;
    }
  }

  async completeRegistration(verificationToken: string, username: string, password: string): Promise<User> {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      const response = await apiClient.completeRegistration(verificationToken, username, password);
      
      this.setState({
        user: response,
        isAuthenticated: true,
        isLoading: false,
        lastValidationTime: Date.now(),
      });

      return response;
    } catch (error) {
      this.setState({
        ...this.state,
        isLoading: false,
      });
      throw error;
    }
  }

  async logout() {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      await apiClient.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      this.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        lastValidationTime: null,
      });
    }
  }

  async updateCurrentUser(userData: Partial<User>) {
    if (this.state.user) {
      const updatedUser = { ...this.state.user, ...userData };
      this.setState({
        ...this.state,
        user: updatedUser,
      });
    }
  }

  async initialize() {
    this.setState({
      ...this.state,
      isLoading: true,
    });

    try {
      if (apiClient.isAuthenticated()) {
        // Check if we need to validate the token
        const needsValidation = this.shouldValidateToken();
        
        if (needsValidation) {
          // Try to get current user to validate token
          const user = await apiClient.getCurrentUser() as User;
          this.setState({
            user,
            isAuthenticated: true,
            isLoading: false,
            lastValidationTime: Date.now(),
          });
        } else {
          // Use existing state but mark as not loading
          this.setState({
            ...this.state,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else {
        // No token available
        this.setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          lastValidationTime: null,
        });
      }
    } catch (error) {
      // Token is invalid or network error, clear auth state
      try {
        await apiClient.logout(); // Clear tokens
      } catch {
        // Ignore logout errors during initialization
      }
      
      this.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        lastValidationTime: null,
      });
    }
  }

  private shouldValidateToken(): boolean {
    const { lastValidationTime } = this.state;
    if (!lastValidationTime) return true;
    
    const timeSinceLastValidation = Date.now() - lastValidationTime;
    return timeSinceLastValidation > this.TOKEN_VALIDATION_INTERVAL;
  }

  async validateToken(): Promise<boolean> {
    if (!apiClient.isAuthenticated()) {
      return false;
    }

    try {
      const user = await apiClient.getCurrentUser() as User;
      this.setState({
        ...this.state,
        user,
        isAuthenticated: true,
        lastValidationTime: Date.now(),
      });
      return true;
    } catch (error) {
      // Token is invalid
      await this.logout();
      return false;
    }
  }

  async refreshUserData(): Promise<void> {
    if (!this.state.isAuthenticated) return;

    try {
      const user = await apiClient.getCurrentUser() as User;
      this.setState({
        ...this.state,
        user,
        lastValidationTime: Date.now(),
      });
    } catch (error) {
      // If user data fetch fails, logout
      await this.logout();
    }
  }
}

export const authManager = new AuthManager();
