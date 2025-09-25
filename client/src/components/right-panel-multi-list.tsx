import React from 'react';
import { X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExtractedData } from '@/types';

interface RightPanelMultiListProps {
  products: ExtractedData[];
  fileName: string;
  isVisible: boolean;
  onClose: () => void;
  onProductClick: (product: ExtractedData) => void;
}

export const RightPanelMultiList: React.FC<RightPanelMultiListProps> = ({
  products,
  fileName,
  isVisible,
  onClose,
  onProductClick
}) => {
  if (!isVisible) return null;

  const getProductIndex = (product: ExtractedData) => {
    return (product as any).productIndex || 
           (product as any).structured_data?.product_index || 
           1;
  };

  const getStatusBadge = (product: ExtractedData) => {
    const hasValidName = product.productName && product.productName.trim() !== '';
    const hasValidJan = (product as any).jan_code && (product as any).jan_code.trim() !== '';
    const hasValidPrice = product.price && product.price > 0;
    
    if (hasValidName && hasValidJan && hasValidPrice) {
      return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>;
    } else {
      return <Badge variant="destructive" className="bg-orange-100 text-orange-800">NG</Badge>;
    }
  };

  const sortedProducts = [...products].sort((a, b) => getProductIndex(a) - getProductIndex(b));

  return (
    <>
      {/* Background overlay for mobile */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-25 z-30 lg:hidden"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-lg z-40 overflow-hidden transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">項目ごとの編集</h3>
              <p className="text-sm text-gray-600 truncate" title={fileName}>
                {fileName}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">
                  マルチリスト ({sortedProducts.length}件)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {sortedProducts.map((product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                      onClick={() => onProductClick(product)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500">
                            #{getProductIndex(product)}
                          </span>
                          {getStatusBadge(product)}
                        </div>
                        <div className="font-medium text-sm text-gray-900 truncate" title={product.productName || '未入力'}>
                          {product.productName || '商品名未入力'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          <div className="flex items-center gap-2">
                            <span>JAN: {(product as any).jan_code || '未入力'}</span>
                            {product.price && (
                              <span>¥{Number(product.price).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onProductClick(product);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Summary section */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">概要</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>総商品数:</span>
                  <span>{sortedProducts.length}件</span>
                </div>
                <div className="flex justify-between">
                  <span>OK判定:</span>
                  <span className="text-green-600">
                    {sortedProducts.filter(p => {
                      const hasValidName = p.productName && p.productName.trim() !== '';
                      const hasValidJan = (p as any).jan_code && (p as any).jan_code.trim() !== '';
                      const hasValidPrice = p.price && p.price > 0;
                      return hasValidName && hasValidJan && hasValidPrice;
                    }).length}件
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>NG判定:</span>
                  <span className="text-orange-600">
                    {sortedProducts.filter(p => {
                      const hasValidName = p.productName && p.productName.trim() !== '';
                      const hasValidJan = (p as any).jan_code && (p as any).jan_code.trim() !== '';
                      const hasValidPrice = p.price && p.price > 0;
                      return !(hasValidName && hasValidJan && hasValidPrice);
                    }).length}件
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}; 