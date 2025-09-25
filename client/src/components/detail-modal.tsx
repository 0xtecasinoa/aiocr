import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EditIcon, SaveIcon, XIcon, FolderIcon, FileTextIcon, InfoIcon } from "lucide-react";
import { ExtractedData, UpdateExtractedData } from "../types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExtractedData | null;
}

export default function DetailModal({ isOpen, onClose, item }: DetailModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<UpdateExtractedData>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // バリデーションルール
  const validateField = (fieldName: string, value: any): string | null => {
    switch (fieldName) {
      case 'product_name':
        if (!value || value.trim() === '') return '商品名は必須です';
        if (value.length > 100) return '商品名は100文字以内で入力してください';
        return null;
      
      case 'price':
        if (value !== undefined && value !== null && value !== '') {
          if (isNaN(value) || value < 0) return '価格は0以上の数値で入力してください';
          if (value > 10000000) return '価格は1000万円以下で入力してください';
        }
        return null;
      
      case 'stock':
        if (value !== undefined && value !== null && value !== '') {
          if (isNaN(value) || value < 0) return '在庫数は0以上の数値で入力してください';
          if (!Number.isInteger(Number(value))) return '在庫数は整数で入力してください';
        }
        return null;
      
      case 'jan_code':
        if (value && value.length > 0) {
          if (!/^[0-9]{8}$|^[0-9]{13}$/.test(value)) return 'JANコードは8桁または13桁の数字で入力してください';
        }
        return null;
      
      case 'sku':
        if (value && value.length > 50) return 'SKUは50文字以内で入力してください';
        return null;
      
      default:
        return null;
    }
  };

  // フォームデータ変更ハンドラー（バリデーション付き）
  const handleFormChange = (field: keyof UpdateExtractedData, value: any) => {
    // バリデーション実行
    const error = validateField(field, value);
    setValidationErrors(prev => ({
      ...prev,
      [field]: error || ''
    }));

    // フォームデータ更新
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    setHasChanges(true);
  };

  // 全体バリデーション
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key as keyof UpdateExtractedData]);
      if (error) errors[key] = error;
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // データ更新のミューテーション
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateExtractedData) => {
      if (!item) throw new Error("No item selected");
      return await apiClient.updateExtractedData(item.id, data);
    },
    onSuccess: () => {
      toast({
        title: "保存完了",
        description: "データが正常に更新されました。",
      });
      queryClient.invalidateQueries({ queryKey: ["extractedData"] });
      setIsEditMode(false);
      setHasChanges(false);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "保存エラー",
        description: "データの保存に失敗しました。もう一度お試しください。",
        variant: "destructive",
      });
      console.error("Update error:", error);
    },
  });

  // アイテムが変更された時にフォームデータを初期化
  useEffect(() => {
    if (item) {
      setFormData({
        product_name: item.productName || "",
        sku: item.sku || "",
        price: item.price || undefined,
        stock: item.stock || undefined,
        category: item.category || "",
        brand: (item as any).brand || "",
        manufacturer: (item as any).manufacturer || "",
        description: item.description || "",
        jan_code: (item as any).jan_code || "",
        weight: (item as any).weight || "",
        color: (item as any).color || "",
        material: (item as any).material || "",
        origin: (item as any).origin || "",
        warranty: (item as any).warranty || "",
        is_validated: item.is_validated || false,
      });
      setIsEditMode(false);
      setHasChanges(false);
      setValidationErrors({}); // バリデーションエラーもクリア
    }
  }, [item]);

  // 編集モードの切り替え
  const toggleEditMode = () => {
    if (isEditMode && hasChanges) {
      // 変更がある場合は確認
      if (confirm("変更内容が失われますが、編集を終了しますか？")) {
        setIsEditMode(false);
        setHasChanges(false);
        // フォームデータをリセット
        if (item) {
          setFormData({
            product_name: item.productName || "",
            sku: item.sku || "",
            price: item.price || undefined,
            stock: item.stock || undefined,
            category: item.category || "",
            brand: (item as any).brand || "",
            manufacturer: (item as any).manufacturer || "",
            description: item.description || "",
            jan_code: (item as any).jan_code || "",
            weight: (item as any).weight || "",
            color: (item as any).color || "",
            material: (item as any).material || "",
            origin: (item as any).origin || "",
            warranty: (item as any).warranty || "",
            is_validated: item.is_validated || false,
          });
        }
      }
    } else {
      setIsEditMode(!isEditMode);
    }
  };

  // 保存処理
  const handleSave = () => {
    if (!item) return;
    
    // バリデーションチェック
    if (!validateForm()) {
      toast({
        title: "入力エラー",
        description: "入力内容に問題があります。エラーメッセージを確認してください。",
        variant: "destructive",
      });
      return;
    }
    
    // デバッグログ
    console.log("Saving data:", formData);
    console.log("Item ID:", item.id);
    
    updateMutation.mutate(formData);
  };

  // キャンセル処理
  const handleCancel = () => {
    if (hasChanges) {
      if (confirm("変更内容が失われますが、キャンセルしますか？")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const getStatusBadge = () => {
    if (item!.is_validated) {
      return <Badge variant="default" className="bg-green-100 text-green-800">修正済み</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">未確認</Badge>;
  };

  const getDisplayFileName = () => {
    const productIndex = (item! as any).structured_data?.product_index;
    const productName = item!.productName;
    const baseFileName = `File_${(item! as any).uploadedFileId?.slice(-8) || 'Unknown'}`;
    
    if (productIndex && productName) {
      return `商品${productIndex}: ${productName}`;
    } else if (productIndex) {
      return `商品${productIndex} - ${baseFileName}`;
    } else if (productName) {
      return productName;
    }
    return baseFileName;
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {getDisplayFileName()} - データ詳細・編集
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 h-[70vh]">
          {/* 左側: OCR結果プレビュー（非編集表示） */}
          <div className="space-y-4 overflow-y-auto">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <InfoIcon className="w-5 h-5" />
                  <span>OCR結果プレビュー</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 元ファイル情報 */}
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

                {/* OCRで取得したテキスト */}
                <div>
                  <h4 className="font-medium text-slate-700 mb-3">OCRで取得したテキスト</h4>
                  <div className="bg-white border border-slate-200 p-4 rounded-lg h-96 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                      {(item as any).rawText || "テキストが抽出されていません"}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右側: 編集可能なフォーム */}
          <div className="space-y-4 overflow-y-auto">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <EditIcon className="w-5 h-5" />
                    <span>データ編集フォーム</span>
                  </div>
                  {isEditMode && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">編集モード</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 基本情報 */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pb-3 border-b-2 border-blue-100">
                    <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                    <h4 className="font-semibold text-slate-800 text-lg">基本情報</h4>
                  </div>
                  
                  {/* 商品名 - フルワイド */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <Label htmlFor="product_name" className="text-sm font-medium text-slate-700 flex items-center space-x-1">
                      <span>商品名</span>
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="product_name"
                      value={formData.product_name || ""}
                      onChange={(e) => handleFormChange("product_name", e.target.value)}
                      disabled={!isEditMode}
                      className={`mt-2 ${isEditMode 
                        ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                        : "bg-slate-50 border-slate-200"
                      } ${validationErrors.product_name ? "border-red-300 focus:border-red-500" : ""}`}
                      placeholder="商品名を入力してください"
                    />
                    {validationErrors.product_name && (
                      <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                        <span>⚠️</span>
                        <span>{validationErrors.product_name}</span>
                      </p>
                    )}
                  </div>

                  {/* SKU & JANコード */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="sku" className="text-sm font-medium text-slate-700">SKU</Label>
                      <Input
                        id="sku"
                        value={formData.sku || ""}
                        onChange={(e) => handleFormChange("sku", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.sku ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: SKU-001"
                      />
                      {validationErrors.sku && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.sku}</span>
                        </p>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="jan_code" className="text-sm font-medium text-slate-700">JANコード</Label>
                      <Input
                        id="jan_code"
                        value={formData.jan_code || ""}
                        onChange={(e) => handleFormChange("jan_code", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.jan_code ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: 4901234567890"
                      />
                      {validationErrors.jan_code && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.jan_code}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 価格 & 在庫数 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="price" className="text-sm font-medium text-slate-700 flex items-center space-x-1">
                        <span>価格</span>
                        <span className="text-xs text-slate-500">(円)</span>
                      </Label>
                      <div className="relative mt-2">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">¥</span>
                        <Input
                          id="price"
                          type="number"
                          value={formData.price || ""}
                          onChange={(e) => handleFormChange("price", e.target.value ? parseFloat(e.target.value) : undefined)}
                          disabled={!isEditMode}
                          className={`pl-8 ${isEditMode 
                            ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                            : "bg-slate-50 border-slate-200"
                          } ${validationErrors.price ? "border-red-300 focus:border-red-500" : ""}`}
                          placeholder="1000"
                          min="0"
                          step="1"
                        />
                      </div>
                      {validationErrors.price && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.price}</span>
                        </p>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="stock" className="text-sm font-medium text-slate-700 flex items-center space-x-1">
                        <span>在庫数</span>
                        <span className="text-xs text-slate-500">(個)</span>
                      </Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock || ""}
                        onChange={(e) => handleFormChange("stock", e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.stock ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="100"
                        min="0"
                        step="1"
                      />
                      {validationErrors.stock && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.stock}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* カテゴリ */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <Label htmlFor="category" className="text-sm font-medium text-slate-700">カテゴリ</Label>
                    <Select
                      value={formData.category || ""}
                      onValueChange={(value) => handleFormChange("category", value)}
                      disabled={!isEditMode}
                    >
                      <SelectTrigger className={`mt-2 ${isEditMode 
                        ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                        : "bg-slate-50 border-slate-200"
                      }`}>
                        <SelectValue placeholder="カテゴリを選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="電子機器">電子機器</SelectItem>
                        <SelectItem value="アクセサリ">アクセサリ</SelectItem>
                        <SelectItem value="家電">家電</SelectItem>
                        <SelectItem value="衣類">衣類</SelectItem>
                        <SelectItem value="食品">食品</SelectItem>
                        <SelectItem value="書籍">書籍</SelectItem>
                        <SelectItem value="玩具">玩具</SelectItem>
                        <SelectItem value="スポーツ">スポーツ</SelectItem>
                        <SelectItem value="美容">美容</SelectItem>
                        <SelectItem value="文具">文具</SelectItem>
                        <SelectItem value="その他">その他</SelectItem>
                      </SelectContent>
                    </Select>
                    {validationErrors.category && (
                      <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                        <span>⚠️</span>
                        <span>{validationErrors.category}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="h-4"></div>

                {/* 詳細情報 */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 pb-3 border-b-2 border-green-100">
                    <div className="w-2 h-6 bg-green-500 rounded-full"></div>
                    <h4 className="font-semibold text-slate-800 text-lg">詳細情報</h4>
                  </div>
                  
                  {/* ブランド & 製造元 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="brand" className="text-sm font-medium text-slate-700">ブランド</Label>
                      <Input
                        id="brand"
                        value={formData.brand || ""}
                        onChange={(e) => handleFormChange("brand", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.brand ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: Apple"
                      />
                      {validationErrors.brand && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.brand}</span>
                        </p>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="manufacturer" className="text-sm font-medium text-slate-700">製造元</Label>
                      <Input
                        id="manufacturer"
                        value={formData.manufacturer || ""}
                        onChange={(e) => handleFormChange("manufacturer", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.manufacturer ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: Apple Inc."
                      />
                      {validationErrors.manufacturer && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.manufacturer}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 重量・色・素材 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="weight" className="text-sm font-medium text-slate-700">重量</Label>
                      <Input
                        id="weight"
                        value={formData.weight || ""}
                        onChange={(e) => handleFormChange("weight", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.weight ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: 200g"
                      />
                      {validationErrors.weight && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.weight}</span>
                        </p>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="color" className="text-sm font-medium text-slate-700">色</Label>
                      <Input
                        id="color"
                        value={formData.color || ""}
                        onChange={(e) => handleFormChange("color", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.color ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: ブラック"
                      />
                      {validationErrors.color && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.color}</span>
                        </p>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="material" className="text-sm font-medium text-slate-700">素材</Label>
                      <Input
                        id="material"
                        value={formData.material || ""}
                        onChange={(e) => handleFormChange("material", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.material ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: アルミニウム"
                      />
                      {validationErrors.material && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.material}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 原産地 & 保証期間 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="origin" className="text-sm font-medium text-slate-700">原産地</Label>
                      <Input
                        id="origin"
                        value={formData.origin || ""}
                        onChange={(e) => handleFormChange("origin", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.origin ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: 日本"
                      />
                      {validationErrors.origin && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.origin}</span>
                        </p>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <Label htmlFor="warranty" className="text-sm font-medium text-slate-700">保証期間</Label>
                      <Input
                        id="warranty"
                        value={formData.warranty || ""}
                        onChange={(e) => handleFormChange("warranty", e.target.value)}
                        disabled={!isEditMode}
                        className={`mt-2 ${isEditMode 
                          ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                          : "bg-slate-50 border-slate-200"
                        } ${validationErrors.warranty ? "border-red-300 focus:border-red-500" : ""}`}
                        placeholder="例: 1年間"
                      />
                      {validationErrors.warranty && (
                        <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                          <span>⚠️</span>
                          <span>{validationErrors.warranty}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 商品説明 */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <Label htmlFor="description" className="text-sm font-medium text-slate-700">商品説明</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ""}
                      onChange={(e) => handleFormChange("description", e.target.value)}
                      disabled={!isEditMode}
                      className={`mt-2 ${isEditMode 
                        ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500" 
                        : "bg-slate-50 border-slate-200"
                      } ${validationErrors.description ? "border-red-300 focus:border-red-500" : ""}`}
                      placeholder="商品の詳細説明を入力してください"
                      rows={3}
                    />
                    {validationErrors.description && (
                      <p className="text-sm text-red-500 mt-2 flex items-center space-x-1">
                        <span>⚠️</span>
                        <span>{validationErrors.description}</span>
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 保存・キャンセルボタン配置 */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex items-center space-x-2">
            {!isEditMode ? (
              <Button onClick={toggleEditMode} className="bg-blue-600 hover:bg-blue-700">
                <EditIcon className="w-4 h-4 mr-2" />
                編集
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSave} 
                  disabled={updateMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <SaveIcon className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? "保存中..." : "保存"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={toggleEditMode}
                  disabled={updateMutation.isPending}
                >
                  編集終了
                </Button>
              </div>
            )}
          </div>
          
          <Button variant="outline" onClick={handleCancel}>
            <XIcon className="w-4 h-4 mr-2" />
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
