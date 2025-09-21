import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  FileIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  AlertTriangleIcon,
  UploadIcon,
  SettingsIcon,
  TrendingUpIcon,
  DatabaseIcon,
  ZapIcon,
  ActivityIcon
} from "lucide-react";
import { authManager } from "@/lib/auth";
import { apiClient } from "@/lib/api";

export default function DashboardPage() {
  const currentUser = authManager.getState().user;

  const { data: conversionJobsResponse } = useQuery({
    queryKey: ["conversionJobs", currentUser?.id],
    queryFn: () => apiClient.getConversionJobs(currentUser?.id || ""),
    enabled: !!currentUser,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: extractedDataResponse } = useQuery({
    queryKey: ["extractedData", currentUser?.id],
    queryFn: () => apiClient.getExtractedData(0, 1000),
    enabled: !!currentUser,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const conversionJobs = (conversionJobsResponse as any)?.jobs || [];
  const extractedData = (extractedDataResponse as any)?.data || [];

  const stats = {
    totalFiles: extractedData.length,
    completed: extractedData.filter((item: any) => 
      item.status === "completed" || item.is_validated === true
    ).length,
    needsReview: extractedData.filter((item: any) => 
      item.status === "needs_review" || 
      (item.is_validated === false && item.status !== "processing") ||
      item.status === "extracted"
    ).length,
    processing: conversionJobs.filter((job: any) => 
      job.status === "processing" || job.status === "pending" || job.status === "running"
    ).length,
  };

  const recentJobs = conversionJobs.slice(0, 5);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 w-full">
        {/* Welcome Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-slate-800 via-blue-600 to-slate-800 bg-clip-text text-transparent mb-4">
            ダッシュボード
          </h1>
          <p className="text-slate-600 text-base md:text-lg">
            こんにちは、{currentUser?.username || 'ユーザー'}さん
          </p>
          <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mx-auto mt-4"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100/50" data-testid="card-total-files">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-10 translate-x-10"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">ファイル総数</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileIcon className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 mb-1" data-testid="text-total-files">
                {stats.totalFiles}
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUpIcon className="w-4 h-4 text-green-500" />
                <p className="text-xs text-slate-600 font-medium">変換済みファイル</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-100/50" data-testid="card-completed">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -translate-y-10 translate-x-10"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">変換済み</CardTitle>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 mb-1" data-testid="text-completed">
                {stats.completed}
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-xs text-slate-600 font-medium">正常に完了</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-yellow-100/50" data-testid="card-needs-review">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-10 translate-x-10"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">要確認</CardTitle>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangleIcon className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600 mb-1" data-testid="text-needs-review">
                {stats.needsReview}
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <p className="text-xs text-slate-600 font-medium">確認が必要</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-cyan-50 to-blue-100/50" data-testid="card-in-progress">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full -translate-y-10 translate-x-10"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">処理中</CardTitle>
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <ClockIcon className="h-5 w-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyan-600 mb-1" data-testid="text-in-progress">
                {stats.processing}
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                <p className="text-xs text-slate-600 font-medium">変換処理中</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Enhanced Recent Jobs */}
          <div className="xl:col-span-2">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <ActivityIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-800">変換履歴</CardTitle>
                    <CardDescription className="text-slate-600">直近の変換作業の状況</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {recentJobs.length === 0 ? (
                  <div className="text-center py-12" data-testid="text-no-jobs">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">変換履歴がありません</p>
                    <p className="text-slate-400 text-sm mt-1">ファイルをアップロードして変換を開始しましょう</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentJobs.map((job: any) => (
                                           <div 
                       key={job.id} 
                       className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50/50 to-white border border-slate-100 rounded-xl hover:shadow-md transition-all duration-200 min-w-0"
                       data-testid={`job-${job.id}`}
                     >
                                               <div className="flex-1 min-w-0">
                         <div className="font-semibold text-slate-800 mb-1 truncate" data-testid={`text-job-name-${job.id}`}>
                           {job.name}
                         </div>
                          <div className="text-sm text-slate-500">
                            {job.createdAt ? new Date(job.createdAt).toLocaleString('ja-JP') : ''}
                          </div>
                                                 </div>
                         <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                           <Badge 
                             className={`${
                               job.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                               job.status === 'processing' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                               job.status === 'failed' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                               'bg-slate-100 text-slate-700 hover:bg-slate-200'
                             } border-0 font-medium text-xs`}
                             data-testid={`badge-job-status-${job.id}`}
                           >
                            {job.status === 'completed' ? '完了' : 
                             job.status === 'processing' ? '処理中' : 
                             job.status === 'failed' ? '失敗' : '待機中'}
                          </Badge>
                                                     {job.progress !== undefined && (
                             <div className="flex items-center space-x-2">
                               <div className="w-8 md:w-12 h-2 bg-slate-200 rounded-full overflow-hidden">
                                 <div 
                                   className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                                   style={{ width: `${job.progress}%` }}
                                 ></div>
                               </div>
                               <span className="text-xs md:text-sm text-slate-600 font-medium whitespace-nowrap" data-testid={`text-job-progress-${job.id}`}>
                                 {job.progress}%
                               </span>
                             </div>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            {/* Enhanced System Status */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-green-50/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <DatabaseIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <CardTitle className="text-slate-800">システム状態</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-slate-700">APIサーバー</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 font-medium" data-testid="badge-api-status">
                      正常
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse delay-200"></div>
                      <span className="text-sm font-medium text-slate-700">OCRエンジン</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 font-medium" data-testid="badge-ocr-status">
                      正常
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse delay-500"></div>
                      <span className="text-sm font-medium text-slate-700">ストレージ</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 font-medium" data-testid="badge-storage-status">
                      正常
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
