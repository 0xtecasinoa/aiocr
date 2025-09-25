import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeftIcon, SaveIcon, FileTextIcon, InfoIcon } from 'lucide-react';
import { ExtractedData, UpdateExtractedData } from '@/types';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

import FilePreviewInline from '@/components/file-preview-inline';

interface EditableField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea';
  required?: boolean;
}

interface DataEditScreenProps {
  item: ExtractedData;
  onBack: () => void;
  onSaveSuccess?: () => void;
  onProductSelect?: (product: ExtractedData) => void;
}

export default function DataEditScreen({ item, onBack, onSaveSuccess, onProductSelect }: DataEditScreenProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [relatedProducts, setRelatedProducts] = useState<ExtractedData[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ExtractedData | null>(null);
  const [isIndividualEditMode, setIsIndividualEditMode] = useState(false);

  // Fetch all extracted data to find related products
  const { data: allExtractedData } = useQuery({
    queryKey: ['allExtractedData'],
    queryFn: () => apiClient.getExtractedData(0, 1000),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateExtractedData) => {
      // Use selectedProduct ID if in individual edit mode, otherwise use original item ID
      const targetId = isIndividualEditMode && selectedProduct ? selectedProduct.id : item.id;
      return apiClient.updateExtractedData(targetId, data);
    },
    onSuccess: () => {
      const targetName = isIndividualEditMode && selectedProduct ? selectedProduct.productName : item.productName;
      toast({
        title: "保存完了",
        description: `${targetName || 'データ'}が正常に更新されました。`,
      });
      queryClient.invalidateQueries({ queryKey: ['extractedData'] });
      queryClient.invalidateQueries({ queryKey: ['allExtractedData'] });
      onSaveSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "保存エラー",
        description: "データの更新に失敗しました。",
        variant: "destructive",
      });
    }
  });

  // Initialize form data and find related products
  useEffect(() => {
    if (item && allExtractedData?.data) {
      // Initialize form data
      setFormData({
        productName: item.productName || '',
        sku: (item as any).sku || '',
        jan_code: (item as any).jan_code || '',
        price: item.price || '',
        stock: item.stock || '',
        category: item.category || '',
        brand: (item as any).brand || '',
        manufacturer: (item as any).manufacturer || '',
        description: item.description || '',
        weight: (item as any).weight || '',
        color: (item as any).color || '',
        material: (item as any).material || '',
        origin: (item as any).origin || '',
        warranty: (item as any).warranty || '',
        dimensions: (item as any).dimensions || '',
      });

      // Find related products from the same source file
      const sourceFileId = (item as any).sourceFileId || (item as any).uploadedFileId || item.id;
      const relatedItems = allExtractedData.data.filter((dataItem: ExtractedData) => {
        const itemSourceFileId = (dataItem as any).sourceFileId || (dataItem as any).uploadedFileId || dataItem.id;
        return itemSourceFileId === sourceFileId;
      });

      // If no related items found, include the current item itself
      if (relatedItems.length === 0) {
        setRelatedProducts([item]);
      } else {
        setRelatedProducts(relatedItems);
      }
    }
  }, [item, allExtractedData]);

  const editableFields: EditableField[] = [
    { key: 'productName', label: '商品名', type: 'text', required: true },
    { key: 'sku', label: '品番', type: 'text' },
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
    { key: 'warranty', label: '保証', type: 'text' },
    { key: 'dimensions', label: 'サイズ', type: 'text' },
  ];

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    // Convert and validate data before sending
    const processedData = { ...formData };
    
    // Convert price to number or null
    if (processedData.price === '' || processedData.price === null || processedData.price === undefined) {
      processedData.price = null;
    } else if (typeof processedData.price === 'string') {
      const priceNum = parseFloat(processedData.price);
      processedData.price = isNaN(priceNum) ? null : priceNum;
    }
    
    // Convert stock to integer or null
    if (processedData.stock === '' || processedData.stock === null || processedData.stock === undefined) {
      processedData.stock = null;
    } else if (typeof processedData.stock === 'string') {
      const stockNum = parseInt(processedData.stock, 10);
      processedData.stock = isNaN(stockNum) ? null : stockNum;
    }
    
    // Map camelCase to snake_case for backend compatibility
    const backendData = {
      product_name: processedData.productName,
      productName: processedData.productName, // Keep both for compatibility
      sku: processedData.sku,
      jan_code: processedData.janCode,
      janCode: processedData.janCode, // Keep both for compatibility
      price: processedData.price,
      stock: processedData.stock,
      category: processedData.category,
      brand: processedData.brand,
      manufacturer: processedData.manufacturer,
      description: processedData.description,
      weight: processedData.weight,
      color: processedData.color,
      material: processedData.material,
      origin: processedData.origin,
      warranty: processedData.warranty
    };
    
    updateMutation.mutate(backendData);
  };

  const handleProductClick = (product: ExtractedData) => {
    setSelectedProduct(product);
    setIsIndividualEditMode(true);
    
    // Update form data with selected product
    const newFormData: Record<string, any> = {};
    editableFields.forEach(field => {
      if (field.key === 'productName') {
        newFormData[field.key] = product.productName || '';
      } else if (field.key === 'price') {
        newFormData[field.key] = product.price || '';
      } else if (field.key === 'stock') {
        newFormData[field.key] = product.stock || '';
      } else if (field.key === 'category') {
        newFormData[field.key] = product.category || '';
      } else if (field.key === 'brand') {
        newFormData[field.key] = product.brand || '';
      } else if (field.key === 'manufacturer') {
        newFormData[field.key] = product.manufacturer || '';
      } else if (field.key === 'description') {
        newFormData[field.key] = product.description || '';
      } else if (field.key === 'weight') {
        newFormData[field.key] = product.weight || '';
      } else if (field.key === 'color') {
        newFormData[field.key] = product.color || '';
      } else if (field.key === 'material') {
        newFormData[field.key] = product.material || '';
      } else if (field.key === 'origin') {
        newFormData[field.key] = product.origin || '';
      } else if (field.key === 'warranty') {
        newFormData[field.key] = product.warranty || '';
      } else {
        // Handle additional fields from structured_data
        const structuredData = (product as any).structured_data || {};
        if (field.key === 'sku') {
          newFormData[field.key] = (product as any).sku || structuredData.sku || '';
        } else if (field.key === 'janCode') {
          newFormData[field.key] = (product as any).jan_code || structuredData.jan_code || '';
        } else if (field.key === 'releaseDate') {
          newFormData[field.key] = (product as any).release_date || structuredData.release_date || '';
        }
      }
    });
    setFormData(newFormData);
  };

  const handleBackToList = () => {
    setIsIndividualEditMode(false);
    setSelectedProduct(null);
  };

  const getStatusBadge = (currentItem: ExtractedData) => {
    if (currentItem.is_validated) {
      return <Badge variant="default" className="bg-green-100 text-green-800">修正済み</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">未確認</Badge>;
  };

  const getDisplayFileName = (currentItem: ExtractedData) => {
    return currentItem.productName || `File_${(currentItem as any).uploadedFileId?.slice(-8) || 'Unknown'}`;
  };

  return (
    <div className="relative flex h-screen">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                一覧画面へ
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">データ編集画面</h1>
                <p className="text-sm text-gray-600">
                  ファイル_{(item as any).uploadedFileId?.slice(-8) || 'Unknown'} - データ編集画面
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge(item)}
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                <SaveIcon className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left side - File information and original file */}
            <div className="space-y-6">
              {/* File Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <InfoIcon className="w-5 h-5" />
                    <span>ファイル情報・OCRデータ</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">ファイル名:</label>
                      <p className="text-sm text-gray-900">ファイル_{(item as any).uploadedFileId?.slice(-8) || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">処理ステータス:</label>
                      <div className="mt-1">
                        <Badge className="bg-blue-100 text-blue-800">未確認</Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">信頼度:</label>
                      <p className="text-sm text-gray-900">{item.confidence_score || 95.0}%</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">処理日:</label>
                      <p className="text-sm text-gray-900">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('ja-JP') : '2025/9/22'}
                      </p>
                    </div>
                  </div>

                  {relatedProducts.length > 1 && (
                    <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-800 font-medium">NGのみ抽出</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Original File */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileTextIcon className="w-5 h-5" />
                    <span>実際のオリジナルファイル</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FilePreviewInline 
                    fileId={(item as any).uploadedFileId}
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-600">実際資_ポケットモンスター_ポケモン...</span>
                    <Button variant="outline" size="sm">
                      ダウンロード
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right side - Conditional display based on mode */}
            <div className="space-y-6">
              {/* Multi-Product Table (一覧画面イメージ) - Show when not in individual edit mode and there are multiple products */}
              {!isIndividualEditMode && relatedProducts.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>一覧ごとの編集</CardTitle>
                    <p className="text-sm text-gray-600">
                      項目をクリックしたら個別編集画面に遷移させてください
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[200px]">商品名</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[100px]">発売予定日</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[120px]">JANコード</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[100px]">希望小売価格</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[60px]">入数</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[100px]">商品サイズ</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[120px]">パッケージサイズ</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[100px]">内箱サイズ</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[120px]">カートンサイズ品番</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[100px]">パッケージ形態</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[100px]">商品説明文</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedProducts
                            .sort((a, b) => ((a as any).productIndex || 1) - ((b as any).productIndex || 1))
                            .map((product, index) => (
                            <tr 
                              key={product.id}
                              className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleProductClick(product)}
                            >
                              <td className="py-2 px-2 text-sm">
                                <div className="font-medium text-gray-900">
                                  {product.productName || '未入力'}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                {(product as any).release_date || '12/1/2024'}
                              </td>
                              <td className="py-2 px-2 text-sm font-mono text-gray-700">
                                <div className={`px-2 py-1 rounded text-xs ${(product as any).jan_code ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                                  {(product as any).jan_code || '未入力'}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                {product.price ? `${Number(product.price).toLocaleString()}円(税抜価格${Math.floor(Number(product.price) * 0.91)}円)` : '未入力'}
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                {product.stock || '72入\n(12パック×6BOX)'}
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                {(product as any).dimensions || '(16.7×約)63×89mm'}
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                <div className={`px-2 py-1 rounded text-xs ${(product as any).package_size ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                                  {(product as any).package_size || '約141×73×約159×385×ない'}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                {(product as any).inner_box_size || '約141×73×約159×385×ない'}
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                <div className={`px-2 py-1 rounded text-xs ${(product as any).carton_size ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                                  {(product as any).carton_size || '約141×73×約159×385×ない'}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                {(product as any).package_type || 'ピローパック(ブラインド)'}
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-700">
                                <div className="max-w-[100px] truncate">
                                  {product.description || '未入力'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                              )}

              {/* Single Product Display (単一商品表示) - Show when not in individual edit mode and there's only one product */}
              {!isIndividualEditMode && relatedProducts.length <= 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>個別商品リスト</CardTitle>
                    <p className="text-sm text-gray-600">
                      この商品をクリックして個別編集を開始できます
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {relatedProducts.map((product) => (
                        <div
                          key={product.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleProductClick(product)}
                        >
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-gray-700 mb-1">商品名</div>
                              <div className="text-sm text-gray-900 font-semibold">
                                {product.productName || '未入力'}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700 mb-1">JANコード</div>
                              <div className={`text-sm px-2 py-1 rounded ${(product as any).jan_code ? 'bg-yellow-100 text-gray-900' : 'bg-gray-100 text-gray-500'}`}>
                                {(product as any).jan_code || '未入力'}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700 mb-1">価格</div>
                              <div className="text-sm text-gray-900">
                                {product.price ? `¥${Number(product.price).toLocaleString()}` : '未入力'}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700 mb-1">カテゴリ</div>
                              <div className="text-sm text-gray-900">
                                {product.category || '未入力'}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700 mb-1">ブランド</div>
                              <div className="text-sm text-gray-900">
                                {product.brand || '未入力'}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700 mb-1">製造元</div>
                              <div className="text-sm text-gray-900">
                                {product.manufacturer || '未入力'}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-sm font-medium text-gray-700 mb-1">商品説明</div>
                              <div className="text-sm text-gray-900 line-clamp-2">
                                {product.description || '未入力'}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-gray-500">
                                発売予定日: {(product as any).release_date || '未定'}
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                  個別商品
                                </span>
                                <span className="text-xs text-gray-500">
                                  クリックして編集
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Individual Edit Form (個別編集画面イメージ) - Show when in individual edit mode */}
              {isIndividualEditMode && selectedProduct && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>項目ごとの編集</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedProduct.productName || '商品名未設定'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBackToList}
                    >
                      一覧に戻る
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                                             <div className="grid grid-cols-1 gap-6">
                         {/* 商品名 */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            商品名 <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={formData.productName || ''}
                            onChange={(e) => handleInputChange('productName', e.target.value)}
                            className="w-full"
                            placeholder="ソフビタイムシリーズ ポケモンコインバンク"
                          />
                        </div>

                        {/* SKU */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">SKU</label>
                          <Input
                            value={formData.sku || ''}
                            onChange={(e) => handleInputChange('sku', e.target.value)}
                            className="w-full"
                            placeholder="ST-03CB, ST-04CB, ST-05CB"
                          />
                        </div>

                        {/* JANコード */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            JANコード <span className="text-orange-500">NG</span>
                          </label>
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <Input
                              value={formData.janCode || ''}
                              onChange={(e) => handleInputChange('janCode', e.target.value)}
                              className="w-full bg-white"
                              placeholder="4970381 804220, 4970381 804237, 4970381 804244"
                            />
                          </div>
                        </div>

                        {/* 価格 */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">価格</label>
                          <Input
                            type="number"
                            value={formData.price || ''}
                            onChange={(e) => handleInputChange('price', e.target.value)}
                            className="w-full"
                            placeholder="2640"
                          />
                        </div>

                        {/* 在庫数 */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">在庫数</label>
                          <Input
                            type="number"
                            value={formData.stock || ''}
                            onChange={(e) => handleInputChange('stock', e.target.value)}
                            className="w-full"
                            placeholder="11"
                          />
                        </div>

                        {/* カテゴリ */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">カテゴリ</label>
                          <Input
                            value={formData.category || ''}
                            onChange={(e) => handleInputChange('category', e.target.value)}
                            className="w-full"
                            placeholder="貯金箱"
                          />
                        </div>

                        {/* ブランド */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">ブランド</label>
                          <Input
                            value={formData.brand || ''}
                            onChange={(e) => handleInputChange('brand', e.target.value)}
                            className="w-full"
                            placeholder="エンスカイ"
                          />
                        </div>

                        {/* 製造元 */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            製造元 <span className="text-orange-500">NG</span>
                          </label>
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <Input
                              value={formData.manufacturer || ''}
                              onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                              className="w-full bg-white"
                              placeholder="未入力 (NG)"
                            />
                          </div>
                        </div>

                        {/* 商品説明 */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">商品説明</label>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={4}
                            value={formData.description || ''}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder="ポケットモンスターのキャラクターをデフォルメした可愛い貯金箱。ピカチュウ、パチリス、ハリマロンなど..."
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
} 