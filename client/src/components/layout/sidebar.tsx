import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { authManager } from "@/lib/auth";
import { useState } from "react";
import { 
  LayoutDashboardIcon, 
  CloudUploadIcon, 
  SettingsIcon, 
  ListIcon, 
  DownloadIcon,
  MenuIcon,
  Building2Icon
} from "lucide-react";

const navigation = [
  {
    name: "ダッシュボード",
    href: "/",
    icon: LayoutDashboardIcon,
  },
  {
    name: "アップロード",
    href: "/upload",
    icon: CloudUploadIcon,
  },
  {
    name: "AI-OCR変換",
    href: "/conversion",
    icon: SettingsIcon,
  },
  {
    name: "データ一覧",
    href: "/data-list",
    icon: ListIcon,
  },
  {
    name: "CSV出力",
    href: "/export",
    icon: DownloadIcon,
  },
  {
    name: "会社ページ",
    href: "/my-page",
    icon: Building2Icon,
  },
];

const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => {
  const [location] = useLocation();

  return (
    <div className="h-full bg-white">
      <div className="p-2 border-b border-slate-200 flex justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-16 h-16 lg:w-20 lg:h-20 flex items-center justify-center">
            <img 
              src="/conex_logo.png" 
              alt="Conex Logo" 
              className="w-16 h-16 lg:w-20 lg:h-20 object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-slate-800 text-center">AI-OCR</h1>
            <p className="text-sm text-slate-500">変換システム</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
                    location === item.href
                      ? "bg-blue-50 text-primary"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                  data-testid={`nav-${item.href.slice(1) || 'dashboard'}`}
                  onClick={onItemClick}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full w-64 shadow-xl border-r border-slate-200 z-40">
        <SidebarContent />
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-white shadow-md"
            >
              <MenuIcon className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SidebarContent onItemClick={() => setIsMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
