import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileIcon, 
  FileTextIcon, 
  ImageIcon, 
  FileSpreadsheetIcon,
  DownloadIcon,
  CalendarIcon,
  HardDriveIcon,
  FolderIcon,
  XIcon,
  InfoIcon,
  EyeIcon
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import React from "react";

// Excel Preview Component
function ExcelPreview({ fileId, fileName, mimeType }: {
  fileId: string;
  fileName: string;
  mimeType: string;
}) {
  const [excelData, setExcelData] = React.useState<any[][]>([]);
  const [sheetNames, setSheetNames] = React.useState<string[]>([]);
  const [activeSheet, setActiveSheet] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
    const loadExcelFile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Starting Excel file load for fileId:', fileId);
        
        // Get the Excel file as blob
        console.log('Fetching file blob...');
        const blob = await apiClient.serveFile(fileId);
        console.log('Blob received:', { size: blob.size, type: blob.type });
        
        if (blob.size === 0) {
          throw new Error('ファイルが空です');
        }
        
        // Convert blob to array buffer
        console.log('Converting blob to array buffer...');
        const arrayBuffer = await blob.arrayBuffer();
        console.log('Array buffer created:', { byteLength: arrayBuffer.byteLength });
        
        // Import xlsx dynamically to avoid SSR issues
        console.log('Importing XLSX library...');
        const XLSX = await import('xlsx');
        console.log('XLSX library imported successfully');
        
        // Read the workbook
        console.log('Reading workbook...');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        console.log('Workbook read successfully:', { sheetNames: workbook.SheetNames });
        
        // Get sheet names
        const sheets = workbook.SheetNames;
        setSheetNames(sheets);
        setActiveSheet(sheets[0]);
        
        // Convert first sheet to JSON
        console.log('Converting sheet to JSON...');
        const worksheet = workbook.Sheets[sheets[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false
        }) as any[][];
        
        console.log('Excel data converted:', { 
          rows: jsonData.length, 
          columns: jsonData[0]?.length || 0 
        });
        
        setExcelData(jsonData);
        
      } catch (err) {
         console.error('Error loading Excel file:', err);
         console.error('Error details:', {
           fileId,
           fileName,
           mimeType,
           error: err
         });
         setError(`Excelファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
       } finally {
        setIsLoading(false);
      }
    };

    loadExcelFile();
  }, [fileId]);

  const switchSheet = async (sheetName: string) => {
    try {
      setActiveSheet(sheetName);
      setIsLoading(true);
      
      const blob = await apiClient.serveFile(fileId);
      const arrayBuffer = await blob.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        raw: false
      }) as any[][];
      
      setExcelData(jsonData);
    } catch (err) {
      console.error('Error switching sheet:', err);
      setError('シートの切り替えに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">Excelファイルを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center py-8">
          <FileSpreadsheetIcon className="w-16 h-16 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-3">{error}</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${apiClient.baseUrl}/api/v1/files/serve/${fileId}`, '_blank')}
          >
            ダウンロード
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with sheet tabs */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <FileSpreadsheetIcon className="w-5 h-5 text-green-600" />
          <h3 className="font-medium text-slate-800">{fileName}</h3>
        </div>
        {sheetNames.length > 1 && (
          <div className="flex gap-1">
            {sheetNames.map((sheetName) => (
              <button
                key={sheetName}
                onClick={() => switchSheet(sheetName)}
                className={`px-3 py-1 text-xs rounded ${
                  activeSheet === sheetName
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sheetName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Excel content */}
      <div className="flex-1 overflow-auto p-4">
        {excelData.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {excelData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex === 0 ? 'bg-slate-50 font-medium' : ''}>
                    {row.map((cell, cellIndex) => (
                      <td 
                        key={cellIndex}
                        className="border border-slate-200 px-2 py-1 min-w-[80px] max-w-[200px] truncate"
                        title={String(cell)}
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>このシートにはデータがありません</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t bg-slate-50">
        <div className="flex justify-between items-center text-xs text-slate-600">
          <span>
            {excelData.length > 0 ? `${excelData.length} 行` : '0 行'} 
            {excelData[0] ? ` × ${excelData[0].length} 列` : ''}
          </span>
          <span>シート: {activeSheet}</span>
        </div>
      </div>
    </div>
  );
}

// ImagePreview component that handles authentication
function ImagePreview({ fileId, fileName, onLoad, onError, style }: {
  fileId: string;
  fileName: string;
  onLoad: () => void;
  onError: () => void;
  style?: React.CSSProperties;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const loadImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        console.log('Loading image for fileId:', fileId);
        
        // First try to get file info
        console.log('Step 1: Getting file info...');
        const fileInfo = await apiClient.viewFile(fileId);
        console.log('File info received:', fileInfo);
        
        if (!fileInfo || !fileInfo.file) {
          throw new Error('File info not found');
        }
        
        // Test file access
        console.log('Step 1.5: Testing file access...');
        try {
          const testResponse = await fetch(`${apiClient.baseUrl}/api/v1/files/test/${fileId}`, {
            headers: {
              'Authorization': `Bearer ${apiClient.getAccessToken()}`
            }
          });
          const testData = await testResponse.json();
          console.log('File access test result:', testData);
        } catch (testError) {
          console.warn('File access test failed:', testError);
        }
        
        // Then get the image blob
        console.log('Step 2: Getting image blob...');
        const blob = await apiClient.serveFile(fileId);
        console.log('Image blob received:', blob);
        console.log('Blob size:', blob.size);
        console.log('Blob type:', blob.type);
        
        if (!blob || blob.size === 0) {
          throw new Error('Empty blob received');
        }
        
        console.log('Step 3: Creating object URL...');
        const url = URL.createObjectURL(blob);
        console.log('Object URL created:', url);
        
        setImageSrc(url);
        setIsLoading(false);
        onLoad();
        console.log('Image loaded successfully');
      } catch (error) {
        console.error('Error loading image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error details:', errorMessage);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        setHasError(true);
        setIsLoading(false);
        onError();
      }
    };

    if (fileId) {
      loadImage();
    }

    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [fileId, onLoad, onError]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">画像を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="text-center">
        <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-slate-600 mb-3">画像の読み込みに失敗しました</p>
        <div className="flex gap-2 justify-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${apiClient.baseUrl}/api/v1/files/serve/${fileId}`, '_blank')}
          >
            新しいタブで開く
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={async () => {
              try {
                const blob = await apiClient.serveFile(fileId);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Download error:', error);
              }
            }}
          >
            <DownloadIcon className="w-3 h-3 mr-1" />
            ダウンロード
          </Button>
        </div>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className="text-center">
        <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-slate-600">画像が見つかりません</p>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={fileName}
      className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
      style={style}
      onError={() => {
        console.error('Image load error in img tag');
        setHasError(true);
        onError();
      }}
    />
  );
}

// PdfPreview component that handles authentication
function PdfPreview({ fileId, fileName }: {
  fileId: string;
  fileName: string;
}) {
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    const loadPdf = async () => {
      try {
        const blob = await apiClient.serveFile(fileId);
        const url = URL.createObjectURL(blob);
        setPdfSrc(url);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setHasError(true);
      }
    };

    loadPdf();

    return () => {
      if (pdfSrc) {
        URL.revokeObjectURL(pdfSrc);
      }
    };
  }, [fileId]);

  if (hasError) {
    return null; // Let the error fallback handle it
  }

  if (!pdfSrc) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-sm text-slate-600">PDFを読み込み中...</p>
      </div>
    );
  }

  return (
    <iframe
      src={pdfSrc}
      className="w-full h-full min-h-[500px] border-0 rounded-lg"
      title={fileName}
      onError={() => setHasError(true)}
    />
  );
}

