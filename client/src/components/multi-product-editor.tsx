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
                  <Table className="min-w-[3800px]">
                    <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[100px]">ロット番号</TableHead>
                          <TableHead className="min-w-[80px]">区分</TableHead>
                          <TableHead className="min-w-[100px]">大分類</TableHead>
                          <TableHead className="min-w-[100px]">中分類</TableHead>
                          <TableHead className="min-w-[100px]">発売日</TableHead>
                          <TableHead className="min-w-[140px]">JANコード</TableHead>
                          <TableHead className="min-w-[120px]">商品番号</TableHead>
                          <TableHead className="min-w-[100px]">インストア</TableHead>
                          <TableHead className="min-w-[140px]">ジャンル名称</TableHead>
                          <TableHead className="min-w-[100px]">仕入先</TableHead>
                          <TableHead className="min-w-[120px]">メーカー名称</TableHead>
                          <TableHead className="min-w-[140px]">キャラクター名(IP名)</TableHead>
                          <TableHead className="min-w-[200px]">商品名称</TableHead>
                          <TableHead className="min-w-[120px]">参考販売価格</TableHead>
                          <TableHead className="min-w-[100px]">卸単価（抜）</TableHead>
                          <TableHead className="min-w-[100px]">卸可能数</TableHead>
                          <TableHead className="min-w-[80px]">発注数</TableHead>
                          <TableHead className="min-w-[100px]">発注金額</TableHead>
                          <TableHead className="min-w-[80px]">入数</TableHead>
                          <TableHead className="min-w-[100px]">予約解禁日</TableHead>
                          <TableHead className="min-w-[120px]">予約締め切り日</TableHead>
                          <TableHead className="min-w-[140px]">予約商品発送予定日</TableHead>
                          <TableHead className="min-w-[100px]">ケース梱入数</TableHead>
                          <TableHead className="min-w-[120px]">単品サイズ</TableHead>
                          <TableHead className="min-w-[120px]">内箱サイズ</TableHead>
                          <TableHead className="min-w-[120px]">カートンサイズ</TableHead>
                          <TableHead className="min-w-[120px]">内箱GTIN</TableHead>
                          <TableHead className="min-w-[120px]">外箱GTIN</TableHead>
                          <TableHead className="min-w-[150px]">商品説明</TableHead>
                          <TableHead className="min-w-[100px]">機材フィルム</TableHead>
                          <TableHead className="min-w-[80px]">原産国</TableHead>
                          <TableHead className="min-w-[80px]">対象年齢</TableHead>
                          <TableHead className="min-w-[120px]">画像1</TableHead>
                          <TableHead className="min-w-[120px]">画像2</TableHead>
                          <TableHead className="min-w-[120px]">画像3</TableHead>
                          <TableHead className="min-w-[120px]">画像4</TableHead>
                          <TableHead className="min-w-[120px]">画像5</TableHead>
                          <TableHead className="min-w-[120px]">画像6</TableHead>
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
                          <TableCell><div className="text-sm">{(product as any).lot_number || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).classification || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).major_category || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).minor_category || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).release_date || ''}</div></TableCell>
                          <TableCell><div className="text-sm font-mono">{product.jan_code || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).product_code || (product as any).sku || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).in_store || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).genre_name || (product as any).campaign_name || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).supplier_name || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).ip_name || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).character_name || ''}</div></TableCell>
                          <TableCell className="font-medium"><div className="text-sm">{product.productName || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).reference_sales_price ? `¥${Number((product as any).reference_sales_price).toLocaleString()}` : ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).wholesale_price || product.price ? `¥${Number((product as any).wholesale_price || product.price).toLocaleString()}` : ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).wholesale_quantity || (product as any).sold_out_quantity || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{product.stock || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).order_amount || (product as any).sold_out_amount || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).quantity_per_pack || (product as any).release_date_scheduled || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).reservation_release_date || (product as any).advance_notice_cutoff || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).reservation_deadline || (product as any).scheduled_release_date || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).reservation_shipping_date || (product as any).reserved_release_date || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).case_pack_quantity || (product as any).pack_quantity || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).single_product_size || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).inner_box_size || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).carton_size || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).inner_box_gtin || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).outer_box_gtin || ''}</div></TableCell>
                          <TableCell><div className="text-xs max-w-[150px] truncate" title={product.description || ''}>{product.description || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).protective_film_material || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).country_of_origin || ''}</div></TableCell>
                          <TableCell><div className="text-sm">{(product as any).target_age || ''}</div></TableCell>
                          <TableCell><div className="text-xs truncate max-w-[120px]" title={(product as any).image1 || ''}>{(product as any).image1 || ''}</div></TableCell>
                          <TableCell><div className="text-xs truncate max-w-[120px]" title={(product as any).image2 || ''}>{(product as any).image2 || ''}</div></TableCell>
                          <TableCell><div className="text-xs truncate max-w-[120px]" title={(product as any).image3 || ''}>{(product as any).image3 || ''}</div></TableCell>
                          <TableCell><div className="text-xs truncate max-w-[120px]" title={(product as any).image4 || ''}>{(product as any).image4 || ''}</div></TableCell>
                          <TableCell><div className="text-xs truncate max-w-[120px]" title={(product as any).image5 || ''}>{(product as any).image5 || ''}</div></TableCell>
                          <TableCell><div className="text-xs truncate max-w-[120px]" title={(product as any).image6 || ''}>{(product as any).image6 || ''}</div></TableCell>
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