import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// Excel Inline Preview Component (simplified version)
function ExcelInlinePreview({ fileId, fileName, mimeType }: {
  fileId: string;
  fileName: string;
  mimeType: string;
}) {
  const [excelData, setExcelData] = React.useState<any[][]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadExcelFile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get the Excel file as blob
        const blob = await apiClient.serveFile(fileId);
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        
        // Import xlsx dynamically
        const XLSX = await import('xlsx');
        
        // Read the workbook
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Convert first sheet to JSON (limit to first 10 rows for preview)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false
        }) as any[][];
        
        // Limit to first 10 rows for inline preview
        setExcelData(jsonData.slice(0, 10));
        
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

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-3"></div>
        <p className="text-sm text-slate-600">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-slate-600">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-lg flex items-center justify-center">
          <FileText className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium mb-2">Excel ファイル</h3>
        <p className="text-sm text-slate-500 mb-4">{fileName}</p>
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 text-center">
        <h3 className="text-sm font-medium text-slate-800">Excel プレビュー</h3>
        <p className="text-xs text-slate-500">{fileName}</p>
      </div>
      
      {excelData.length > 0 ? (
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {excelData.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex === 0 ? 'bg-slate-50 font-medium' : ''}>
                  {row.slice(0, 5).map((cell, cellIndex) => ( // Limit to 5 columns for inline view
                    <td 
                      key={cellIndex}
                      className="border border-slate-200 px-2 py-1 min-w-[60px] max-w-[120px] truncate"
                      title={String(cell)}
                    >
                      {String(cell)}
                    </td>
                  ))}
                  {row.length > 5 && (
                    <td className="border border-slate-200 px-2 py-1 text-slate-400">
                      ...
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-4 text-slate-500 text-xs">
          データがありません
        </div>
      )}
      
      <div className="mt-2 text-center">
        <p className="text-xs text-slate-500">
          {excelData.length > 0 ? `${Math.min(excelData.length, 10)} 行表示` : ''}
          {excelData.length >= 10 && ' (一部のみ)'}
        </p>
      </div>
    </div>
  );
}

interface FilePreviewInlineProps {
  fileId: string | null;
  className?: string;
}

interface FileInfo {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  preview_url?: string;
}

export default function FilePreviewInline({ fileId, className = "" }: FilePreviewInlineProps) {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setFileInfo(null);
      setPreviewUrl(null);
      return;
    }

    loadFilePreview();
  }, [fileId]);

  const loadFilePreview = async () => {
    if (!fileId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Loading file preview for:', fileId);

      // Get file information
      const fileInfoResponse = await apiClient.viewFile(fileId);
      if (!fileInfoResponse?.file) {
        throw new Error('File information not found');
      }

      const file = fileInfoResponse.file;
      setFileInfo(file);

      // Load preview based on file type
      if (file.mime_type.startsWith('image/')) {
        // For images, get the blob and create object URL
        const blob = await apiClient.serveFile(fileId);
        if (blob && blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } else {
          throw new Error('Failed to load image file');
        }
      } else if (file.mime_type === 'application/pdf') {
        // For PDFs, create a URL that can be used in iframe
        const blob = await apiClient.serveFile(fileId);
        if (blob && blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } else {
          throw new Error('Failed to load PDF file');
        }
      } else if (
        file.mime_type === 'application/vnd.ms-excel' ||
        file.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.original_name?.toLowerCase().endsWith('.xls') ||
        file.original_name?.toLowerCase().endsWith('.xlsx')
      ) {
        // For Excel files, we'll show file info instead of trying to preview
        // The file content will be processed by OCR instead
        setPreviewUrl('excel-file');
      }

    } catch (err) {
      console.error('Error loading file preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fileId || !fileInfo) return;

    try {
      const blob = await apiClient.serveFile(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.original_name || fileInfo.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  };

  if (!fileId) {
    return (
      <div className={`border border-slate-200 rounded-lg p-4 bg-slate-50 ${className}`}>
        <div className="text-center text-slate-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">ファイル情報がありません</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`border border-slate-200 rounded-lg p-4 ${className}`}>
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`border border-red-200 rounded-lg p-4 bg-red-50 ${className}`}>
        <div className="text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium">ファイルの読み込みに失敗しました</p>
          <p className="text-xs mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadFilePreview}
            className="mt-2"
          >
            再試行
          </Button>
        </div>
      </div>
    );
  }

  if (!fileInfo) {
    return (
      <div className={`border border-slate-200 rounded-lg p-4 bg-slate-50 ${className}`}>
        <div className="text-center text-slate-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">ファイルが見つかりません</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* File Info Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {getFileIcon(fileInfo.mime_type)}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-slate-700 truncate" title={fileInfo.original_name}>
                {fileInfo.original_name}
              </p>
              <p className="text-xs text-slate-500">
                {formatFileSize(fileInfo.file_size)} • {fileInfo.mime_type}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs flex-shrink-0"
          >
            <Download className="w-3 h-3 mr-1" />
            ダウンロード
          </Button>
        </div>
      </div>

      {/* File Preview */}
      <div className="p-4">
        <ScrollArea className="max-h-80 w-full">
          {fileInfo.mime_type.startsWith('image/') && previewUrl && previewUrl !== 'excel-file' ? (
            <div className="text-center">
              <img
                src={previewUrl}
                alt={fileInfo.original_name}
                className="max-w-full h-auto rounded-lg shadow-sm mx-auto"
                style={{ maxHeight: '300px', maxWidth: '100%' }}
                onError={() => setError('画像の表示に失敗しました')}
              />
            </div>
          ) : fileInfo.mime_type === 'application/pdf' && previewUrl && previewUrl !== 'excel-file' ? (
            <div className="w-full h-72 border border-slate-200 rounded-lg overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full"
                title={fileInfo.original_name}
                onError={() => setError('PDFの表示に失敗しました')}
              />
            </div>
          ) : previewUrl === 'excel-file' ? (
            <ExcelInlinePreview 
              fileId={fileId}
              fileName={fileInfo.original_name}
              mimeType={fileInfo.mime_type}
            />
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-sm">このファイル形式はプレビューできません</p>
              <p className="text-xs mt-1">ダウンロードしてご確認ください</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
} 