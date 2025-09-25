import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SaveIcon, XIcon, FileTextIcon, InfoIcon, EditIcon } from "lucide-react";
import { ExtractedData, UpdateExtractedData } from "../types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FilePreviewInline from "./file-preview-inline";

interface EnhancedDataEditorProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExtractedData | null;
}

interface EditableField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea';
  required?: boolean;
}

export default function EnhancedDataEditor({ isOpen, onClose, item }: EnhancedDataEditorProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showNGOnly, setShowNGOnly] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Define editable fields in Excel-like format
  const editableFields: EditableField[] = [
    { key: 'productName', label: '商品名', type: 'text', required: true },
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'jan_code', label: 'JANコード', type: 'text' },
    { key: 'price', label: '価格', type: 'number' },
    { key: 'stock', label: '在庫数', type: 'number' },
    { key: 'category', label: 'カテゴリ', type: 'text' },
    { key: 'brand', label: 'ブランド', type: 'text' },
    { key: 'manufacturer', label: '製造元', type: 'text' },
    { key: 'description', label: '商品説明', type: 'textarea' },
    { key: 'weight', label: '重量', type: 'text' },
    { key: 'color', label: '色', type: 'text' },
    { key: 'material', label: '素材', type: 'text' },
    { key: 'origin', label: '原産地', type: 'text' },
    { key: 'warranty', label: '保証', type: 'text' }
  ];

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      const initialData: Record<string, any> = {};
      editableFields.forEach(field => {
        // Map API response field names to form field names
        let value = '';
        switch (field.key) {
          case 'productName':
            value = (item as any).productName || '';
            break;
          case 'jan_code':
            value = (item as any).jan_code || '';
            break;
          default:
            value = (item as any)[field.key] || '';
        }
        initialData[field.key] = value;
      });
      setFormData(initialData);
      setHasChanges(false);
    }
  }, [item]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateExtractedData) => {
      if (!item) throw new Error("No item to update");
      return apiClient.updateExtractedData(item.id, data);
    },
    onSuccess: () => {
      toast({
        title: "保存完了",
        description: "データが正常に保存されました。",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["extractedData"] });
      onClose();
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast({
        title: "保存エラー",
        description: "データの保存に失敗しました。",
        variant: "destructive",
      });
    },
  });

  // Handle cell value change
  const handleCellChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  // Handle save
  const handleSave = () => {
    if (!item) return;
    
    // Convert form data to API format
    const updateData: UpdateExtractedData = {
      product_name: formData.productName,
      sku: formData.sku,
      price: formData.price ? parseFloat(formData.price) : undefined,
      stock: formData.stock ? parseInt(formData.stock) : undefined,
      category: formData.category,
      brand: formData.brand,
      manufacturer: formData.manufacturer,
      description: formData.description,
      jan_code: formData.jan_code,
      weight: formData.weight,
      color: formData.color,
      material: formData.material,
      origin: formData.origin,
      warranty: formData.warranty,
      is_validated: true,
    };
    
    updateMutation.mutate(updateData);
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      if (confirm("変更内容が失われますが、キャンセルしますか？")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Get display filename
  const getDisplayFileName = () => {
    if (!item) return "不明なファイル";
    return (item as any).original_filename || `ファイル_${item.id?.slice(-8)}`;
  };

  // Get status badge
  const getStatusBadge = () => {
    if (!item) return null;
    if (item.is_validated) {
      return <Badge className="bg-green-100 text-green-700">修正済み</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-700">未確認</Badge>;
  };

  // Check if a field has NG validation issues
  const isFieldNG = (fieldKey: string, value: any): boolean => {
    // Define NG conditions for different field types
    switch (fieldKey) {
      case 'productName':
        return !value || value.trim() === '' || value === '不明' || value === 'Unknown';
      case 'price':
        return value !== undefined && value !== null && value !== '' && (isNaN(value) || value <= 0);
      case 'stock':
        return value !== undefined && value !== null && value !== '' && (isNaN(value) || value < 0);
      case 'jan_code':
        return value && value.length > 0 && !/^[0-9]{8}$|^[0-9]{13}$/.test(value);
      case 'sku':
        return !value || value.trim() === '';
      default:
        // For other fields, consider empty or placeholder values as potential NG
        return !value || value.trim() === '' || value === '不明' || value === 'Unknown' || value === 'N/A';
    }
  };

  // Get fields that have NG validation issues
  const getNGFields = () => {
    return editableFields.filter(field => isFieldNG(field.key, formData[field.key]));
  };

  // Get filtered fields based on NG filter
  const getFilteredFields = () => {
    if (showNGOnly) {
      return getNGFields();
    }
    return editableFields;
  };

  // Render editable cell
  const renderEditableCell = (field: EditableField, value: any, isNG: boolean = false) => {
    const isEditing = editingCell === field.key;
    
    if (isEditing) {
      return (
        <div className="w-full">
          {field.type === 'textarea' ? (
            <textarea
              value={value || ''}
              onChange={(e) => handleCellChange(field.key, e.target.value)}
              onBlur={() => setEditingCell(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  setEditingCell(null);
                } else if (e.key === 'Escape') {
                  setEditingCell(null);
                }
              }}
              className="w-full p-2 border border-blue-500 rounded resize-none"
              rows={3}
              autoFocus
            />
          ) : (
            <Input
              type={field.type}
              value={value || ''}
              onChange={(e) => handleCellChange(field.key, e.target.value)}
              onBlur={() => setEditingCell(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditingCell(null);
                } else if (e.key === 'Escape') {
                  setEditingCell(null);
                }
              }}
              className="w-full border-blue-500"
              autoFocus
            />
          )}
        </div>
      );
    }

    return (
      <div
        className={`w-full p-2 min-h-[40px] cursor-pointer rounded border transition-colors ${
          isNG 
            ? 'bg-yellow-50 hover:bg-yellow-100 border-orange-200 hover:border-orange-300' 
            : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
        }`}
        onClick={() => setEditingCell(field.key)}
        title="クリックして編集"
      >
        <span className={`${
          isNG 
            ? 'text-orange-700 font-medium' 
            : field.required && !value 
              ? 'text-red-500' 
              : 'text-slate-700'
        }`}>
          {value || (field.required ? '必須項目' : '未入力')}
          {isNG && !value && <span className="ml-2 text-xs text-orange-600">(NG)</span>}
        </span>
      </div>
    );
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {getDisplayFileName()} - データ編集画面
          </DialogTitle>
        </DialogHeader>

                <div className="grid grid-cols-5 gap-6 h-[80vh]">
          {/* Left Panel (2/5) - File Info and OCR Data */}
          <div className="col-span-2 overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <InfoIcon className="w-5 h-5" />
                  <span>ファイル情報・OCRデータ</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
                 {/* File Information */}
                 <div className="bg-slate-50 p-4 rounded-lg">
                   <h4 className="font-medium text-slate-700 mb-3">元ファイル情報</h4>
                   <div className="space-y-2 text-sm">
                     <div className="flex justify-between">
                       <span className="text-slate-500">ファイル名:</span>
                       <span className="font-medium">{getDisplayFileName()}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-slate-500">処理ステータス:</span>
                       <span>{getStatusBadge()}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-slate-500">信頼度:</span>
                       <span className="font-medium">
                         {item.confidence_score ? `${item.confidence_score.toFixed(1)}%` : '不明'}
                       </span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-slate-500">処理日:</span>
                       <span className="font-medium">
                         {item.created_at ? new Date(item.created_at).toLocaleDateString('ja-JP') : '不明'}
                       </span>
                     </div>
                   </div>
                 </div>

                 {/* NG Filter Button */}
                 <div className="flex-shrink-0 mb-4">
                   <Button
                     variant={showNGOnly ? "default" : "outline"}
                     onClick={() => setShowNGOnly(!showNGOnly)}
                     className={`w-full ${showNGOnly ? "bg-orange-600 hover:bg-orange-700" : ""}`}
                   >
                     {showNGOnly ? "全項目表示" : "NGのみを抽出"}
                   </Button>
                   {showNGOnly && (
                     <p className="text-xs text-orange-600 mt-1 text-center">
                       {getNGFields().length}個のNG項目を表示中
                     </p>
                   )}
                 </div>

                 {/* Original File Preview */}
                 <div className="flex-shrink-0">
                   <h4 className="font-medium text-slate-700 mb-3">実際のオリジナルファイル</h4>
                   <FilePreviewInline 
                     fileId={item.uploadedFileId || null}
                     className="mb-4"
                   />
                 </div>

                 {/* OCR Extracted Text */}
                 <div className="flex-1 min-h-0">
                   <h4 className="font-medium text-slate-700 mb-3">OCRで取得したテキスト</h4>
                   <ScrollArea className="h-48 w-full border border-slate-200 rounded-lg">
                     <div className="p-4">
                       <pre className="text-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                         {(item as any).rawText || "テキストが抽出されていません"}
                       </pre>
                     </div>
                   </ScrollArea>
                 </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel (3/5) - Excel-like Editable Table */}
          <div className="col-span-3 space-y-4 overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <EditIcon className="w-5 h-5" />
                    <span>項目ごとの編集</span>
                  </div>
                  {hasChanges && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      未保存の変更あり
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32 sticky left-0 bg-white border-r">項目名</TableHead>
                        <TableHead className="min-w-80">値</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredFields().map((field) => {
                        const isNG = isFieldNG(field.key, formData[field.key]);
                        return (
                          <TableRow 
                            key={field.key} 
                            className={`hover:bg-slate-50 ${isNG ? 'bg-yellow-50 border-l-4 border-l-orange-400' : ''}`}
                          >
                            <TableCell className={`font-medium sticky left-0 border-r ${isNG ? 'bg-yellow-50' : 'bg-white'}`}>
                              <div className="flex items-center space-x-1">
                                <span className={isNG ? 'text-orange-700' : ''}>{field.label}</span>
                                {field.required && <span className="text-red-500">*</span>}
                                {isNG && <span className="text-orange-600 text-xs font-bold">NG</span>}
                              </div>
                            </TableCell>
                            <TableCell className="p-0">
                              {renderEditableCell(field, formData[field.key], isNG)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            <XIcon className="w-4 h-4 mr-2" />
            閉じる
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || updateMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <SaveIcon className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 