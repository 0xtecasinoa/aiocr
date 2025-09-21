import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CloudUploadIcon, FileIcon, FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadAreaProps {
  onFilesSelected: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export default function UploadArea({ 
  onFilesSelected, 
  accept = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls",
  multiple = true,
  disabled = false 
}: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [disabled, onFilesSelected]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  return (
    <Card 
      className={cn(
        "border-2 border-dashed transition-colors cursor-pointer",
        isDragOver 
          ? "border-primary bg-blue-50" 
          : "border-slate-300 hover:border-primary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="upload-area"
    >
      <CardContent className="p-12 text-center">
        <div className="space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <CloudUploadIcon className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-slate-700">
              ファイルをドラッグ&ドロップ
            </p>
            <p className="text-slate-500">または クリックしてファイルを選択</p>
          </div>
          <div className="flex justify-center space-x-4">
            <div className="relative">
              <input
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={disabled}
                data-testid="input-file-select"
              />
              <Button 
                variant="default" 
                disabled={disabled}
                data-testid="button-file-select"
              >
                <FileIcon className="w-4 h-4 mr-2" />
                ファイル選択
              </Button>
            </div>
            <div className="relative">
              <input
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={disabled}
                data-testid="input-folder-select"
                // @ts-ignore - webkitdirectory is not in the types but is supported
                webkitdirectory=""
              />
              <Button 
                variant="outline" 
                disabled={disabled}
                data-testid="button-folder-select"
              >
                <FolderIcon className="w-4 h-4 mr-2" />
                フォルダ選択
              </Button>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            対応形式: PDF, JPEG, PNG, Excel (.xlsx, .xls)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
