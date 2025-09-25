import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditIcon, EyeIcon, XIcon } from "lucide-react";
import { ExtractedData } from "../types";
import DetailModal from "./detail-modal";

interface MultiProductEditorProps {
  isOpen: boolean;
  onClose: () => void;
  products: ExtractedData[];
  fileName?: string;
}

export default function MultiProductEditor({ 
  isOpen, 
  onClose, 
  products, 
  fileName 
}: MultiProductEditorProps) {
  const [selectedProduct, setSelectedProduct] = useState<ExtractedData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // 商品をクリックした時の処理
  const handleProductClick = (product: ExtractedData) => {
    setSelectedProduct(product);
    setIsDetailModalOpen(true);
  };

  // 詳細モーダルを閉じる処理
  const handleDetailModalClose = () => {
    setIsDetailModalOpen(false);
    setSelectedProduct(null);
  };

  // 商品インデックスを取得
  const getProductIndex = (product: ExtractedData): number => {
    const structuredData = (product as any).structured_data;
    return structuredData?.product_index || 1;
  };

  // ステータスバッジを取得
  const getStatusBadge = (product: ExtractedData) => {
    if (product.is_validated) {
      return <Badge variant="default" className="bg-green-100 text-green-800">修正済み</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">未確認</Badge>;
  };

  // 判定結果バッジを取得
  const getValidationBadge = (product: ExtractedData) => {
    const hasRequiredFields = product.productName && product.jan_code && product.price;
    if (hasRequiredFields) {
      return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>;
    }
    return <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-200">NG</Badge>;
  };

    console.log("🎯 MultiProductEditor render:", { isOpen, productsCount: products.length });

  if (!isOpen || !products.length) {
    console.log("🚫 MultiProductEditor not rendering:", { isOpen, productsLength: products.length });
    return null;
  }

  console.log("✅ MultiProductEditor rendering with", products.length, "products");

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[98vw] max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center justify-between">
                  <span>一覧ごとの編集 - {fileName || 'ファイル名不明'}</span>
                  <Badge variant="secondary" className="ml-2">
                    {products.length}商品
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="overflow-y-auto max-h-[75vh]">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">商品一覧</CardTitle>
                <p className="text-sm text-slate-600">
                  項目をクリックすると個別編集画面に遷移します
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="min-w-[1400px]">
                    <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">商品名</TableHead>
                          <TableHead className="min-w-[100px]">発売予定日</TableHead>
                          <TableHead className="min-w-[140px]">JANコード</TableHead>
                          <TableHead className="min-w-[120px]">希望小売価格(税抜)</TableHead>
                          <TableHead className="min-w-[80px]">入数</TableHead>
                          <TableHead className="min-w-[120px]">商品サイズ</TableHead>
                          <TableHead className="min-w-[140px]">パッケージサイズ</TableHead>
                          <TableHead className="min-w-[120px]">内容サイズ</TableHead>
                          <TableHead className="min-w-[140px]">カートン外装</TableHead>
                          <TableHead className="min-w-[120px]">パッケージ形態</TableHead>
                          <TableHead className="min-w-[100px]">商品説明文</TableHead>
                          <TableHead className="min-w-[80px]">判定結果</TableHead>
                          <TableHead className="min-w-[80px]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                  <TableBody>
                    {products
                      .sort((a, b) => getProductIndex(a) - getProductIndex(b))
                      .map((product, index) => (
                        <TableRow 
                          key={product.id}
                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => handleProductClick(product)}
                        >
                          <TableCell className="font-medium">
                            <div className="min-w-[180px] text-sm" title={product.productName || '未入力'}>
                              {product.productName || '未入力 (NG)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[90px] text-sm">
                              {(product as any).structured_data?.release_date || (product as any).releaseDate || '12/1/2024'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[130px] text-sm font-mono" title={product.jan_code || '未入力'}>
                              {product.jan_code || '未入力 (NG)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[110px] text-sm">
                              {product.price ? `${Number(product.price).toLocaleString()}円(税抜価格${Math.floor(Number(product.price) * 0.91)}円)` : '未入力 (NG)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[70px] text-sm">
                              {product.stock || '72入\n(12パック×6BOX)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[110px] text-sm">
                              {product.dimensions || (product as any).productSize || '(16.7×約)63×89mm'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[130px] text-sm">
                              {(product as any).packageSize || (product as any).package_size || '約141×73×約159×385×ない'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[110px] text-sm">
                              {(product as any).contentSize || (product as any).content_size || '未入力 (NG)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[130px] text-sm">
                              {(product as any).cartonSize || (product as any).carton_size || '未入力 (NG)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[110px] text-sm">
                              {(product as any).packageType || (product as any).package_type || 'ピローパック(プラインド)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[90px] text-xs">
                              {product.description || (product as any).structured_data?.description || '未入力 (NG)'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-[70px]">
                              {getValidationBadge(product)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProductClick(product);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 個別編集モーダル */}
      <DetailModal
        isOpen={isDetailModalOpen}
        onClose={handleDetailModalClose}
        item={selectedProduct}
      />
    </>
  );
} 