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
      // Initialize form data with all 38 fields
      setFormData({
        lotNumber: (item as any).lotNumber || '',
        classification: (item as any).classification || '',
        majorCategory: (item as any).majorCategory || (item as any).category || '',
        minorCategory: (item as any).minorCategory || '',
        releaseDate: (item as any).releaseDate || '',
        janCode: (item as any).janCode || '',
        productCode: (item as any).productCode || (item as any).sku || '',
        inStore: (item as any).inStore || '',
        genreName: (item as any).genreName || '',
        supplierName: (item as any).supplierName || '',
        ipName: (item as any).ipName || (item as any).brand || '',
        characterName: (item as any).characterName || '',
        productName: item.productName || '',
        referenceSalesPrice: (item as any).referenceSalesPrice || '',
        wholesalePrice: (item as any).wholesalePrice || item.price || '',
        wholesaleQuantity: (item as any).wholesaleQuantity || '',
        stock: item.stock || '',
        orderAmount: (item as any).orderAmount || '',
        quantityPerPack: (item as any).quantityPerPack || '',
        reservationReleaseDate: (item as any).reservationReleaseDate || '',
        reservationDeadline: (item as any).reservationDeadline || '',
        reservationShippingDate: (item as any).reservationShippingDate || '',
        casePackQuantity: (item as any).casePackQuantity || '',
        singleProductSize: (item as any).singleProductSize || (item as any).product_size || (item as any).dimensions || '',
        innerBoxSize: (item as any).innerBoxSize || (item as any).package_size || '',
        cartonSize: (item as any).cartonSize || '',
        innerBoxGtin: (item as any).innerBoxGtin || '',
        outerBoxGtin: (item as any).outerBoxGtin || '',
        description: item.description || '',
        protectiveFilmMaterial: (item as any).protectiveFilmMaterial || (item as any).packaging_material || (item as any).package_type || '',
        countryOfOrigin: (item as any).countryOfOrigin || (item as any).origin || '',
        targetAge: (item as any).targetAge || '',
        image1: (item as any).image1 || '',
        image2: (item as any).image2 || '',
        image3: (item as any).image3 || '',
        image4: (item as any).image4 || '',
        image5: (item as any).image5 || '',
        image6: (item as any).image6 || '',
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
    { key: 'lotNumber', label: 'ロット番号', type: 'text' },
    { key: 'classification', label: '区分', type: 'text' },
    { key: 'majorCategory', label: '大分類', type: 'text' },
    { key: 'minorCategory', label: '中分類', type: 'text' },
    { key: 'releaseDate', label: '発売日', type: 'text' },
    { key: 'janCode', label: 'JANコード', type: 'text' },
    { key: 'productCode', label: '商品番号', type: 'text' },
    { key: 'inStore', label: 'インストア', type: 'text' },
    { key: 'genreName', label: 'ジャンル名称', type: 'text' },
    { key: 'supplierName', label: '仕入先', type: 'text' },
    { key: 'ipName', label: 'メーカー名称', type: 'text' },
    { key: 'characterName', label: 'キャラクター名(IP名)', type: 'text' },
    { key: 'productName', label: '商品名称', type: 'text', required: true },
    { key: 'referenceSalesPrice', label: '参考販売価格', type: 'number' },
    { key: 'wholesalePrice', label: '卸単価（抜）', type: 'number' },
    { key: 'wholesaleQuantity', label: '卸可能数', type: 'number' },
    { key: 'stock', label: '発注数', type: 'number' },
    { key: 'orderAmount', label: '発注金額', type: 'number' },
    { key: 'quantityPerPack', label: '入数', type: 'text' },
    { key: 'reservationReleaseDate', label: '予約解禁日', type: 'text' },
    { key: 'reservationDeadline', label: '予約締め切り日', type: 'text' },
    { key: 'reservationShippingDate', label: '予約商品発送予定日', type: 'text' },
    { key: 'casePackQuantity', label: 'ケース梱入数', type: 'number' },
    { key: 'singleProductSize', label: '単品サイズ', type: 'text' },
    { key: 'innerBoxSize', label: '内箱サイズ', type: 'text' },
    { key: 'cartonSize', label: 'カートンサイズ', type: 'text' },
    { key: 'innerBoxGtin', label: '内箱GTIN', type: 'text' },
    { key: 'outerBoxGtin', label: '外箱GTIN', type: 'text' },
    { key: 'description', label: '商品説明', type: 'textarea' },
    { key: 'protectiveFilmMaterial', label: '機材フィルム', type: 'text' },
    { key: 'countryOfOrigin', label: '原産国', type: 'text' },
    { key: 'targetAge', label: '対象年齢', type: 'text' },
    { key: 'image1', label: '画像1', type: 'text' },
    { key: 'image2', label: '画像2', type: 'text' },
    { key: 'image3', label: '画像3', type: 'text' },
    { key: 'image4', label: '画像4', type: 'text' },
    { key: 'image5', label: '画像5', type: 'text' },
    { key: 'image6', label: '画像6', type: 'text' },
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
    
    // Convert number fields (camelCase)
    const numberFields = ['referenceSalesPrice', 'wholesalePrice', 'wholesaleQuantity', 'stock', 'orderAmount', 'casePackQuantity'];
    numberFields.forEach(field => {
      if (processedData[field] === '' || processedData[field] === null || processedData[field] === undefined) {
        processedData[field] = null;
      } else if (typeof processedData[field] === 'string') {
        const num = field === 'stock' || field === 'wholesaleQuantity' || field === 'casePackQuantity' 
          ? parseInt(processedData[field], 10) 
          : parseFloat(processedData[field]);
        processedData[field] = isNaN(num) ? null : num;
      }
    });
    
    // Send all fields to backend (already in camelCase)
    updateMutation.mutate(processedData);
  };

  const handleProductClick = (product: ExtractedData) => {
    setSelectedProduct(product);
    setIsIndividualEditMode(true);
    
    // Update form data with all 38 fields from selected product with fallbacks
    const productData = product as any;
    const newFormData: Record<string, any> = {
      lotNumber: productData.lotNumber || '',
      classification: productData.classification || '',
      majorCategory: productData.majorCategory || productData.category || '',
      minorCategory: productData.minorCategory || '',
      releaseDate: productData.releaseDate || '',
      janCode: productData.janCode || '',
      productCode: productData.productCode || productData.sku || '',
      inStore: productData.inStore || '',
      genreName: productData.genreName || '',
      supplierName: productData.supplierName || '',
      ipName: productData.ipName || productData.brand || '',
      characterName: productData.characterName || '',
      productName: productData.productName || '',
      referenceSalesPrice: productData.referenceSalesPrice || '',
      wholesalePrice: productData.wholesalePrice || productData.price || '',
      wholesaleQuantity: productData.wholesaleQuantity || '',
      stock: productData.stock || '',
      orderAmount: productData.orderAmount || '',
      quantityPerPack: productData.quantityPerPack || '',
      reservationReleaseDate: productData.reservationReleaseDate || '',
      reservationDeadline: productData.reservationDeadline || '',
      reservationShippingDate: productData.reservationShippingDate || '',
      casePackQuantity: productData.casePackQuantity || '',
      singleProductSize: productData.singleProductSize || productData.product_size || productData.dimensions || '',
      innerBoxSize: productData.innerBoxSize || productData.package_size || '',
      cartonSize: productData.cartonSize || '',
      innerBoxGtin: productData.innerBoxGtin || '',
      outerBoxGtin: productData.outerBoxGtin || '',
      description: productData.description || '',
      protectiveFilmMaterial: productData.protectiveFilmMaterial || productData.packaging_material || productData.package_type || '',
      countryOfOrigin: productData.countryOfOrigin || productData.origin || '',
      targetAge: productData.targetAge || '',
      image1: productData.image1 || '',
      image2: productData.image2 || '',
      image3: productData.image3 || '',
      image4: productData.image4 || '',
      image5: productData.image5 || '',
      image6: productData.image6 || '',
    };
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
                            {editableFields.map((field) => (
                              <th key={field.key} className="text-left py-2 px-2 text-sm font-medium text-gray-700 min-w-[100px]">
                                {field.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {relatedProducts
                            .sort((a, b) => ((a as any).productIndex || 1) - ((b as any).productIndex || 1))
                            .map((product) => (
                            <tr 
                              key={product.id}
                              className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleProductClick(product)}
                            >
                              {editableFields.map((field) => (
                                <td key={field.key} className="py-2 px-2 text-sm text-gray-700">
                                  <div className="max-w-[200px] truncate">
                                    {field.key === 'productName' && (
                                      <span className="font-medium text-gray-900">
                                        {(product as any)[field.key] || '未入力'}
                                      </span>
                                    )}
                                    {field.key !== 'productName' && (
                                      (product as any)[field.key] || ''
                                    )}
                                  </div>
                                </td>
                              ))}
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
                        {editableFields.map((field) => (
                          <div key={field.key} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                rows={4}
                                value={formData[field.key] || ''}
                                onChange={(e) => handleInputChange(field.key, e.target.value)}
                                placeholder=""
                              />
                            ) : (
                              <Input
                                type={field.type}
                                value={formData[field.key] || ''}
                                onChange={(e) => handleInputChange(field.key, e.target.value)}
                                className="w-full"
                                placeholder=""
                              />
                            )}
                          </div>
                        ))}
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