// TextPreview component that handles authentication
function TextPreview({ fileId, fileName }: {
  fileId: string;
  fileName: string;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    const loadText = async () => {
      try {
        const blob = await apiClient.serveFile(fileId);
        const text = await blob.text();
        setTextContent(text);
      } catch (error) {
        console.error('Error loading text:', error);
        setHasError(true);
      }
    };

    loadText();
  }, [fileId]);

  if (hasError) {
    return null; // Let the error fallback handle it
  }

  if (!textContent) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-sm text-slate-600">テキストを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] border rounded-lg bg-white p-4 overflow-auto">
      <pre className="text-sm text-slate-800 whitespace-pre-wrap font-mono">
        {textContent}
      </pre>
    </div>
  );
}



interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  mimeType: string;
}

export function FilePreviewModal({ isOpen, onClose, fileId, fileName, mimeType }: FilePreviewModalProps) {
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const { toast } = useToast();

  const loadFileInfo = async () => {
    if (!isOpen || !fileId) return;
    
    setIsLoading(true);
    try {
      console.log('Loading file info for fileId:', fileId);
      const response = await apiClient.viewFile(fileId);
      console.log('File info response:', response);
      console.log('File MIME type:', response.file?.mime_type);
      console.log('File name:', response.file?.original_name);
      setFileInfo(response.file);
    } catch (error) {
      console.error('Error loading file info:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "エラー",
        description: `ファイル情報の読み込みに失敗しました: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
    }
  };

  const getFileIcon = (mimeType: string, fileName: string) => {
    const iconClass = "w-6 h-6";
    
    if (mimeType.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i)) {
      return <ImageIcon className={`${iconClass} text-blue-500`} />;
    }
    if (mimeType.includes('pdf') || fileName.match(/\.pdf$/i)) {
      return <FileTextIcon className={`${iconClass} text-red-500`} />;
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || fileName.match(/\.(xls|xlsx|csv)$/i)) {
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
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">画像</Badge>;
    }
    if (mimeType.includes('pdf') || fileName.match(/\.pdf$/i)) {
      return <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 text-xs">PDF</Badge>;
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || fileName.match(/\.(xls|xlsx|csv)$/i)) {
      return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs">表計算</Badge>;
    }
    if (mimeType.includes('word') || mimeType.includes('document') || fileName.match(/\.(doc|docx|rtf)$/i)) {
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">文書</Badge>;
    }
    if (fileName.match(/\.txt$/i)) {
      return <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">テキスト</Badge>;
    }
    if (fileName.match(/\.(zip|rar|7z|tar|gz)$/i)) {
      return <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">アーカイブ</Badge>;
    }
    return <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">その他</Badge>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isImageFile = fileInfo?.mime_type?.startsWith('image/') || fileInfo?.original_name?.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i) || fileName.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i);
  const isPdfFile = fileInfo?.mime_type?.includes('pdf') || fileInfo?.original_name?.match(/\.pdf$/i) || fileName.match(/\.pdf$/i);
  const isExcelFile = (
    fileInfo?.mime_type === 'application/vnd.ms-excel' ||
    fileInfo?.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileInfo?.mime_type?.includes('excel') || 
    fileInfo?.mime_type?.includes('spreadsheet') || 
    fileInfo?.original_name?.match(/\.(xls|xlsx)$/i) || 
    fileName.match(/\.(xls|xlsx)$/i)
  );
  const isTextFile = fileInfo?.mime_type?.includes('text') || fileInfo?.original_name?.match(/\.(txt|md|log)$/i) || fileName.match(/\.(txt|md|log)$/i);

  // Load file info when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadFileInfo();
      setActiveTab("preview");
      if (isImageFile) {
        setImageLoading(true);
      }
    }
  }, [isOpen, fileId]);

  // Debug logging for file type detection
  React.useEffect(() => {
    if (fileInfo) {
      console.log('File type detection:', {
        fileName: fileInfo.original_name,
        mimeType: fileInfo.mime_type,
        isImageFile,
        isPdfFile,
        isExcelFile,
        isTextFile
      });
    }
  }, [fileInfo, isImageFile, isPdfFile, isExcelFile, isTextFile]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden [&>button]:hidden">
        <DialogHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                {getFileIcon(mimeType, fileName)}
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800 truncate max-w-md">
                  {fileName}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {getFileTypeBadge(mimeType, fileName)}
                  {fileInfo && (
                    <span className="text-xs text-slate-500">
                      {formatFileSize(fileInfo.file_size)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-slate-600">読み込み中...</span>
          </div>
        ) : fileInfo ? (
          <div className="flex flex-col h-full">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value);
              if (value === "preview" && isImageFile) {
                setImageLoading(true);
              }
            }} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <EyeIcon className="w-4 h-4" />
                  プレビュー
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <InfoIcon className="w-4 h-4" />
                  詳細情報
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="flex-1 mt-4">
                <div className="h-full flex flex-col">
                  {/* Preview Content */}
                  <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-lg p-4 min-h-[400px]">
                    {isImageFile ? (
                      <div className="max-w-full max-h-full flex items-center justify-center">
                        <ImagePreview 
                          fileId={fileId}
                          fileName={fileInfo.original_name}
                          onLoad={() => setImageLoading(false)}
                          onError={() => setImageLoading(false)}
                          style={{ maxHeight: '500px', display: 'block' }}
                        />
                      </div>
                    ) : isPdfFile ? (
                      <div className="w-full h-full">
                        <PdfPreview 
                          fileId={fileId}
                          fileName={fileInfo.original_name}
                        />
                        <div className="hidden text-center">
                          <FileTextIcon className="w-16 h-16 text-red-400 mx-auto mb-3" />
                          <p className="text-sm text-slate-600 mb-3">PDFの読み込みに失敗しました</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`${apiClient.baseUrl}/api/v1/files/serve/${fileId}`, '_blank')}
                          >
                            PDFを開く
                          </Button>
                        </div>
                      </div>
                    ) : isExcelFile ? (
                      <div className="w-full h-full">
                        <ExcelPreview 
                          fileId={fileId}
                          fileName={fileInfo.original_name}
                          mimeType={fileInfo.mime_type}
                        />
                      </div>
                    ) : isTextFile ? (
                      <div className="w-full h-full">
                        <TextPreview 
                          fileId={fileId}
                          fileName={fileInfo.original_name}
                        />
                        <div className="hidden text-center">
                          <FileTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm text-slate-600 mb-3">テキストファイルの読み込みに失敗しました</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`${apiClient.baseUrl}/api/v1/files/serve/${fileId}`, '_blank')}
                          >
                            テキストを開く
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <FileIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-slate-600 mb-3">プレビュー不可</p>
                        <p className="text-xs text-slate-500 mb-3">このファイルタイプはプレビューできません</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`${apiClient.baseUrl}/api/v1/files/serve/${fileId}`, '_blank')}
                        >
                          新しいタブで開く
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Preview Actions */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t">
                    <div className="text-xs text-slate-500">
                      {fileInfo.original_name}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`${apiClient.baseUrl}/api/v1/files/serve/${fileId}`, '_blank')}
                      >
                        新しいタブで開く
                      </Button>
                      <Button 
                        onClick={handleDownload}
                        disabled={isDownloading}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isDownloading ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                            ダウンロード中...
                          </>
                        ) : (
                          <>
                            <DownloadIcon className="w-3 h-3 mr-1" />
                            ダウンロード
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="flex-1 mt-4">
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {/* File Header */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border">
                      {getFileIcon(fileInfo.mime_type, fileInfo.original_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-800 truncate">
                        {fileInfo.original_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getFileTypeBadge(fileInfo.mime_type, fileInfo.original_name)}
                        <span className="text-xs text-slate-500">
                          {formatFileSize(fileInfo.file_size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* File Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">ファイル名</label>
                        <p className="text-sm text-slate-800 font-mono">{fileInfo.filename}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">MIMEタイプ</label>
                        <p className="text-sm text-slate-800">{fileInfo.mime_type}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">ファイルサイズ</label>
                        <p className="text-sm text-slate-800">{formatFileSize(fileInfo.file_size)}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">アップロード日時</label>
                        <p className="text-sm text-slate-800">{formatDate(fileInfo.created_at)}</p>
                      </div>
                      {fileInfo.folder_name && (
                        <div>
                          <label className="text-xs font-medium text-slate-600">フォルダー</label>
                          <div className="flex items-center gap-2">
                            <FolderIcon className="w-3 h-3 text-amber-500" />
                            <p className="text-sm text-slate-800">{fileInfo.folder_name}</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-slate-600">ステータス</label>
                        <Badge variant="outline" className="text-xs">
                          {fileInfo.upload_status === 'completed' ? '完了' : fileInfo.upload_status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* File Path */}
                  <div>
                    <label className="text-xs font-medium text-slate-600">ファイルパス</label>
                    <p className="text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded mt-1 break-all">
                      {fileInfo.file_path}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileIcon className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 mb-1">ファイルが見つかりません</h3>
            <p className="text-xs text-slate-500">
              ファイル情報の読み込みに失敗しました。
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 
