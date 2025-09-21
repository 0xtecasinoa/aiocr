import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import UploadArea from "@/components/upload-area";
import { authManager } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { TrashIcon, FolderIcon, FileIcon } from "lucide-react";

interface UploadedFileInfo {
  name: string;
  size: number;
  type: string;
  folder?: string;
  file: File; // Add the actual File object
}

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFileInfo[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [folderName, setFolderName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = authManager.getState().user;

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      return apiClient.uploadFiles(files, folderName);
    },
    onSuccess: (result) => {
      console.log("Upload successful:", result);
    },
    onError: (error) => {
      console.error("Upload failed:", error);
    },
  });

  const handleFilesSelected = (files: FileList) => {
    const fileInfos: UploadedFileInfo[] = [];
    let detectedFolderName = "";

    Array.from(files).forEach(file => {
      const fileInfo: UploadedFileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        file: file, // Store the actual File object
      };

      // Check if this is from a folder upload
      const fileWithPath = file as any;
      if (fileWithPath.webkitRelativePath) {
        const pathParts = fileWithPath.webkitRelativePath.split('/');
        if (pathParts.length > 1) {
          const folderName = pathParts[0];
          fileInfo.folder = folderName;
          detectedFolderName = folderName;
          console.log(`File ${file.name} is from folder: ${folderName}`);
        }
      }

      fileInfos.push(fileInfo);
    });

    // Set the detected folder name for upload
    if (detectedFolderName) {
      setFolderName(detectedFolderName);
      console.log(`Detected folder name: ${detectedFolderName}`);
    }

    setSelectedFiles(fileInfos);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Extract actual File objects from selectedFiles
      const filesToUpload = selectedFiles.map(fileInfo => fileInfo.file);
      
      // Validate files before upload
      const totalSize = filesToUpload.reduce((sum, file) => sum + file.size, 0);
      const maxSize = 100 * 1024 * 1024; // 100MB limit
      
      if (totalSize > maxSize) {
        throw new Error(`ファイルサイズが大きすぎます。合計サイズは100MB以下にしてください。`);
      }
      
      // Check if backend is available
      try {
        const response = await fetch('http://127.0.0.1:8000/health', { method: 'GET' });
        if (!response.ok) {
          throw new Error('バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。');
        }
      } catch (error) {
        throw new Error('バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。');
      }
      
      // Simulate progress during actual upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Call the actual upload mutation with File objects
      const result = await uploadMutation.mutateAsync(filesToUpload);
      
      // Clear progress interval and set to 100%
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Wait a moment to show 100% completion
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
      
      // Log success for debugging
      console.log("Upload successful:", result);
      console.log("Uploaded with folder name:", folderName);
      
      // Set uploaded files and clear selected files
      if (result.success) {
        setUploadedFiles(result.uploadedFiles);
        setSelectedFiles([]);
      
      toast({
        title: "アップロード完了",
          description: `${result.totalFiles}個のファイルが正常にアップロードされました。${folderName ? `フォルダ「${folderName}」に保存されました。` : ''}`,
      });
      
        // Redirect to conversion page after successful upload
        setTimeout(() => {
          window.location.href = '/conversion';
        }, 1500);
      }
      
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadProgress(0);
      
      // Clear any existing progress intervals
      setUploadProgress(0);
      
      let errorMessage = "ファイルのアップロードに失敗しました。";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "アップロードエラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    return '📁';
  };

  const groupedFiles = selectedFiles.reduce((acc, file) => {
    const folder = file.folder || 'その他';
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, UploadedFileInfo[]>);

  const groupedUploadedFiles = uploadedFiles.reduce((acc, file) => {
    const folder = file.folder || 'その他';
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, UploadedFileInfo[]>);

  const handleStartConversion = async (folderNames: string[]) => {
    if (folderNames.length === 0) return;
    
    setIsConverting(true);
    
    try {
      const response = await apiClient.startConversionWithFolders({
        folderNames,
        language: "jpn+eng",
        confidenceThreshold: 30.0,
        preprocessing: true
      });
      
      if (response.success) {
        toast({
          title: "変換開始",
          description: `${response.totalFolders}個のフォルダーの変換を開始しました。`,
        });
        
        // Redirect to data list page to show conversion progress
        window.location.href = '/data-list';
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast({
        title: "変換エラー",
        description: "変換の開始に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">ファイル・フォルダアップロード</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadArea 
            onFilesSelected={handleFilesSelected}
            disabled={isUploading}
          />
        </CardContent>
      </Card>

      {selectedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-base md:text-lg">選択されたファイル ({selectedFiles.length}件)</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedFiles([])}
                disabled={isUploading}
                data-testid="button-clear-files"
                className="self-start sm:self-auto"
              >
                <TrashIcon className="w-4 h-4 mr-2" />
                クリア
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(groupedFiles).map(([folderName, files]) => (
                <div key={folderName} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <FolderIcon className="w-5 h-5 text-amber-500 mr-2" />
                    <span className="font-medium text-slate-800" data-testid={`text-folder-${folderName}`}>
                      {folderName}
                    </span>
                    <Badge variant="secondary" className="ml-2">
                      {files.length}ファイル
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div 
                        key={`${folderName}-${index}`}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded"
                        data-testid={`file-item-${index}`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{getFileIcon(file.type)}</span>
                          <div>
                            <div className="font-medium text-sm text-slate-800" data-testid={`text-file-name-${index}`}>
                              {file.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(selectedFiles.findIndex(f => f === file))}
                          disabled={isUploading}
                          data-testid={`button-remove-file-${index}`}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {isUploading && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">アップロード中...</span>
                  <span className="text-sm text-slate-500" data-testid="text-upload-progress">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button 
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0}
                className="bg-primary hover:bg-blue-600"
                data-testid="button-upload"
              >
                {isUploading ? "アップロード中..." : "アップロード開始"}
              </Button>
            </div>

            {/* Conversion Section */}
            {uploadedFiles.length > 0 && (
              <div className="mt-8 border-t border-slate-200 pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">AI-OCR変換</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    アップロードされたフォルダーを指定してAI-OCR変換を実行します。
                  </p>
                </div>
                
                <div className="space-y-4">
                  {Object.entries(groupedUploadedFiles).map(([folderName, files]) => (
                    <div key={folderName} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <FolderIcon className="w-5 h-5 text-amber-500 mr-2" />
                          <span className="font-medium text-slate-800">
                            {folderName}
                          </span>
                          <Badge variant="secondary" className="ml-2">
                            {files.length}ファイル
                          </Badge>
                        </div>
                        <Button
                          onClick={() => handleStartConversion([folderName])}
                          disabled={isConverting}
                          className="bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          {isConverting ? "変換中..." : "変換開始"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => handleStartConversion(Object.keys(groupedUploadedFiles))}
                    disabled={isConverting || Object.keys(groupedUploadedFiles).length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isConverting ? "変換中..." : "全フォルダー変換開始"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
