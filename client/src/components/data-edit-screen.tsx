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

  // Fetch all extracted data to find related products
  const { data: allExtractedData } = useQuery({
    queryKey: ['allExtractedData'],
    queryFn: () => apiClient.getExtractedData(0, 1000),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateExtractedData) => apiClient.updateExtractedData(item.id, data),
    onSuccess: () => {
      toast({
        title: "保存完了",
        description: "データが正常に更新されました。",
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

      setRelatedProducts(relatedItems);
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
    updateMutation.mutate(formData);
  };

  const handleProductClick = (product: ExtractedData) => {
    if (onProductSelect) {
      onProductSelect(product);
    }
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

            {/* Right side - Editable form and multi-product table */}
            <div className="space-y-6">
              {/* Product Data Editing Form */}
              <Card>
                <CardHeader>
                  <CardTitle>商品データ編集</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {editableFields.map((field) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={3}
                              value={formData[field.key] || ''}
                              onChange={(e) => handleInputChange(field.key, e.target.value)}
                            />
                          ) : (
                            <Input
                              type={field.type}
                              value={formData[field.key] || ''}
                              onChange={(e) => handleInputChange(field.key, e.target.value)}
                              className="w-full"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Multi-Product Table */}
              {relatedProducts.length > 1 && (
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
            </div>
          </div>
        </div>
      </div>

    </div>
  );
} 