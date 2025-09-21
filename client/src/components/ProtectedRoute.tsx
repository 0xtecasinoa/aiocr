import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { authManager, type AuthState } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [authState, setAuthState] = useState<AuthState>(authManager.getState());
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authManager.subscribe(setAuthState);
    
    // Validate token when component mounts or when page is refreshed
    const validateAuth = async () => {
      if (!authState.isAuthenticated) {
        // No token, redirect to login
        setLocation("/login");
        return;
      }

      setIsValidating(true);
      try {
        // Only validate if we haven't validated recently or this is the first validation
        if (!hasValidated) {
          const isValid = await authManager.validateToken();
          if (!isValid) {
            // Token is invalid, redirect to login
            setLocation("/login");
            return;
          }
          setHasValidated(true);
        }
      } catch (error) {
        console.error("Auth validation error:", error);
        // On validation error, redirect to login
        setLocation("/login");
      } finally {
        setIsValidating(false);
      }
    };

    // Only validate if we think we're authenticated but haven't validated in this session
    if (authState.isAuthenticated && !authState.isLoading && !hasValidated) {
      validateAuth();
    } else if (!authState.isAuthenticated && !authState.isLoading) {
      // Not authenticated and not loading, redirect immediately
      setLocation("/login");
    }

    return unsubscribe;
  }, [setLocation, authState.isAuthenticated, authState.isLoading, hasValidated]);

  // Show loading while validating authentication
  if (authState.isLoading || isValidating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">認証を確認中...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!authState.isAuthenticated) {
    return null;
  }

  return <>{children}</>;
} 