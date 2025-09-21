import { useState, useEffect } from "react";
import { authManager, type AuthState } from "@/lib/auth";

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authManager.getState());

  useEffect(() => {
    const unsubscribe = authManager.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    lastValidationTime: authState.lastValidationTime,
    
    // Actions
    login: authManager.login.bind(authManager),
    register: authManager.register.bind(authManager),
    logout: authManager.logout.bind(authManager),
    validateToken: authManager.validateToken.bind(authManager),
    refreshUserData: authManager.refreshUserData.bind(authManager),
  };
} 