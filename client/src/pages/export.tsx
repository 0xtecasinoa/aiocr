import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { authManager } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ExtractedData } from "../types";
import { 
  Box, 
  FileTextIcon, 
  DownloadIcon,
  EyeIcon 
} from "lucide-react";

// Import official logos
import shopifyLogo from "@/assets/shopify.jpeg";
import magentoLogo from "@/assets/magento.png";
import eccubeLogo from "@/assets/EC.png";

export default function ExportPage() {
  const [selectedFormat, setSelectedFormat] = useState("original");
  const [selectedOnly, setSelectedOnly] = useState(true);
  const [excludeOutOfStock, setExcludeOutOfStock] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);
  const [filename, setFilename] = useState(`export_products_${new Date().toISOString().split('T')[0]}`);
  const [isExporting, setIsExporting] = useState(false);

  const { toast } = useToast();
  const currentUser = authManager.getState().user;

  const { data: extractedDataResponse, isLoading } = useQuery({
    queryKey: ["extractedData", currentUser?.id],
    queryFn: () => apiClient.getExtractedData(0, 1000), // Get all data for export
    enabled: !!currentUser,
  });

  const extractedData = (extractedDataResponse as any)?.data || [];

  const formatOptions = [
    {
      id: "shopify",
      name: "Shopify",
      description: "Shopify形式で出力",
      logo: shopifyLogo,
      icon: undefined,
      color: "text-green-500",
    },
    {
      id: "magento",
      name: "Magento",
      description: "Magento形式で出力",
      logo: magentoLogo,
      icon: undefined,
      color: "text-orange-500",
    },
    {
      id: "eccube",
      name: "ECキューブ",
      description: "EC-CUBE形式で出力",
      logo: eccubeLogo,
      icon: undefined,
      color: "text-blue-500",
    },
    {
      id: "original",
      name: "変換後のレイアウトで出力",
      logo: undefined,
      icon: FileTextIcon,
      color: "text-slate-500",
    },
  ];

  const handleExport = async () => {
    if (filteredData.length === 0) {
      toast({
        title: "エクスポートエラー",
        description: "エクスポートするデータがありません。",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      // Use the existing CSV export functionality from apiClient
      const formatMap: Record<string, string> = {
        'shopify': 'shopify',
        'magento': 'magento', 
        'eccube': 'ec_cube',
        'original': 'raw'
      };
      
      const exportFormat = formatMap[selectedFormat] || 'raw';
      const blob = await apiClient.exportDataToCsv(exportFormat);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "エクスポート完了",
        description: `${formatOptions.find(f => f.id === selectedFormat)?.name}形式でCSVファイルをダウンロードしました。`,
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: "エクスポートエラー",
        description: "CSVファイルの生成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreview = () => {
    toast({
      title: "プレビュー機能",
      description: "プレビュー機能は準備中です。",
    });
  };

  const filteredData = extractedData.filter((item: ExtractedData) => {
    if (excludeOutOfStock && (item.stock || 0) === 0) {
      return false;
    }
    return true;
  });

  const filteredDataCount = filteredData.length;

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">CSV出力</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Export Format Selection */}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-4 block">
                出力形式選択
              </Label>
              <RadioGroup 
                value={selectedFormat} 
                onValueChange={setSelectedFormat}
                className="space-y-3"
              >
                {formatOptions.map((option) => (
                  <div key={option.id} className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value={option.id} 
                      id={option.id}
                      data-testid={`radio-format-${option.id}`}
                    />
                    <label
                      htmlFor={option.id}
                      className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex-1"
                    >
                      {option.logo ? (
                        <img 
                          src={option.logo} 
                          alt={`${option.name} logo`}
                          className="w-8 h-8 object-contain"
                        />
                      ) : option.icon ? (
                      <option.icon className={`w-5 h-5 ${option.color}`} />
                      ) : null}
                      <div>
                        <div className="font-medium" data-testid={`text-format-name-${option.id}`}>
                          {option.name}
                        </div>
                        <div className="text-sm text-slate-500">
                          {option.description}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            {/* Export Options */}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-4 block">
                出力オプション
              </Label>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="selectedOnly"
                    checked={selectedOnly}
                    onCheckedChange={(checked) => setSelectedOnly(checked === true)}
                    data-testid="checkbox-selected-only"
                  />
                  <label htmlFor="selectedOnly" className="text-slate-700 cursor-pointer">
                    選択した商品のみ出力
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="excludeOutOfStock"
                    checked={excludeOutOfStock}
                    onCheckedChange={(checked) => setExcludeOutOfStock(checked === true)}
                    data-testid="checkbox-exclude-out-of-stock"
                  />
                  <label htmlFor="excludeOutOfStock" className="text-slate-700 cursor-pointer">
                    在庫数0の商品を除外
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="includeImages"
                    checked={includeImages}
                    onCheckedChange={(checked) => setIncludeImages(checked === true)}
                    data-testid="checkbox-include-images"
                  />
                  <label htmlFor="includeImages" className="text-slate-700 cursor-pointer">
                    画像URLを含める
                  </label>
                </div>
                
                <div className="pt-4">
                  <Label htmlFor="filename" className="text-sm font-medium text-slate-700 mb-2 block">
                    ファイル名
                  </Label>
                  <Input
                    id="filename"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="ファイル名を入力"
                    data-testid="input-filename"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Data Preview */}
          <div className="mt-8">
            <h4 className="font-medium text-slate-800 mb-4">出力対象データ</h4>
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileTextIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>出力対象のデータがありません</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">商品名</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">SKU</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">価格</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">在庫数</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">カテゴリ</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">ステータス</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredData.slice(0, 10).map((item: ExtractedData, index: number) => {
                        // Function to truncate long text
                        const truncateText = (text: string, maxLength: number = 50) => {
                          if (!text) return '-';
                          return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
                        };

                        const productName = item.productName || `Product_${item.id?.slice(-8)}`;
                        
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 max-w-xs">
                              <div className="font-medium text-slate-900 truncate" title={productName}>
                                {truncateText(productName, 30)}
                              </div>
                              {item.description && (
                                <div className="text-xs text-slate-500 truncate" title={item.description}>
                                  {truncateText(item.description, 40)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-slate-700 max-w-20">
                              <div className="truncate" title={item.sku || '-'}>
                                {truncateText(item.sku || '', 15)}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-slate-700 text-right">
                              {item.price ? `¥${item.price.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-2 text-slate-700 text-center">
                              {item.stock !== undefined ? item.stock : '-'}
                            </td>
                            <td className="px-4 py-2 text-slate-700 max-w-24">
                              <div className="truncate" title={item.category || '-'}>
                                {truncateText(item.category || '', 20)}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              {item.is_validated ? (
                                <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                                  修正済み
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                                  未確認
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredData.length > 10 && (
                  <div className="px-4 py-3 bg-slate-50 border-t text-center text-sm text-slate-600">
                    他 {filteredData.length - 10} 件のデータがあります
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Export Summary */}
          <div className="mt-8 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-2">エクスポート概要</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">対象データ数:</span>
                <Badge variant="secondary" data-testid="badge-export-count">
                  {filteredDataCount}件
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">出力形式:</span>
                <span className="font-medium" data-testid="text-selected-format">
                  {formatOptions.find(f => f.id === selectedFormat)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">ファイル名:</span>
                <span className="font-medium" data-testid="text-export-filename">
                  {filename}.csv
                </span>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="mt-8 flex justify-end space-x-4">
            <Button 
              variant="outline" 
              onClick={handlePreview}
              disabled={isExporting || extractedData.length === 0}
              data-testid="button-preview"
            >
              <EyeIcon className="w-4 h-4 mr-2" />
              プレビュー
            </Button>
            <Button 
              onClick={handleExport}
              disabled={isExporting || extractedData.length === 0}
              className="bg-primary hover:bg-blue-600"
              data-testid="button-export"
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              {isExporting ? "出力中..." : "CSV出力"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
