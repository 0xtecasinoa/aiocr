import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DetailModal from "@/components/detail-modal";
import EnhancedDataEditor from "@/components/enhanced-data-editor";
import { authManager } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { ExtractedData } from "../types";
import { SearchIcon, FilterIcon, FolderIcon, EditIcon, EyeIcon, DownloadIcon, GridIcon, ListIcon, SettingsIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export default function DataListPage() {
  const [selectedItem, setSelectedItem] = useState<ExtractedData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEnhancedEditorOpen, setIsEnhancedEditorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFolder, setFilterFolder] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNGOnly, setShowNGOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "folder">("list");
  const itemsPerPage = 20;
  const { toast } = useToast();

  // Column configuration
  const allColumns = [
    { id: 'businessPartner', label: '取引先名', width: 'w-32' },
    { id: 'deliveryDestination', label: '納入先名', width: 'w-24' },
    { id: 'deliveryDepartment', label: '納入先部署名', width: 'w-32' },
    { id: 'deliveryAddress', label: '納入先住所', width: 'w-32' },
    { id: 'desiredDeliveryDate', label: '希望納期', width: 'w-24' },
    { id: 'productNumber', label: '品番', width: 'w-20' },
    { id: 'validationResult', label: '判定結果', width: 'w-20' },
    { id: 'operations', label: '操作', width: 'w-32' }
  ];

  // Show first 6 columns by default
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    allColumns.slice(0, 6).map(col => col.id)
  );
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  // Get visible columns in original order
  const getVisibleColumns = () => {
    return allColumns.filter(col => visibleColumns.includes(col.id));
  };

  // Render cell content based on column type
  const renderCellContent = (item: ExtractedData, columnId: string, index: number) => {
    switch (columnId) {
      case 'businessPartner':
        return item.manufacturer || item.brand || "CO-NECT株式会社";
      case 'deliveryDestination':
        return item.category || "神田店";
      case 'deliveryDepartment':
        return item.description ? item.description.slice(0, 20) + "..." : "営業部";
      case 'deliveryAddress':
        return item.origin || "東京都千代田区";
      case 'desiredDeliveryDate':
        return item.created_at ? new Date(item.created_at).toLocaleDateString('ja-JP').replace(/\//g, '/') : '2025/08/13';
      case 'productNumber':
        return item.sku || item.jan_code || `${item.productName?.charAt(0) || 'M'}${String(index + 1).padStart(3, '0')}`;
      case 'validationResult':
        return getValidationBadge(item);
      case 'operations':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(item);
            }}
          >
            <EditIcon className="w-4 h-4 mr-1" />
            編集
          </Button>
        );
      default:
        return "-";
    }
  };

    const currentUser = authManager.getState().user;

  // 正しいAPIエンドポイントを使用してExtractedDataを取得
  const { data: extractedDataResponse, isLoading, refetch } = useQuery({
    queryKey: ["extractedData", currentUser?.id],
    queryFn: () => apiClient.getExtractedData(0, 1000), // 大きなlimitで全データを取得
    enabled: !!currentUser, // 認証されたユーザーのみ
    refetchInterval: 5000, // 5秒ごとに更新
  });

  const extractedData = (extractedDataResponse as any)?.data || [];

  // フォルダ別にデータを整理
  const groupedByFolder = extractedData.reduce((acc: Record<string, ExtractedData[]>, item: ExtractedData) => {
    const folder = (item as any).folderName || item.category || "未分類";
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(item);
    return acc;
  }, {});

  // CSV出力ハンドラー
  const handleCsvExport = async (format: string) => {
    try {
      const blob = await apiClient.exportDataToCsv(format);
      
      // ファイルダウンロード
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      a.download = `extracted_data_${format}_${timestamp}.csv`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "エクスポート完了",
        description: `${format.toUpperCase()}形式でCSVファイルをダウンロードしました。`,
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: "エクスポートエラー",
        description: "CSVファイルのダウンロードに失敗しました。",
        variant: "destructive",
      });
    }
  };

  // NG判定ロジック（低信頼度または要レビューフラグ）
  const isNGItem = (item: ExtractedData) => {
    return (item.confidence_score && item.confidence_score < 70) || 
           item.needs_review || 
           !item.productName || 
           item.productName.trim() === '';
  };

  // フィルタリングロジック
  const filteredData = extractedData.filter((item: ExtractedData) => {
    const matchesSearch = !searchTerm || 
      item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item as any).rawText?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFolder = filterFolder === "all" || 
      (filterFolder && item.category === filterFolder);

    const matchesStatus = filterStatus === "all" ||
      (filterStatus === "unconfirmed" && !item.is_validated) ||
      (filterStatus === "confirmed" && item.is_validated);

    const matchesNGFilter = !showNGOnly || isNGItem(item);

    return matchesSearch && matchesFolder && matchesStatus && matchesNGFilter;
  });

  // フィルター変更時にページをリセット
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterFolder, filterStatus, showNGOnly]);

  // ページネーション
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // フォルダ（カテゴリ）一覧を取得
  const categories = Array.from(new Set(extractedData.map((item: ExtractedData) => item.category).filter(Boolean))) as string[];

  const handleRowClick = (item: ExtractedData) => {
    setSelectedItem(item);
    setIsEnhancedEditorOpen(true);
  };

  const handleModalClose = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
    refetch(); // データを再取得
  };

  const handleEnhancedEditorClose = () => {
    setIsEnhancedEditorOpen(false);
    setSelectedItem(null);
    refetch(); // データを再取得
  };

  const getStatusBadge = (item: ExtractedData) => {
    if (item.is_validated) {
      return <Badge variant="default" className="bg-green-100 text-green-800">修正済み</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">未確認</Badge>;
  };

  const getValidationBadge = (item: ExtractedData) => {
    if (isNGItem(item)) {
      return <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-200">NG</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>;
  };

  const getRowClassName = (item: ExtractedData) => {
    const baseClass = "cursor-pointer hover:bg-slate-50 transition-colors";
    if (isNGItem(item)) {
      return `${baseClass} bg-yellow-50 hover:bg-yellow-100`;
    }
    return baseClass;
  };

  const getDisplayFileName = (item: ExtractedData) => {
    // ファイル名を表示（productNameが空の場合はFile_IDを使用）
    return item.productName || `File_${(item as any).uploadedFileId?.slice(-8) || 'Unknown'}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FilterIcon className="w-5 h-5" />
            <span>フィルター・検索</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 検索 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">検索</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="ファイル名、内容で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* フォルダフィルター */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">フォルダ</label>
              <Select value={filterFolder} onValueChange={setFilterFolder}>
                <SelectTrigger>
                  <SelectValue placeholder="フォルダを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center space-x-2">
                      <FolderIcon className="w-4 h-4" />
                      <span>すべてのフォルダ</span>
                    </div>
                  </SelectItem>
                  {categories.map((category: string) => (
                    <SelectItem key={category} value={category}>
                      <div className="flex items-center space-x-2">
                        <FolderIcon className="w-4 h-4" />
                        <span>{category}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ステータスフィルター */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">処理ステータス</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="ステータスを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="unconfirmed">未確認</SelectItem>
                  <SelectItem value="confirmed">修正済み</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CSV出力 and Column Settings */}
            <div className="flex items-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    CSV出力
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleCsvExport('raw')}>
                    <span className="font-medium">そのまま</span>
                    <span className="text-sm text-slate-500 ml-2">全項目をそのまま出力</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCsvExport('shopify')}>
                    <span className="font-medium">Shopify</span>
                    <span className="text-sm text-slate-500 ml-2">Shopify形式で出力</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCsvExport('magento')}>
                    <span className="font-medium">Magento</span>
                    <span className="text-sm text-slate-500 ml-2">Magento形式で出力</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCsvExport('ec_cube')}>
                    <span className="font-medium">ECキューブ</span>
                    <span className="text-sm text-slate-500 ml-2">ECキューブ形式で出力</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Column Settings */}
              <Popover open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <SettingsIcon className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">表示項目の設定</h4>
                      <p className="text-xs text-slate-500">
                        表示する項目を選択してください（デフォルト：最初の6項目）
                      </p>
                    </div>
                    <div className="space-y-3">
                      {allColumns.map((column) => (
                        <div key={column.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={column.id}
                            checked={visibleColumns.includes(column.id)}
                            onCheckedChange={() => toggleColumn(column.id)}
                          />
                          <label 
                            htmlFor={column.id} 
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {column.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setVisibleColumns(allColumns.slice(0, 6).map(col => col.id))}
                      >
                        デフォルトに戻す
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => setIsColumnSelectorOpen(false)}
                      >
                        完了
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* 結果表示 */}
          <div className="mt-4 flex justify-end">
            <div className="text-sm text-slate-600">
              {filteredData.length}件のデータが見つかりました
            </div>
          </div>
        </CardContent>
      </Card>

      {/* データが見つからない場合 */}
      {filteredData.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-slate-400 mb-4">
              <FolderIcon className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">データが見つかりません</h3>
              <p className="text-sm">
                {extractedData.length === 0 
                    ? "まだ変換が成功したデータがありません。変換ページでOCR処理を実行してください。"
                  : "検索条件に一致するデータがありません。フィルター条件を変更してください。"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 表示モード切り替え */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "list" | "folder")} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list" className="flex items-center space-x-2">
                <ListIcon className="w-4 h-4" />
                <span>リスト表示</span>
              </TabsTrigger>
              <TabsTrigger value="folder" className="flex items-center space-x-2">
                <GridIcon className="w-4 h-4" />
                <span>フォルダ表示</span>
              </TabsTrigger>
            </TabsList>

            {/* リスト表示 */}
            <TabsContent value="list">
            <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {getVisibleColumns().map((column) => (
                          <TableHead key={column.id} className={column.width}>
                            {column.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item: ExtractedData, index: number) => (
                        <TableRow 
                          key={item.id}
                          className={getRowClassName(item)}
                          onClick={() => handleRowClick(item)}
                        >
                          {getVisibleColumns().map((column) => (
                            <TableCell 
                              key={column.id}
                              className={column.id === 'businessPartner' ? "font-medium" : 
                                       column.id === 'productNumber' ? "font-mono" : ""}
                            >
                              {renderCellContent(item, column.id, index)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              {/* ページネーション */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    前へ
                  </Button>
                  <span className="text-sm text-slate-600">
                    {currentPage} / {totalPages} ページ
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    次へ
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* フォルダ表示 */}
            <TabsContent value="folder">
              <div className="space-y-6">
                {Object.entries(groupedByFolder).map(([folderName, items]) => {
                  const filteredFolderItems = (items as ExtractedData[]).filter((item: ExtractedData) => {
                    const matchesSearch = !searchTerm || 
                      item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (item as any).rawText?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.description?.toLowerCase().includes(searchTerm.toLowerCase());

                    const matchesStatus = filterStatus === "all" ||
                      (filterStatus === "unconfirmed" && !item.is_validated) ||
                      (filterStatus === "confirmed" && item.is_validated);

                    return matchesSearch && matchesStatus;
                  });

                  if (filteredFolderItems.length === 0) return null;

                  return (
                    <Card key={folderName}>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <FolderIcon className="w-5 h-5 text-blue-600" />
                          <span>{folderName}</span>
                          <Badge variant="secondary" className="ml-auto">
                            {filteredFolderItems.length}件
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">No.</TableHead>
                              <TableHead>ファイル名</TableHead>
                              <TableHead>処理ステータス</TableHead>
                              <TableHead>作成日</TableHead>
                              <TableHead className="w-32">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFolderItems.map((item: ExtractedData, index: number) => (
                              <TableRow 
                                key={item.id}
                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => handleRowClick(item)}
                              >
                                <TableCell className="font-medium">
                                  {index + 1}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{getDisplayFileName(item)}</div>
                                    {item.description && (
                                      <div className="text-sm text-slate-500 truncate max-w-xs">
                                        {item.description}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(item)}
                                </TableCell>
                                <TableCell>
                                  {item.created_at ? new Date(item.created_at).toLocaleDateString('ja-JP') : '-'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRowClick(item);
                                    }}
                                  >
                                    <EyeIcon className="w-4 h-4 mr-1" />
                                    明細表示
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* ページネーション（リスト表示時のみ） */}
          {viewMode === "list" && totalPages > 1 && (
            <div className="mt-6 flex justify-center space-x-2">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                  >
                前へ
                  </Button>
                  
              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                    variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                    onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
              </div>
                  
                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                  >
                次へ
                  </Button>
                </div>
          )}
        </>
      )}

      {/* 明細モーダル */}
      {selectedItem && (
      <DetailModal
          item={selectedItem}
        isOpen={isDetailModalOpen}
          onClose={handleModalClose}
      />
      )}

      {/* 拡張データ編集モーダル */}
      <EnhancedDataEditor
        isOpen={isEnhancedEditorOpen}
        onClose={handleEnhancedEditorClose}
        item={selectedItem}
      />
    </div>
  );
}
