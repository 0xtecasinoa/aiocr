import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EditIcon } from "lucide-react";
import { ExtractedData } from "../types";
import { cn } from "@/lib/utils";

interface DataTableProps {
  data: ExtractedData[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (item: ExtractedData) => void;
}

export default function DataTable({ data, selectedIds, onSelectionChange, onEdit }: DataTableProps) {
  
  const formatPrice = (price: string | number | undefined) => {
    if (!price) return "-";
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return isNaN(numPrice) ? price : `¥${numPrice.toLocaleString()}`;
  };

  const getCategoryBadge = (category: string | undefined) => {
    if (!category) return <Badge variant="outline">未分類</Badge>;
    
    const categoryColors: { [key: string]: string } = {
      "電子機器": "bg-blue-100 text-blue-700",
      "アクセサリ": "bg-purple-100 text-purple-700",
      "家電": "bg-green-100 text-green-700",
      "衣類": "bg-pink-100 text-pink-700",
      "食品": "bg-orange-100 text-orange-700",
      "その他": "bg-gray-100 text-gray-700"
    };
    
    return (
      <Badge className={categoryColors[category] || "bg-gray-100 text-gray-700"}>
        {category}
      </Badge>
    );
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700">変換完了</Badge>;
      case "needs_review":
        return <Badge className="bg-yellow-100 text-yellow-700">要確認</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-700">エラー</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700">{status || "不明"}</Badge>;
    }
  };

  const handleRowClick = (item: ExtractedData) => {
    onEdit(item);
  };

  const handleCheckboxChange = (itemId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, itemId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== itemId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(data.map(item => String(item.id)));
    } else {
      onSelectionChange([]);
    }
  };

  const isAllSelected = data.length > 0 && selectedIds.length === data.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < data.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = isIndeterminate;
                  }}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              <TableHead>商品名</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>価格</TableHead>
              <TableHead>在庫数</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow 
                key={item.id} 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => handleRowClick(item)}
                data-testid={`row-${item.id}`}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(String(item.id))}
                    onCheckedChange={(checked) => handleCheckboxChange(String(item.id), checked as boolean)}
                    data-testid={`checkbox-${item.id}`}
                  />
                </TableCell>
                <TableCell data-testid={`text-product-name-${item.id}`}>
                  <div className="font-medium text-slate-900">
                    {item.productName || "未設定"}
                  </div>
                </TableCell>
                <TableCell data-testid={`text-sku-${item.id}`}>
                  <span className="text-slate-600">
                    {item.sku || "-"}
                  </span>
                </TableCell>
                <TableCell data-testid={`text-price-${item.id}`}>
                  {formatPrice(item.price)}
                </TableCell>
                <TableCell data-testid={`text-stock-${item.id}`}>
                  <span className={cn(
                    "font-medium",
                    (item.stock || 0) <= 5 ? "text-orange-600" : "text-slate-700"
                  )}>
                    {item.stock || "-"}
                  </span>
                </TableCell>
                <TableCell data-testid={`badge-category-${item.id}`}>
                  {getCategoryBadge(item.category)}
                </TableCell>
                <TableCell data-testid={`badge-status-${item.id}`}>
                  {getStatusBadge(item.status || 'completed')}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                    data-testid={`button-edit-${item.id}`}
                  >
                    <EditIcon className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
