import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, Link } from "wouter";
import { authManager, type AuthState } from "@/lib/auth";
import { PlusIcon, UserIcon, LogOutIcon, Settings } from "lucide-react";

const pageData = {
  "/": {
    title: "ダッシュボード",
    description: "システムの概要と最新の活動",
  },
  "/upload": {
    title: "アップロード",
    description: "ファイルやフォルダのアップロード",
  },
  "/conversion": {
    title: "AI-OCR変換",
    description: "アップロードしたファイルのOCR変換",
  },
  "/data-list": {
    title: "データ一覧",
    description: "変換されたデータの管理と編集",
  },
  "/export": {
    title: "CSV出力",
    description: "データを様々な形式で出力",
  },
  "/profile": {
    title: "ユーザープロフィール",
    description: "アカウント情報とAI-OCR利用統計",
  },
  "/my-page": {
    title: "会社ページ",
    description: "会社情報とメンバー管理",
  },
};

export default function Header() {
  const [location, setLocation] = useLocation();
  const [authState, setAuthState] = useState<AuthState>(authManager.getState());
  const currentPage = pageData[location as keyof typeof pageData] || pageData["/"];

  useEffect(() => {
    return authManager.subscribe(setAuthState);
  }, []);

  const handleLogout = () => {
    authManager.logout();
  };

  const handleProfileClick = () => {
    setLocation("/profile");
  };

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 px-4 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <div className="lg:hidden w-12"></div> {/* Space for mobile menu button */}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl lg:text-2xl font-bold text-slate-800 truncate" data-testid="text-page-title">
              {currentPage.title}
            </h2>
            <p className="text-slate-600 text-sm lg:text-base hidden sm:block" data-testid="text-page-description">
              {currentPage.description}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 lg:space-x-4">
          <Link href="/conversion">
            <Button 
              className="bg-primary hover:bg-blue-600"
              data-testid="button-new-conversion"
              size="sm"
            >
              <PlusIcon className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">新規変換</span>
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-2 lg:space-x-3 cursor-pointer hover:bg-slate-50 rounded-lg p-2 transition-colors">
                <Avatar data-testid="avatar-user" className="h-8 w-8">
                  <AvatarFallback className="bg-slate-300">
                    <UserIcon className="w-4 h-4 text-slate-600" />
                  </AvatarFallback>
                </Avatar>
                {authState.user && (
                  <div className="text-sm text-slate-600 hidden md:block" data-testid="text-username">
                    {authState.user.first_name && authState.user.last_name 
                      ? `${authState.user.last_name} ${authState.user.first_name}`
                      : authState.user.username
                    }
                  </div>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {authState.user && (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium text-slate-900">
                    {authState.user.first_name && authState.user.last_name 
                      ? `${authState.user.last_name} ${authState.user.first_name}`
                      : authState.user.username
                    }
                  </div>
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    {authState.user.email}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleProfileClick}>
                <Settings className="w-4 h-4 mr-2" />
                プロフィール
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOutIcon className="w-4 h-4 mr-2" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
