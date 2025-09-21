import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { authManager } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { 
  FolderIcon, 
  FileIcon, 
  SettingsIcon, 
  CheckCircleIcon, 
  PlayIcon,
  ClockIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImageIcon,
  FileSpreadsheetIcon,
  FileImageIcon,
  CalendarIcon,
  HardDriveIcon,
  EyeIcon,
  DownloadIcon,
  TrashIcon,
  RefreshCwIcon,
  FilterIcon,
  SearchIcon,
  GridIcon,
  ListIcon,
  SortAscIcon,
  SortDescIcon,
  UploadIcon
} from "lucide-react";

// Add this to the conversion page to show supported file types
const supportedFileTypes = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 
  'image/bmp', 'image/gif', 'image/webp', 'application/pdf',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

// Update the file type checking
const isSupportedFile = (file: File) => {
  return supportedFileTypes.includes(file.type) || 
         ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.webp', '.pdf', '.xls', '.xlsx']
         .some(ext => file.name.toLowerCase().endsWith(ext));
};

export default function ConversionPage() {
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionMode, setConversionMode] = useState<'folders' | 'files' | 'both'>('folders');
  const [conversionProgress, setConversionProgress] = useState<{[key: string]: number}>({});
  const [conversionStatus, setConversionStatus] = useState<{[key: string]: string}>({});
  const [showConversionResults, setShowConversionResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFailedJobs, setShowFailedJobs] = useState(false);
  
  // File preview modal state
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    fileId: string;
    fileName: string;
    mimeType: string;
  }>({
    isOpen: false,
    fileId: '',
    fileName: '',
    mimeType: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = authManager.getState().user;

  // Get user's uploaded items (files and folders)
  const { data: itemsResponse, isLoading: isLoadingItems, error: itemsError } = useQuery({
    queryKey: ["/api/v1/files/user/items", currentUser?.id, currentPage],
    queryFn: async () => {
      if (!currentUser?.id) {
        throw new Error("No user ID available");
      }
      console.log('Fetching items for user:', currentUser.id);
      const response = await apiClient.getUserItems(String(currentUser.id), currentPage, itemsPerPage);
      
      // Validate response structure
      if (!response || !response.success) {
        throw new Error("Invalid response from server");
      }
      
      // Log real data counts
      console.log('Real data received:', {
        individualFiles: response.individualFiles?.length || 0,
        folders: response.folders?.length || 0,
        totalIndividualFiles: response.totalIndividualFiles || 0,
        totalFolders: response.totalFolders || 0
      });
      
      return response;
    },
    enabled: !!currentUser?.id,
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Get conversion jobs
  const { data: conversionJobsResponse, isLoading: isLoadingJobs, error: jobsError } = useQuery({
    queryKey: ["/api/v1/conversion/user", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) {
        throw new Error("No user ID available");
      }
      console.log('Fetching conversion jobs for user:', currentUser.id);
      const response = await apiClient.getConversionJobs(String(currentUser.id));
      
      // Validate response structure
      if (!response || !response.jobs) {
        throw new Error("Invalid response from server");
      }
      
      // Log real data counts
      console.log('Real conversion jobs received:', {
        jobs: response.jobs?.length || 0
      });
      
      return response;
    },
    enabled: !!currentUser?.id,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time progress
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const individualFiles = (itemsResponse as any)?.individualFiles || [];
  const folders = (itemsResponse as any)?.folders || [];
  const conversionJobs = (conversionJobsResponse as any)?.jobs || [];

  // Filter files based on search term
  const filteredIndividualFiles = individualFiles.filter((file: any) =>
    file.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.mimeType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Debug logging
  console.log('Current User:', currentUser);
  console.log('Items Response:', itemsResponse);
  console.log('Items Error:', itemsError);
  console.log('Individual Files (Real):', individualFiles);
  if (individualFiles.length > 0) {
    console.log('Sample file structure:', individualFiles[0]);
  }
  console.log('Folders (Real):', folders);
  console.log('Conversion Jobs Response:', conversionJobsResponse);
  console.log('Jobs Error:', jobsError);
  console.log('Conversion Jobs (Real):', conversionJobs);

  // Auto-check data integrity on component mount
  useEffect(() => {
    if (currentUser?.id && individualFiles.length > 0) {
      console.log('Auto-checking data integrity...');
      
      // Check if any files have invalid IDs
      const checkFileIntegrity = async () => {
        let hasInvalidFiles = false;
        
        for (const file of individualFiles) {
          try {
            // Removed debugFileExistence call
            console.log(`Checking file: ${file.id} - ${file.originalName}`);
          } catch (error) {
            console.warn(`Error checking file ${file.id}:`, error);
            hasInvalidFiles = true;
          }
        }
        
        if (hasInvalidFiles) {
          console.log('Invalid files detected, refreshing data...');
          queryClient.invalidateQueries({ queryKey: ["/api/v1/files/user/items", currentUser.id] });
          queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user", currentUser.id] });
        }
      };
      
      checkFileIntegrity();
    }
  }, [currentUser?.id, individualFiles.length, queryClient]);

  // Clean up orphaned files function
  const cleanupOrphanedFiles = async () => {
    console.log('Cleaning up orphaned files...');
    
    if (!currentUser?.id) {
      toast({
        title: "認証エラー",
        description: "クリーンアップするにはログインしてください。",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Note: cleanupOrphanedFiles API method was removed
      toast({
        title: "クリーンアップ機能",
        description: "この機能は現在利用できません。",
        variant: "destructive",
      });
    } catch (error: any) {
      console.error("Error cleaning up orphaned files:", error);
      toast({
        title: "クリーンアップエラー",
        description: error.message || "孤立ファイルのクリーンアップに失敗しました。",
        variant: "destructive",
      });
    }
  };

  // Force refresh data function
  const forceRefreshData = async () => {
    console.log('Force refreshing all data...');
    
    // Clear all cached data
    queryClient.clear();
    
    // Invalidate all queries
    queryClient.invalidateQueries({ queryKey: ["/api/v1/files/user/items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user"] });
    
    // Get fresh data
    // await debugAllFiles();
    
    toast({
      title: "データ更新",
      description: "データを再読み込みしました。",
    });
  };

  const startConversionMutation = useMutation({
    mutationFn: async (folderNames: string[]) => {
      console.log('Starting conversion for folders:', folderNames);
      try {
        const response = await apiClient.startConversionWithFolders({
          folderNames,
          language: "jpn+eng",
          confidenceThreshold: 30.0,
          preprocessing: true
        });
        console.log('Conversion response:', response);
        return response;
      } catch (error) {
        console.error('Conversion API error:', error);
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log('Conversion started successfully:', response);
      toast({
        title: "変換開始",
        description: `${response.totalFolders}個のフォルダーのAI-OCR変換を開始しました。`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user"] });
      setSelectedFolders([]);
      setIsConverting(false);
    },
    onError: (error: any) => {
      console.error('Conversion error:', error);
      let errorMessage = "変換の開始に失敗しました。";
      
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "変換エラー",
        description: errorMessage,
        variant: "destructive",
      });
      setIsConverting(false);
    },
  });

  const startFilesConversionMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      console.log('Starting conversion for files:', fileIds);
      try {
        const response = await apiClient.startConversionWithFiles({
          fileIds,
          language: "jpn+eng",
          confidenceThreshold: 30.0,
          preprocessing: true
        });
        console.log('Files conversion response:', response);
        return response;
      } catch (error) {
        console.error('Files conversion API error:', error);
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log('Files conversion started successfully:', response);
      toast({
        title: "変換開始",
        description: `${response.totalFiles}個のファイルのAI-OCR変換を開始しました。`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user"] });
      setSelectedFiles([]);
      setIsConverting(false);
    },
    onError: (error: any) => {
      console.error('Files conversion error:', error);
      let errorMessage = "変換の開始に失敗しました。";
      
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "変換エラー",
        description: errorMessage,
        variant: "destructive",
      });
      setIsConverting(false);
    },
  });

  const handleFolderToggle = (folderName: string, checked: boolean) => {
    if (checked) {
      setSelectedFolders(prev => [...prev, folderName]);
    } else {
      setSelectedFolders(prev => prev.filter(name => name !== folderName));
    }
  };

  const handleFileToggle = (fileId: string, checked: boolean) => {
    if (checked) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  const toggleFolderExpansion = (folderName: string) => {
    setExpandedFolders(prev => 
      prev.includes(folderName) 
        ? prev.filter(name => name !== folderName)
        : [...prev, folderName]
    );
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleStartConversion = async () => {
    setIsConverting(true);
    setShowConversionResults(false);
    
    try {
      if (selectedFolders.length > 0 && selectedFiles.length > 0) {
        // Both folders and files selected
        setConversionMode('both');
        console.log('Starting conversion for both folders and files:', {
          folders: selectedFolders,
          files: selectedFiles
        });
        
        const [folderResponse, filesResponse] = await Promise.all([
          startConversionMutation.mutateAsync(selectedFolders),
          startFilesConversionMutation.mutateAsync(selectedFiles)
        ]);
        
        // Show success message with details
        toast({
          title: "変換開始",
          description: `${folderResponse.totalFolders}個のフォルダーと${filesResponse.totalFiles}個のファイルのAI-OCR変換を開始しました。`,
        });
        
        // Auto-navigate to results after a short delay
        setTimeout(() => {
          setShowConversionResults(true);
        }, 2000);
        
      } else if (selectedFolders.length > 0) {
        // Only folders selected
        setConversionMode('folders');
        console.log('Starting conversion for folders:', selectedFolders);
        
        const response = await startConversionMutation.mutateAsync(selectedFolders);
        
        // Show success message with folder details
        toast({
          title: "変換開始",
          description: `${response.totalFolders}個のフォルダー（${selectedFolders.join(', ')}）のAI-OCR変換を開始しました。`,
        });
        
        // Auto-navigate to results after a short delay
        setTimeout(() => {
          setShowConversionResults(true);
        }, 2000);
        
      } else {
        // Only files selected
        setConversionMode('files');
        console.log('Starting conversion for files:', selectedFiles);
        
        const response = await startFilesConversionMutation.mutateAsync(selectedFiles);
        
        // Show success message with file details
        toast({
          title: "変換開始",
          description: `${response.totalFiles}個のファイルのAI-OCR変換を開始しました。`,
        });
        
        // Auto-navigate to results after a short delay
        setTimeout(() => {
          setShowConversionResults(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      toast({
        title: "変換エラー",
        description: "変換の開始に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleViewConversionResults = () => {
    // Navigate to data list page to view conversion results
    window.location.href = '/data-list';
  };

  const handleViewFile = (fileId: string, fileName: string, mimeType: string) => {
    console.log('handleViewFile called with:', { fileId, fileName, mimeType });
    
    // Find the actual file data to get the correct ID
    const actualFile = individualFiles.find((file: any) => file.id === fileId);
    console.log('Found actual file:', actualFile);
    
    if (!actualFile) {
      console.error('File not found in individualFiles:', fileId);
      toast({
        title: "エラー",
        description: "ファイル情報が見つかりません。",
        variant: "destructive",
      });
      return;
    }
    
    setPreviewModal({
      isOpen: true,
      fileId: actualFile.id, // Use the actual file ID
      fileName,
      mimeType
    });
  };

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiClient.deleteConversionJob(jobId);
    },
    onSuccess: () => {
      toast({
        title: "削除完了",
        description: "変換ジョブを削除しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user"] });
    },
    onError: (error: any) => {
      console.error('Delete job error:', error);
      let errorMessage = "変換ジョブの削除に失敗しました。";
      
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "削除エラー",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Retry job mutation
  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiClient.retryConversionJob(jobId);
    },
    onSuccess: () => {
      toast({
        title: "再試行開始",
        description: "変換ジョブの再試行を開始しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user"] });
    },
    onError: (error: any) => {
      console.error('Retry job error:', error);
      let errorMessage = "変換ジョブの再試行に失敗しました。";
      
      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "再試行エラー",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleDeleteJob = async (jobId: string, jobName: string) => {
    if (confirm(`変換ジョブ「${jobName}」を削除しますか？\nこの操作は取り消せません。`)) {
      deleteJobMutation.mutate(jobId);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    retryJobMutation.mutate(jobId);
  };

  const handleViewJobDetails = (jobId: string) => {
    // Navigate to job details page or open modal
    window.location.href = `/conversion/job/${jobId}`;
  };

  const handleDeleteAllCompletedJobs = async () => {
    const completedJobs = conversionJobs.filter((job: any) => job.status === 'completed');
    
    if (completedJobs.length === 0) {
      toast({
        title: "削除対象なし",
        description: "削除可能な完了済みジョブがありません。",
      });
      return;
    }

    if (confirm(`${completedJobs.length}個の完了済み変換ジョブを削除しますか？\nこの操作は取り消せません。`)) {
      try {
        const jobIds = completedJobs.map((job: any) => job.id);
        await apiClient.deleteUserConversionJobsWithQuery(String(currentUser?.id), jobIds);
        
        toast({
          title: "一括削除完了",
          description: `${completedJobs.length}個の完了済みジョブを削除しました。`,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user"] });
      } catch (error: any) {
        console.error('Bulk delete error:', error);
        let errorMessage = "一括削除に失敗しました。";
        
        if (error?.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "一括削除エラー",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteAllFailedJobs = async () => {
    const failedJobs = conversionJobs.filter((job: any) => job.status === 'failed');
    
    if (failedJobs.length === 0) {
      toast({
        title: "削除対象なし",
        description: "削除可能な失敗済みジョブがありません。",
      });
      return;
    }

    if (confirm(`${failedJobs.length}個の失敗済み変換ジョブを削除しますか？\nこの操作は取り消せません。`)) {
      try {
        const jobIds = failedJobs.map((job: any) => job.id);
        await apiClient.deleteUserConversionJobsWithQuery(String(currentUser?.id), jobIds);
        
        toast({
          title: "一括削除完了",
          description: `${failedJobs.length}個の失敗済みジョブを削除しました。`,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user"] });
      } catch (error: any) {
        console.error('Bulk delete error:', error);
        let errorMessage = "一括削除に失敗しました。";
        
        if (error?.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "一括削除エラー",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    try {
      const blob = await apiClient.serveFile(fileId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "ダウンロード開始",
        description: `${fileName}のダウンロードを開始しました。`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "ダウンロードエラー",
        description: "ファイルのダウンロードに失敗しました。",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (mimeType: string, fileName: string) => {
    const iconClass = "w-5 h-5";
    
    if (mimeType.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i)) {
      return <ImageIcon className={`${iconClass} text-blue-500`} />;
    }
    if (mimeType.includes('pdf') || fileName.match(/\.pdf$/i)) {
      return <FileTextIcon className={`${iconClass} text-red-500`} />;
    }
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType.includes('excel') || 
      mimeType.includes('spreadsheet') || 
      fileName.match(/\.(xls|xlsx)$/i)
    ) {
      return <FileSpreadsheetIcon className={`${iconClass} text-green-500`} />;
    }
    if (mimeType.includes('word') || mimeType.includes('document') || fileName.match(/\.(doc|docx|rtf)$/i)) {
      return <FileTextIcon className={`${iconClass} text-blue-600`} />;
    }
    if (fileName.match(/\.txt$/i)) {
      return <FileTextIcon className={`${iconClass} text-gray-500`} />;
    }
    if (fileName.match(/\.(zip|rar|7z|tar|gz)$/i)) {
      return <FileIcon className={`${iconClass} text-purple-500`} />;
    }
    return <FileIcon className={`${iconClass} text-gray-400`} />;
  };

  const getFileTypeBadge = (mimeType: string, fileName: string) => {
    if (mimeType.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i)) {
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">画像</Badge>;
    }
    if (mimeType.includes('pdf') || fileName.match(/\.pdf$/i)) {
      return <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">PDF</Badge>;
    }
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType.includes('excel') || 
      mimeType.includes('spreadsheet') || 
      fileName.match(/\.(xls|xlsx)$/i)
    ) {
      return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Excel</Badge>;
    }
    if (mimeType.includes('word') || mimeType.includes('document') || fileName.match(/\.(doc|docx|rtf)$/i)) {
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">文書</Badge>;
    }
    if (fileName.match(/\.txt$/i)) {
      return <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200">テキスト</Badge>;
    }
    if (fileName.match(/\.(zip|rar|7z|tar|gz)$/i)) {
      return <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">アーカイブ</Badge>;
    }
    return <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200">その他</Badge>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFolderDisplayName = (folderName: string) => {
    if (folderName === "その他") return "その他のファイル";
    if (folderName === String(currentUser?.id)) return "メインフォルダー";
    return folderName;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '昨日';
    } else if (diffDays === 2) {
      return '一昨日';
    } else if (diffDays <= 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const Pagination = ({ currentPage, totalPages, onPageChange }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← 前へ
        </Button>
        
        {startPage > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
            >
              1
            </Button>
            {startPage > 2 && <span className="text-slate-400">...</span>}
          </>
        )}
        
        {pages.map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-slate-400">...</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          次へ →
        </Button>
      </div>
    );
  };

  // Delete file handler
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    console.log('Delete file clicked:', { fileId, fileName });
    
    if (!currentUser?.id) {
      toast({
        title: "認証エラー",
        description: "ファイルを削除するにはログインしてください。",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    if (!confirm(`ファイル "${fileName}" を削除しますか？この操作は取り消せません。`)) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      // First test if the file can be deleted
      console.log('Testing file deletion...');
      // const testResult = await testDeleteFile(fileId, fileName);
      
      // if (!testResult) {
      //   toast({
      //     title: "削除エラー",
      //     description: `ファイル "${fileName}" が見つかりません。データを再読み込みします。`,
      //     variant: "destructive",
      //   });
        
      //   // Refresh data to get correct file IDs
      //   queryClient.invalidateQueries({ queryKey: ["/api/v1/files/user/items", currentUser.id] });
      //   queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user", currentUser.id] });
      //   return;
      // }

      console.log('Attempting to delete file:', fileId);
      const result = await apiClient.deleteFile(fileId);
      console.log('Delete result:', result);
      
      if (result.success) {
        toast({
          title: "削除完了",
          description: `ファイル "${fileName}" を削除しました。`,
        });
        
        // Refresh the data
        queryClient.invalidateQueries({ queryKey: ["/api/v1/files/user/items", currentUser.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user", currentUser.id] });
      } else {
        throw new Error(result.message || "削除に失敗しました");
      }
    } catch (error: any) {
      console.error("Error deleting file:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
      
      let errorMessage = "ファイルの削除に失敗しました。";
      
      if (error.message.includes("File not found")) {
        errorMessage = `ファイル "${fileName}" が見つかりません。データを再読み込みします。`;
        // Refresh data to get correct file IDs
        queryClient.invalidateQueries({ queryKey: ["/api/v1/files/user/items", currentUser.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user", currentUser.id] });
      } else if (error.message.includes("Not authorized")) {
        errorMessage = "このファイルを削除する権限がありません。";
      } else if (error.message.includes("Invalid file ID")) {
        errorMessage = "無効なファイルIDです。データを再読み込みします。";
        queryClient.invalidateQueries({ queryKey: ["/api/v1/files/user/items", currentUser.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user", currentUser.id] });
      }
      
      toast({
        title: "削除エラー",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Delete folder handler
  const handleDeleteFolder = async (folderName: string) => {
    if (!currentUser?.id) {
      toast({
        title: "認証エラー",
        description: "フォルダーを削除するにはログインしてください。",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`フォルダー "${folderName}" とその中のすべてのファイルを削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await apiClient.deleteFolder(folderName);
      toast({
        title: "削除完了",
        description: `フォルダー "${folderName}" を削除しました。`,
      });
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/v1/files/user/items", currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/conversion/user", currentUser.id] });
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      toast({
        title: "削除エラー",
        description: error.response?.data?.detail || "フォルダーの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  if (isLoadingItems) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">ファイル情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an error loading items
  if (itemsError) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 md:p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircleIcon className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-red-600 mb-2">エラーが発生しました</h3>
          <p className="text-sm text-red-500 mb-4">
            ファイル情報の読み込みに失敗しました。
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  // Show empty state if no user is authenticated
  if (!currentUser) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircleIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-600 mb-2">認証が必要です</h3>
          <p className="text-sm text-slate-500 mb-4">
            ファイルを表示するにはログインしてください。
          </p>
          <Button 
            onClick={() => window.location.href = '/login'} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            ログイン
          </Button>
        </div>
      </div>
    );
  }

  // Show data validation message
  const hasRealData = individualFiles.length > 0 || folders.length > 0 || conversionJobs.length > 0;
  
  if (!isLoadingItems && !isLoadingJobs && !hasRealData) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">AI-OCR変換</h1>
          <p className="text-slate-600">
            アップロードされたファイルとフォルダーを指定してAI-OCR変換を実行します
          </p>
        </div>

        {/* No Data State */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileIcon className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-600 mb-2">アップロードされたファイルがありません</h3>
          <p className="text-sm text-slate-500 mb-4">
            現在、アップロードされたファイルやフォルダーはありません。<br />
            ファイルアップロードページでファイルをアップロードしてください。
          </p>
          <div className="flex justify-center gap-3">
            <Button 
              variant="outline" 
              className="bg-white"
              onClick={() => window.location.href = '/upload'}
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              ファイルをアップロード
            </Button>
            <Button 
              variant="outline" 
              className="bg-white"
              onClick={() => window.location.reload()}
            >
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              再読み込み
            </Button>
          </div>
        </div>

        {/* Statistics Cards - All Zero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">総ファイル数</p>
                  <p className="text-2xl font-bold text-blue-800">0</p>
                  <p className="text-xs text-blue-500 mt-1">アップロードされたファイルがありません</p>
                </div>
                <div className="w-12 h-12 bg-blue-200 rounded-xl flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">フォルダー数</p>
                  <p className="text-2xl font-bold text-amber-800">0</p>
                  <p className="text-xs text-amber-500 mt-1">アップロードされたフォルダーがありません</p>
                </div>
                <div className="w-12 h-12 bg-amber-200 rounded-xl flex items-center justify-center">
                  <FolderIcon className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">変換済み</p>
                  <p className="text-2xl font-bold text-green-800">0</p>
                  <p className="text-xs text-green-500 mt-1">変換されたファイルがありません</p>
                </div>
                <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">AI-OCR変換</h1>
        <p className="text-slate-600">
          アップロードされたファイルとフォルダーを指定してAI-OCR変換を実行します
        </p>
      </div>

      {/* File Management Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statistics Cards */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">総ファイル数</p>
                <p className="text-2xl font-bold text-blue-800">
                  {itemsResponse?.totalIndividualFiles || 0}
                </p>
                {itemsResponse?.totalIndividualFiles === 0 && (
                  <p className="text-xs text-blue-500 mt-1">アップロードされたファイルがありません</p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-200 rounded-xl flex items-center justify-center">
                <FileIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">フォルダー数</p>
                <p className="text-2xl font-bold text-amber-800">
                  {itemsResponse?.totalFolders || 0}
                </p>
                {itemsResponse?.totalFolders === 0 && (
                  <p className="text-xs text-amber-500 mt-1">アップロードされたフォルダーがありません</p>
                )}
              </div>
              <div className="w-12 h-12 bg-amber-200 rounded-xl flex items-center justify-center">
                <FolderIcon className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">選択済み</p>
                <p className="text-2xl font-bold text-green-800">
                  {selectedFolders.length + selectedFiles.length}
                </p>
                {selectedFolders.length === 0 && selectedFiles.length === 0 && (
                  <p className="text-xs text-green-500 mt-1">ファイルまたはフォルダーを選択してください</p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Files Section - Simplified */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileIcon className="w-5 h-5 text-blue-600" />
              <div>
                <CardTitle className="text-slate-800 text-base">
                  アップロード済みファイル ({individualFiles.length + folders.length})
                </CardTitle>
                <p className="text-xs text-slate-500">
                  変換したいファイルまたはフォルダーを選択してください
                </p>
              </div>
            </div>
            
            {/* Simplified Controls */}
            {(individualFiles.length > 0 || folders.length > 0) && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 pr-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs w-32"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="h-7 px-2 text-xs"
                >
                  {viewMode === 'grid' ? <ListIcon className="w-3 h-3" /> : <GridIcon className="w-3 h-3" />}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {individualFiles.length === 0 && folders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileIcon className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600 mb-2">アップロードされたファイルがありません</h3>
              <p className="text-sm text-slate-500 mb-4">
                ファイルアップロードページでファイルをアップロードしてください
              </p>
              <Button 
                variant="outline" 
                className="bg-white"
                onClick={() => window.location.href = '/upload'}
              >
                <UploadIcon className="w-4 h-4 mr-2" />
                ファイルをアップロード
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Folders Section - Simplified */}
              {folders.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <FolderIcon className="w-4 h-4 text-amber-600" />
                    フォルダー ({folders.length})
                  </h3>
                  <div className="space-y-2">
                    {folders.map((folder: any) => (
                      <div key={folder.name} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* Folder Header - Simplified */}
                        <div className={`p-2 border rounded-lg ${
                          selectedFolders.includes(folder.name) 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`folder-${folder.name}`}
                                checked={selectedFolders.includes(folder.name)}
                                onCheckedChange={(checked) => handleFolderToggle(folder.name, checked === true)}
                                disabled={isConverting}
                                className="h-4 w-4"
                              />
                              <FolderIcon className="w-4 h-4 text-amber-600" />
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-slate-800 text-sm truncate">
                                  {getFolderDisplayName(folder.name)}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-1.5 py-0.5">
                                    {folder.fileCount}ファイル
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {folder.uploadDate ? formatDate(folder.uploadDate) : '不明'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFolderExpansion(folder.name)}
                                className="h-6 w-6 p-0 hover:bg-slate-100"
                              >
                                {expandedFolders.includes(folder.name) ? (
                                  <ChevronDownIcon className="w-3 h-3" />
                                ) : (
                                  <ChevronRightIcon className="w-3 h-3" />
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(folder.name);
                                }}
                                title="フォルダーを削除"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Files in folder - Collapsible */}
                        <Collapsible open={expandedFolders.includes(folder.name)}>
                          <CollapsibleContent>
                            <div className="p-3 bg-white">
                              <div className="space-y-2">
                                {folder.files.map((file: any, index: number) => (
                                  <div 
                                    key={file.id} 
                                    className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100 hover:bg-slate-100 transition-colors"
                                  >
                                    <div className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm border">
                                      {getFileIcon(file.mimeType, file.originalName)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium text-slate-700 truncate text-xs">
                                          {file.originalName}
                                        </h4>
                                        {getFileTypeBadge(file.mimeType, file.originalName)}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>{formatFileSize(file.size)}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Files Section - Simplified */}
              {individualFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <FileIcon className="w-4 h-4 text-blue-600" />
                    個別ファイル ({filteredIndividualFiles.length})
                  </h3>
                  {viewMode === 'list' ? (
                    <div className="space-y-2">
                      {filteredIndividualFiles.length === 0 ? (
                        <div className="text-center py-6">
                          <SearchIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">
                            {searchTerm ? `"${searchTerm}" に一致するファイルが見つかりませんでした。` : 'ファイルがありません'}
                          </p>
                        </div>
                      ) : (
                        filteredIndividualFiles.map((file: any) => (
                          <div 
                            key={file.id} 
                            className={`group relative flex items-center gap-2 p-2 rounded-lg border transition-all duration-200 ${
                              selectedFiles.includes(file.id) 
                                ? 'border-blue-300 bg-blue-50' 
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Checkbox
                              id={`file-${file.id}`}
                              checked={selectedFiles.includes(file.id)}
                              onCheckedChange={(checked) => handleFileToggle(file.id, checked === true)}
                              disabled={isConverting}
                              className="h-4 w-4"
                            />
                            
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                              {getFileIcon(file.mimeType, file.originalName)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-slate-800 truncate text-sm">
                                {file.originalName}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                {getFileTypeBadge(file.mimeType, file.originalName)}
                                <span className="text-xs text-slate-500">
                                  {file.uploadedAt ? formatDate(file.uploadedAt) : '不明'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatFileSize(file.size)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewFile(file.id, file.originalName, file.mimeType);
                                }}
                                title="ファイルを表示"
                              >
                                <EyeIcon className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(file.id, file.originalName);
                                }}
                                title="ファイルをダウンロード"
                              >
                                <DownloadIcon className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(file.id, file.originalName);
                                }}
                                title="ファイルを削除"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {filteredIndividualFiles.length === 0 ? (
                        <div className="text-center py-6 col-span-full">
                          <SearchIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">
                            {searchTerm ? `"${searchTerm}" に一致するファイルが見つかりませんでした。` : 'ファイルがありません'}
                          </p>
                        </div>
                      ) : (
                        filteredIndividualFiles.map((file: any) => (
                          <div 
                            key={file.id} 
                            className={`group relative p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                              selectedFiles.includes(file.id) 
                                ? 'border-blue-300 bg-blue-50' 
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                            onClick={() => handleFileToggle(file.id, !selectedFiles.includes(file.id))}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Checkbox
                                id={`file-${file.id}`}
                                checked={selectedFiles.includes(file.id)}
                                onCheckedChange={(checked) => handleFileToggle(file.id, checked === true)}
                                disabled={isConverting}
                                className="h-4 w-4"
                              />
                              {getFileTypeBadge(file.mimeType, file.originalName)}
                            </div>
                            
                            <div className="text-center mb-2">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-1">
                                {getFileIcon(file.mimeType, file.originalName)}
                              </div>
                              <h3 className="font-medium text-slate-800 text-xs truncate">
                                {file.originalName}
                              </h3>
                            </div>
                            
                            <div className="space-y-1 text-xs text-slate-500 mb-2">
                              <div className="flex items-center justify-between">
                                <span>アップロード日</span>
                                <span>{file.uploadedAt ? formatDate(file.uploadedAt) : '不明'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>ファイルサイズ</span>
                                <span>{formatFileSize(file.size)}</span>
                              </div>
                            </div>
                            
                            {/* Action buttons for grid view */}
                            <div className="flex items-center justify-center gap-1 pt-2 border-t border-slate-200">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewFile(file.id, file.originalName, file.mimeType);
                                }}
                                title="ファイルを表示"
                              >
                                <EyeIcon className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(file.id, file.originalName);
                                }}
                                title="ファイルをダウンロード"
                              >
                                <DownloadIcon className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(file.id, file.originalName);
                                }}
                                title="ファイルを削除"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
        {itemsResponse?.pagination && (
          <div className="mt-6">
            <div className="text-center text-sm text-slate-500 mb-4">
              ページ {itemsResponse.pagination.page} / {itemsResponse.pagination.totalPages} 
              (全 {itemsResponse.totalIndividualFiles} ファイル中 {((itemsResponse.pagination.page - 1) * itemsPerPage) + 1} - {Math.min(itemsResponse.pagination.page * itemsPerPage, itemsResponse.totalIndividualFiles)} を表示)
            </div>
            <Pagination
              currentPage={itemsResponse.pagination.page}
              totalPages={itemsResponse.pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </Card>

      {/* Conversion Progress Section - Compact */}
      {conversionJobs.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg" data-section="conversion-progress">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <RefreshCwIcon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-blue-800 text-base">
                    変換進捗 ({conversionJobs.length})
                  </CardTitle>
                  <p className="text-xs text-blue-600">
                    完了: {conversionJobs.filter((job: any) => job.status === 'completed').length} | 
                    失敗: {conversionJobs.filter((job: any) => job.status === 'failed').length} |
                    処理中: {conversionJobs.filter((job: any) => job.status === 'processing').length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {conversionJobs.filter((job: any) => job.status === 'completed').length > 0 && (
                  <Button
                    onClick={handleDeleteAllCompletedJobs}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                  >
                    <TrashIcon className="w-3 h-3 mr-1" />
                    完了済みを削除
                  </Button>
                )}
                <Button
                  onClick={handleViewConversionResults}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                >
                  <EyeIcon className="w-4 h-4 mr-2" />
                  結果表示
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Failed Jobs Toggle */}
            {conversionJobs.filter((job: any) => job.status === 'failed').length > 0 && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircleIcon className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                      失敗したジョブ ({conversionJobs.filter((job: any) => job.status === 'failed').length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFailedJobs(!showFailedJobs)}
                      className="text-xs h-6 px-2 text-red-600 hover:bg-red-100"
                    >
                      {showFailedJobs ? (
                        <>
                          <ChevronUpIcon className="w-3 h-3 mr-1" />
                          非表示
                        </>
                      ) : (
                        <>
                          <ChevronDownIcon className="w-3 h-3 mr-1" />
                          表示
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteAllFailedJobs}
                      className="text-xs h-6 px-2 text-red-600 hover:bg-red-100"
                    >
                      <TrashIcon className="w-3 h-3 mr-1" />
                      全削除
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {conversionJobs
                .filter((job: any) => job.status !== 'failed' || showFailedJobs)
                .map((job: any) => (
                <div key={job.id} className={`p-3 rounded-lg border transition-all duration-200 ${
                  job.status === 'completed' ? 'bg-green-50 border-green-200' :
                  job.status === 'processing' ? 'bg-blue-50 border-blue-200' :
                  job.status === 'failed' ? 'bg-red-50 border-red-200' :
                  'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                        {job.status === 'completed' ? (
                          <CheckCircleIcon className="w-4 h-4 text-green-600" />
                        ) : job.status === 'processing' ? (
                          <RefreshCwIcon className="w-4 h-4 text-blue-600 animate-spin" />
                        ) : job.status === 'failed' ? (
                          <AlertCircleIcon className="w-4 h-4 text-red-600" />
                        ) : (
                          <ClockIcon className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 text-sm truncate">
                          {job.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              job.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                              job.status === 'processing' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              job.status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' :
                              'bg-amber-100 text-amber-700 border-amber-200'
                            }`}
                          >
                            {job.status === 'completed' ? '完了' : 
                             job.status === 'processing' ? '処理中' : 
                             job.status === 'failed' ? '失敗' : '待機中'}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {job.processedFiles}/{job.totalFiles} ファイル
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Progress indicator */}
                      <div className="w-16 bg-slate-200 rounded-full h-1.5 mr-2">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            job.status === 'completed' ? 'bg-green-500' :
                            job.status === 'processing' ? 'bg-blue-500' : 
                            job.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {job.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetryJob(job.id)}
                            className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                            title="再試行"
                          >
                            <RefreshCwIcon className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteJob(job.id, job.name)}
                          className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                          disabled={job.status === 'processing'}
                          title="削除"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversion Controls */}
      {(folders.length > 0 || individualFiles.length > 0) && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <SettingsIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-green-800 text-lg">
                  変換設定
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  {selectedFolders.length > 0 || selectedFiles.length > 0 ? (
                    <div className="space-y-2">
                      {selectedFolders.length > 0 && (
                        <div className="flex items-center gap-2 text-green-600 font-medium">
                          <FolderIcon className="w-4 h-4" />
                          {selectedFolders.length}個のフォルダー
                          <span className="text-xs text-slate-500">
                            ({selectedFolders.join(', ')})
                          </span>
                        </div>
                      )}
                      {selectedFiles.length > 0 && (
                        <div className="flex items-center gap-2 text-blue-600 font-medium">
                          <FileIcon className="w-4 h-4" />
                          {selectedFiles.length}個のファイル
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-2">
                        {selectedFolders.length > 1 ? 
                          `複数のフォルダーが選択されています。変換後は${selectedFolders.length}個の変換結果フォルダーが作成されます。` :
                          selectedFolders.length === 1 ?
                          '1つのフォルダーが選択されています。変換後は1つの変換結果フォルダーが作成されます。' :
                          ''
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500">
                      <AlertCircleIcon className="w-4 h-4" />
                      フォルダーまたはファイルを選択してください
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFolders([]);
                      setSelectedFiles([]);
                    }}
                    disabled={isConverting}
                    className="border-slate-300 hover:bg-slate-50"
                  >
                    <TrashIcon className="w-4 h-4 mr-2" />
                    選択クリア
                  </Button>
                  <Button
                    onClick={handleStartConversion}
                    disabled={isConverting || (selectedFolders.length === 0 && selectedFiles.length === 0)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
                    size="lg"
                  >
                    {isConverting ? (
                      <>
                        <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                        変換中...
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4 mr-2" />
                        {selectedFolders.length > 0 && selectedFiles.length > 0 
                          ? "選択したアイテムで変換開始"
                          : selectedFolders.length > 0 
                          ? selectedFolders.length > 1 
                            ? `${selectedFolders.length}個のフォルダーで変換開始`
                            : "選択したフォルダーで変換開始"
                          : "選択したファイルで変換開始"
                        }
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* File Preview Modal */}
      {previewModal.isOpen && (
        <div style={{ display: 'none' }}>
          Debug: {JSON.stringify(previewModal)}
        </div>
      )}
      <FilePreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal(prev => ({ ...prev, isOpen: false }))}
        fileId={previewModal.fileId}
        fileName={previewModal.fileName}
        mimeType={previewModal.mimeType}
      />
    </div>
  );
}
