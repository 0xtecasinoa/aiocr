import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authManager } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowRight, User, Building2, Phone } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Registration fields
  const [companyName, setCompanyName] = useState("");
  const [companyNameFurigana, setCompanyNameFurigana] = useState("");
  const [personInCharge, setPersonInCharge] = useState("");
  const [personInChargeFurigana, setPersonInChargeFurigana] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authManager.login(email, password);
      toast({
        title: "ログイン成功",
        description: "システムにログインしました。",
      });
      
      // Redirect to dashboard after successful login
      setLocation("/");
    } catch (error) {
      toast({
        title: "ログインエラー",
        description: "メールアドレスまたはパスワードが正しくありません。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      toast({
        title: "登録エラー",
        description: "パスワードが一致しません。",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Generate username from email (part before @) if not provided
      const finalUsername = username || email.split('@')[0];
      
      // Use registerWithCompany if company information is provided
      if (companyName && companyNameFurigana && personInCharge && personInChargeFurigana && phoneNumber) {
        await authManager.registerWithCompany({
          username: finalUsername,
          email,
          password,
          company_name: companyName,
          company_name_furigana: companyNameFurigana,
          person_in_charge: personInCharge,
          person_in_charge_furigana: personInChargeFurigana,
          phone_number: phoneNumber,
        });
        
        toast({
          title: "登録成功",
          description: "アカウントが作成され、ログインしました。ダッシュボードに移動します...",
        });
      } else {
        // Fall back to regular registration
        await authManager.register(finalUsername, email, password);
        
      toast({
        title: "登録成功",
        description: "アカウントが作成され、ログインしました。ダッシュボードに移動します...",
      });
      }
      
      // Redirect to dashboard after successful registration
      setLocation("/");
    } catch (error) {
      let errorMessage = "アカウントの作成に失敗しました。";
      
      if (error instanceof Error) {
        if (error.message.includes("already registered as the representative")) {
          errorMessage = "この会社の代表者として既に登録されています。";
        } else if (error.message.includes("already a member of this company")) {
          errorMessage = "この会社のメンバーとして既に登録されています。";
        } else if (error.message.includes("Company name already exists")) {
          errorMessage = "この会社名は既に登録されています。既存の会社に参加するか、別の会社名を使用してください。";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "登録エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setCompanyName("");
    setCompanyNameFurigana("");
    setPersonInCharge("");
    setPersonInChargeFurigana("");
    setPhoneNumber("");
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-100 rounded-full blur-3xl opacity-40"></div>
      </div>

      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-gray-200 to-transparent bg-repeat" 
             style={{
               backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)`,
               backgroundSize: '20px 20px'
             }}>
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo-Focused Brand Section */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-6">
              {/* Multiple glow rings for depth */}
              <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full blur-2xl opacity-60"></div>
              <div className="absolute inset-2 w-20 h-20 bg-gradient-to-r from-purple-200 to-blue-200 rounded-full blur-xl opacity-60"></div>
              
              {/* Main logo container - more compact */}
              <div className="relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-gray-50 to-white backdrop-blur-2xl rounded-[2rem] border-2 border-gray-200 shadow-2xl">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl border border-gray-200">
                  <img 
                    src="/conex_logo.png" 
                    alt="Conex Logo" 
                    className="w-16 h-16 object-contain drop-shadow-sm"
                  />
                </div>
              </div>
              
              {/* Floating particles around logo */}
              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-400 rounded-full opacity-60 animate-bounce delay-300"></div>
              <div className="absolute bottom-3 left-1 w-1 h-1 bg-cyan-400 rounded-full opacity-70 animate-bounce delay-700"></div>
              <div className="absolute top-4 left-3 w-0.5 h-0.5 bg-gray-600 rounded-full opacity-80 animate-pulse delay-1000"></div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="h-0.5 w-8 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full"></div>
                <span className="text-gray-800 text-lg font-bold tracking-[0.2em]">AI-OCR</span>
                <div className="h-0.5 w-8 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full"></div>
              </div>
              <p className="text-gray-600 text-xs font-light tracking-wider">
                次世代文書変換システム
              </p>
            </div>
          </div>

          {/* Main Login/Register Card */}
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl p-8 pt-6 shadow-2xl">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {isLogin ? "ログイン" : "新規登録"}
              </h2>
            </div>

            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-3">
              {!isLogin && (
                <>
                  {/* Company Information - Two Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                        <Building2 className="w-4 h-4" />
                        <span>会社名</span>
                      </Label>
                      <Input
                        id="companyName"
                        type="text"
                        placeholder="株式会社サンプル"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                        required={!isLogin}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyNameFurigana" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                        <Building2 className="w-4 h-4" />
                        <span>会社名(ふりがな)</span>
                      </Label>
                      <Input
                        id="companyNameFurigana"
                        type="text"
                        placeholder="カブシキガイシャサンプル"
                        value={companyNameFurigana}
                        onChange={(e) => setCompanyNameFurigana(e.target.value)}
                        className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                        required={!isLogin}
                      />
                    </div>
                  </div>

                  {/* Person in Charge - Two Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="personInCharge" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>ご担当者名</span>
                      </Label>
                      <Input
                        id="personInCharge"
                        type="text"
                        placeholder="田中太郎"
                        value={personInCharge}
                        onChange={(e) => setPersonInCharge(e.target.value)}
                        className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                        required={!isLogin}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="personInChargeFurigana" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>ご担当者名(ふりがな)</span>
                      </Label>
                      <Input
                        id="personInChargeFurigana"
                        type="text"
                        placeholder="タナカタロウ"
                        value={personInChargeFurigana}
                        onChange={(e) => setPersonInChargeFurigana(e.target.value)}
                        className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                        required={!isLogin}
                      />
                    </div>
                  </div>

                  {/* Contact Information - Two Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                        <Phone className="w-4 h-4" />
                        <span>電話番号</span>
                      </Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="03-1234-5678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                        required={!isLogin}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>ユーザー名</span>
                      </Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="tanaka_taro"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>メールアドレス</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                  required
                  data-testid="input-email"
                />
              </div>
              
              {/* Password Fields */}
              {isLogin ? (
              <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>パスワード</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                  required
                  data-testid="input-password"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                      <Lock className="w-4 h-4" />
                      <span>パスワード</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                      required={!isLogin}
                />
              </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-gray-700 font-medium text-sm flex items-center space-x-2">
                    <Lock className="w-4 h-4" />
                    <span>パスワード確認</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                    required={!isLogin}
                  />
                  </div>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] border-0" 
                disabled={isLoading}
                data-testid="button-submit"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>
                    {isLoading 
                      ? (isLogin ? "ログイン中..." : "登録中...") 
                      : (isLogin ? "ログイン" : "新規登録")
                    }
                  </span>
                  {!isLoading && <ArrowRight className="w-4 h-4" />}
                </span>
              </Button>
            </form>

            {/* Toggle between Login and Register */}
            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm mb-4">
                {isLogin ? "アカウントをお持ちでない方" : "既にアカウントをお持ちの方"}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={toggleMode}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm font-medium rounded-lg px-4 py-2"
              >
                {isLogin ? "新規登録はこちら" : "ログインはこちら"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
