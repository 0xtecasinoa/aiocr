import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authManager } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiClient, Company, CompanyMember } from "@/lib/api";
import { 
  UserIcon, 
  BuildingIcon, 
  UsersIcon, 
  MailIcon, 
  PhoneIcon, 
  MapPinIcon, 
  CalendarIcon,
  Receipt,
  FileText,
  Download,
  Plus,
  RefreshCw,
  Loader2
} from "lucide-react";

interface InviteMemberData {
  email: string;
  username: string;
  role: string;
}

interface BillingHistory {
  id: string;
  year: number;
  month: number;
  totalItems: number;
  totalAmount: number;
  invoiceUrl?: string;
  createdAt: string;
  status: string;
}

export default function MyPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteData, setInviteData] = useState<InviteMemberData>({
    email: "",
    username: "",
    role: "member"
  });
  const [isInviting, setIsInviting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = authManager.getState().user;

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      setIsLoading(true);
      
      // Get company information
      const companyData = await apiClient.getMyCompany();
      setCompany(companyData);
      
      // Get company members
      if (companyData) {
        const membersData = await apiClient.getCompanyMembers(companyData.id);
        setMembers(membersData);
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "会社情報の取得に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // React Query for billing history
  const { 
    data: billingHistoryResponse, 
    isLoading: isLoadingBillingHistory,
    error: billingHistoryError,
    refetch: refetchBillingHistory
  } = useQuery({
    queryKey: ["billing-history", company?.id],
    queryFn: async () => {
      if (!company?.id) {
        // Fallback to user-based billing history if no company exists
        return await apiClient.getUserBillingHistory(String(currentUser!.id));
      }
      return await apiClient.getCompanyBillingHistory(company.id);
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for generating all billing history
  const generateAllBillingMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) throw new Error("Company ID not available");
      return await apiClient.generateAllBillingHistory(company.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-history", company?.id] });
      toast({
        title: "成功",
        description: "請求履歴を生成しました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "請求履歴の生成に失敗しました。",
        variant: "destructive",
      });
    }
  });

  const billingHistory = (billingHistoryResponse as any)?.billing_history || [];

  const handleDownloadInvoice = async (billingId: string) => {
    try {
      const response = await apiClient.downloadInvoice(billingId);
      if (response.success) {
        // In a real implementation, you would trigger a file download here
        toast({
          title: "ダウンロード開始",
          description: "請求書のダウンロードを開始しました。",
        });
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "請求書のダウンロードに失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleInviteMember = async () => {
    if (!inviteData.email || !inviteData.username) {
      toast({
        title: "エラー",
        description: "メールアドレスとユーザー名を入力してください。",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsInviting(true);
      await apiClient.inviteCompanyMember(company!.id, inviteData);
      toast({
        title: "成功",
        description: "メンバーを招待しました。",
      });
      setIsInviteDialogOpen(false);
      setInviteData({ email: "", username: "", role: "member" });
      
      // Refresh members list
      const membersData = await apiClient.getCompanyMembers(company!.id);
      setMembers(membersData);
    } catch (error) {
      toast({
        title: "エラー",
        description: "メンバーの招待に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-slate-600">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">会社情報が見つかりません</h2>
          <p className="text-slate-600">会社の登録が必要です。</p>
        </div>
      </div>
    );
  }

  const isRepresentative = currentUser?.id && String(currentUser.id) === company.representative_user_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="mt-10 pl-10">
        <p className="text-slate-800 font-semibold text-2xl">{company.company_name}</p>
      </div>
      <div className="max-w-7xl mx-auto p-6 pt-3">
        {/* Company Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-3 text-xl font-semibold text-slate-800">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <BuildingIcon className="w-5 h-5 text-white" />
                  </div>
                  <span>会社情報</span>
                </CardTitle>
                {isRepresentative && (
                  <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                        <Plus className="w-5 h-5 mr-2" />
                        メンバーを招待
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>メンバーを招待</DialogTitle>
                        <DialogDescription>
                          新しいメンバーを会社に招待します。
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="email">メールアドレス</Label>
                          <Input
                            id="email"
                            type="email"
                            value={inviteData.email}
                            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                            placeholder="example@company.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="username">ユーザー名</Label>
                          <Input
                            id="username"
                            value={inviteData.username}
                            onChange={(e) => setInviteData({ ...inviteData, username: e.target.value })}
                            placeholder="ユーザー名"
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">役割</Label>
                          <Select value={inviteData.role} onValueChange={(value) => setInviteData({ ...inviteData, role: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">メンバー</SelectItem>
                              <SelectItem value="admin">管理者</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                          キャンセル
                        </Button>
                        <Button onClick={handleInviteMember} disabled={isInviting}>
                          {isInviting ? "招待中..." : "招待する"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                  <div className="flex items-center space-x-3">
                    <MapPinIcon className="w-5 h-5 text-blue-600" />
                    <div>
                      <Label className="text-sm font-medium text-slate-600">会社名</Label>
                      <p className="text-slate-800 font-semibold text-lg">{company.company_name}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                  <div className="flex items-center space-x-3">
                    <BuildingIcon className="w-5 h-5 text-purple-600" />
                    <div>
                      <Label className="text-sm font-medium text-slate-600">会社名(ふりがな)</Label>
                      <p className="text-slate-800 font-semibold text-lg">{company.company_name_furigana}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                  <div className="flex items-center space-x-3">
                    <CalendarIcon className="w-5 h-5 text-green-600" />
                    <div>
                      <Label className="text-sm font-medium text-slate-600">登録日</Label>
                      <p className="text-slate-800 font-semibold text-lg">
                        {new Date(company.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-100">
                  <div className="flex items-center space-x-3">
                    <UsersIcon className="w-5 h-5 text-orange-600" />
                    <div>
                      <Label className="text-sm font-medium text-slate-600">メンバー数</Label>
                      <p className="text-slate-800 font-semibold text-2xl">{members.length}名</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Members */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-3 text-xl font-semibold text-slate-800">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-white" />
                </div>
                <span>会社メンバー</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="group p-4 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          member.role === "admin"
                            ? "bg-gradient-to-br from-purple-400 to-pink-500"
                            : "bg-gradient-to-br from-slate-400 to-gray-500"
                        }`}>
                          {member.role === "admin" ? (
                            <UserIcon className="w-6 h-6 text-white" />
                          ) : (
                            <UserIcon className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-1">
                            <span className="font-semibold text-slate-800 text-lg">{member.username}</span>
                            <Badge variant={member.role === "admin" ? "default" : "secondary"} className="font-medium">
                              {member.role === "admin" ? "管理者" : "メンバー"}
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-600 mb-1">{member.email}</div>
                          <div className="text-xs text-slate-500 flex items-center space-x-2">
                            <UserIcon className="w-3 h-3" />
                            <span>
                              参加日: {new Date(member.created_at).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {isRepresentative && member.role !== "admin" && (
                        <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Select
                            value={member.role}
                            onValueChange={(value) => {
                              // This part needs to be updated to use an API call
                              // For now, it's a placeholder.
                              console.log(`Updating role for member ${member.id} to ${value}`);
                              // Example: apiClient.updateMemberRole(company.id, member.id, value);
                              // After successful update, refetch members
                              // queryClient.invalidateQueries({ queryKey: ["company-members", company.id] });
                            }}
                          >
                            <SelectTrigger className="w-32 border-slate-200 focus:border-blue-500 focus:ring-blue-500">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">メンバー</SelectItem>
                              <SelectItem value="admin">管理者</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // This part needs to be updated to use an API call
                              // For now, it's a placeholder.
                              console.log(`Removing member ${member.id}`);
                              // Example: apiClient.removeCompanyMember(company.id, member.id);
                              // After successful removal, refetch members
                              // queryClient.invalidateQueries({ queryKey: ["company-members", company.id] });
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                          >
                            削除
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {members.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <UsersIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 text-lg">まだメンバーがいません</p>
                    <p className="text-slate-400 text-sm mt-1">メンバーを招待してチームを作成しましょう</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing History */}
        <div className="mt-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-3 text-xl font-semibold text-slate-800">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <span>請求履歴</span>
                </CardTitle>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchBillingHistory()}
                    disabled={isLoadingBillingHistory}
                    className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingBillingHistory ? 'animate-spin' : ''}`} />
                    更新
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateAllBillingMutation.mutate()}
                    disabled={generateAllBillingMutation.isPending || !company?.id}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    {generateAllBillingMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    履歴生成
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Loading State */}
                {isLoadingBillingHistory && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="text-slate-600">請求履歴を読み込み中...</span>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {billingHistoryError && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Receipt className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-red-600 text-lg">請求履歴の読み込みに失敗しました</p>
                    <p className="text-slate-400 text-sm mt-1">しばらく時間をおいて再度お試しください</p>
                    <Button
                      variant="outline"
                      onClick={() => refetchBillingHistory()}
                      className="mt-4"
                    >
                      再試行
                    </Button>
                  </div>
                )}

                {/* Billing History Table */}
                {!isLoadingBillingHistory && !billingHistoryError && (
                  <div className="space-y-4">
                    {billingHistory.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 border-r border-slate-200">
                                利用年
                              </th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 border-r border-slate-200">
                                利用月
                              </th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 border-r border-slate-200">
                                利用件数
                              </th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                請求額
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {billingHistory.map((billing: BillingHistory) => (
                              <tr key={billing.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-900 border-r border-slate-200">
                                  {billing.year}年
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-900 border-r border-slate-200">
                                  {billing.month}月
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-900 border-r border-slate-200">
                                  {billing.totalItems}件
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-900">
                                  {billing.totalAmount ? `¥${billing.totalAmount.toLocaleString()}` : '¥0'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <Receipt className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 text-lg">請求履歴がありません</p>
                        <p className="text-slate-400 text-sm mt-1">OCR変換の利用状況が表示されます</p>
                        <Button
                          variant="outline"
                          onClick={() => generateAllBillingMutation.mutate()}
                          disabled={generateAllBillingMutation.isPending || !company?.id}
                          className="mt-4"
                        >
                          {generateAllBillingMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          履歴を生成
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 