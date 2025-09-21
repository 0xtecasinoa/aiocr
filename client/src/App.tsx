import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { authManager, type AuthState } from "./lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import ConversionPage from "@/pages/conversion";
import DataListPage from "@/pages/data-list";
import ExportPage from "@/pages/export";
import ProfilePage from "@/pages/profile";
import MyPage from "@/pages/my-page";
import NotFoundPage from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

// Create a new QueryClient instance
const queryClient = new QueryClient();

function AuthenticatedApp() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <div className="lg:ml-64 min-h-screen">
          <Header />
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/upload" component={UploadPage} />
            <Route path="/conversion" component={ConversionPage} />
            <Route path="/data-list" component={DataListPage} />
            <Route path="/export" component={ExportPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/my-page" component={MyPage} />
            <Route>
              <NotFoundPage />
            </Route>
          </Switch>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  const [authState, setAuthState] = useState<AuthState>(authManager.getState());

  useEffect(() => {
    const unsubscribe = authManager.subscribe(setAuthState);
    
    // Initialize auth state on app start
    authManager.initialize();
    
    return unsubscribe;
  }, []);

  // Show loading during initial authentication check
  if (authState.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p>アプリケーションを初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Switch>
          {/* Login route - always accessible */}
          <Route path="/login" component={LoginPage} />
          
          {/* Protected routes */}
          <Route path="/*">
            {authState.isAuthenticated ? <AuthenticatedApp /> : <LoginPage />}
          </Route>
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
