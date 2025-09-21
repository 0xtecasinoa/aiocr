import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { authManager } from "@/lib/auth";
import { 
  Calendar, 
  Clock
} from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_image?: string;
  is_admin: boolean;
  last_login?: string;
  created_at: string;
  ocr_usage_this_month: number;
  ocr_usage_last_month: number;
  last_ocr_usage?: string;
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => apiClient.getUserProfile() as Promise<UserProfile>,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateUserProfile(data),
    onSuccess: (updatedProfile: any) => {
      console.log("Profile update response:", updatedProfile);
      console.log("Updated username in response:", updatedProfile?.username);
      
      // Update the local profile state immediately
      if (updatedProfile) {
        queryClient.setQueryData(["user-profile"], updatedProfile);
        // Also update the auth state with the new user data
        authManager.updateCurrentUser({
          first_name: updatedProfile.first_name,
          last_name: updatedProfile.last_name,
        });
      }
      
      // Force refresh the profile data
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      // Force a refetch to ensure we have the latest data
      queryClient.refetchQueries({ queryKey: ["user-profile"] });
      
      setIsEditing(false);
      toast({
        title: "プロフィール更新完了",
        description: "プロフィールが正常に更新されました。",
      });
    },
    onError: (error: any) => {
      console.error("Profile update error:", error);
      toast({
        title: "更新エラー",
        description: error.message || "プロフィールの更新に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    if (profile) {
      setEditData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    // Create update data with only non-empty values
    const updateData: any = {};
    
    // Add first_name if it's not empty
    if (editData.first_name && editData.first_name.trim() !== "") {
      updateData.first_name = editData.first_name.trim();
    }
    
    // Add last_name if it's not empty
    if (editData.last_name && editData.last_name.trim() !== "") {
      updateData.last_name = editData.last_name.trim();
    }
    
    console.log("Original edit data:", editData);
    console.log("Update data to send:", updateData);
    console.log("Current profile:", profile);
    
    if (Object.keys(updateData).length === 0) {
      toast({
        title: "更新エラー",
        description: "更新するデータがありません。",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate(updateData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({ first_name: "", last_name: "" });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "未設定";
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-6 md:h-8 bg-slate-200 rounded w-1/2 md:w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div className="h-64 bg-slate-200 rounded-xl"></div>
              <div className="h-64 bg-slate-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6 md:p-8 text-center">
              <h2 className="text-lg md:text-xl font-semibold text-red-600 mb-2">エラーが発生しました</h2>
              <p className="text-slate-600">プロフィール情報の読み込みに失敗しました。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">ユーザープロフィール</h1>
          <p className="text-slate-600 text-sm md:text-base">アカウント情報とAI-OCR利用統計</p>
        </div>

        <div className="space-y-6">
          {/* User Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>ユーザー情報</CardTitle>
                  <CardDescription>基本的なアカウント情報</CardDescription>
                </div>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    編集
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      キャンセル
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateProfileMutation.isPending}>
                      保存
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">ユーザー名</Label>
                    <p className="text-slate-600 mt-1">{profile.username}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">メールアドレス</Label>
                    <p className="text-slate-600 mt-1">{profile.email}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">名前</Label>
                    {isEditing ? (
                      <Input
                        value={editData.first_name}
                        onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                        placeholder="名前を入力"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-slate-600 mt-1">{profile.first_name || "未設定"}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">姓</Label>
                    {isEditing ? (
                      <Input
                        value={editData.last_name}
                        onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                        placeholder="姓を入力"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-slate-600 mt-1">{profile.last_name || "未設定"}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">登録日</Label>
                    <p className="text-slate-600 mt-1">{formatDate(profile.created_at)}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">最終ログイン</Label>
                    <p className="text-slate-600 mt-1">{formatDate(profile.last_login)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OCR Usage Statistics Card */}
          <Card>
            <CardHeader>
              <CardTitle>AI-OCR利用統計</CardTitle>
              <CardDescription>OCR変換の利用状況</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">今月の利用回数</Label>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{profile.ocr_usage_this_month}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-slate-700">前月の利用回数</Label>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{profile.ocr_usage_last_month}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">最終OCR利用</Label>
                    <p className="text-slate-600 mt-1">{formatDate(profile.last_ocr_usage)}</p>
                  </div>
                  
                  {(profile.ocr_usage_this_month === 0 && profile.ocr_usage_last_month === 0) && (
                    <div className="text-center py-4">
                      <p className="text-slate-500 text-sm">まだOCR変換を利用していません</p>
                      <p className="text-slate-400 text-xs mt-1">アップロードページから始めましょう</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 