import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditIcon, SaveIcon, XIcon } from "lucide-react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // データ更新のミューテーション
  const updateMutation = useMutation({
    mutationFn: (data: UpdateExtractedData) => {
      if (!item) throw new Error("No item to update");
      return apiClient.updateExtractedData(item.id, data);
    },
    onSuccess: () => {
      toast({
        title: "保存完了",
        description: "データが正常に保存されました。",
      });
      setHasChanges(false);
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["extractedData"] });
    },
    onError: (error) => {
      toast({
        title: "保存エラー",
        description: "データの保存に失敗しました。",
        variant: "destructive",
      });
      console.error("Update error:", error);
    },
  });

  // アイテムが変更された時にフォームデータを初期化
  useEffect(() => {
    if (item) {
      setFormData({
        productName: item.productName || "",
        productCode: item.productCode || "",
        characterName: item.characterName || "",
        releaseDate: item.releaseDate || "",
        referenceSalesPrice: item.referenceSalesPrice || undefined,
        janCode: item.janCode || "",
        innerBoxGtin: item.innerBoxGtin || "",
        singleProductSize: item.singleProductSize || "",
        packageSize: item.packageSize || "",
        innerBoxSize: item.innerBoxSize || "",
        cartonSize: item.cartonSize || "",
        quantityPerPack: item.quantityPerPack || "",
        casePackQuantity: item.casePackQuantity || undefined,
        packageType: item.packageType || "",
        description: item.description || "",
      });
      setIsEditMode(false);
      setHasChanges(false);
    }
  }, [item]);

  const handleFormChange = (field: keyof UpdateExtractedData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!item) return;
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (hasChanges && !confirm("変更内容が失われますが、キャンセルしますか？")) {
      return;
    }
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">商品データ詳細</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {isEditMode ? (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">編集モード</Badge>
              ) : (
                <Badge variant="outline">閲覧モード</Badge>
              )}
            </div>
            <div className="flex space-x-2">
              {isEditMode ? (
                <>
                  <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm">
                    <SaveIcon className="w-4 h-4 mr-2" />
                    保存
                  </Button>
                  <Button onClick={() => setIsEditMode(false)} variant="outline" size="sm">
                    <XIcon className="w-4 h-4 mr-2" />
                    キャンセル
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditMode(true)} size="sm">
                  <EditIcon className="w-4 h-4 mr-2" />
                  編集
                </Button>
              )}
            </div>
          </div>

          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>商品名 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.productName || ""}
                  onChange={(e) => handleFormChange("productName", e.target.value)}
                  disabled={!isEditMode}
                  className={!isEditMode ? "bg-slate-50" : ""}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>品番/商品番号</Label>
                  <Input
                    value={formData.productCode || ""}
                    onChange={(e) => handleFormChange("productCode", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                  />
                </div>
                <div>
                  <Label>キャラクター名</Label>
                  <Input
                    value={formData.characterName || ""}
                    onChange={(e) => handleFormChange("characterName", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>発売予定日</Label>
                  <Input
                    value={formData.releaseDate || ""}
                    onChange={(e) => handleFormChange("releaseDate", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                    placeholder="例: 2025年1月24日"
                  />
                </div>
                <div>
                  <Label>希望小売価格</Label>
                  <Input
                    type="number"
                    value={formData.referenceSalesPrice || ""}
                    onChange={(e) => handleFormChange("referenceSalesPrice", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                    placeholder="例: 1100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* JANコード/バーコード */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">JANコード/バーコード</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>単品 JANコード</Label>
                  <Input
                    value={formData.janCode || ""}
                    onChange={(e) => handleFormChange("janCode", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                    placeholder="例: 4970381806170"
                  />
                </div>
                <div>
                  <Label>BOX/内箱 JANコード</Label>
                  <Input
                    value={formData.innerBoxGtin || ""}
                    onChange={(e) => handleFormChange("innerBoxGtin", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* サイズ情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">サイズ情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>商品サイズ</Label>
                  <Input
                    value={formData.singleProductSize || ""}
                    onChange={(e) => handleFormChange("singleProductSize", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                    placeholder="例: H150×W100mm"
                  />
                </div>
                <div>
                  <Label>パッケージサイズ</Label>
                  <Input
                    value={formData.packageSize || ""}
                    onChange={(e) => handleFormChange("packageSize", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>内箱サイズ</Label>
                  <Input
                    value={formData.innerBoxSize || ""}
                    onChange={(e) => handleFormChange("innerBoxSize", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                  />
                </div>
                <div>
                  <Label>カートンサイズ</Label>
                  <Input
                    value={formData.cartonSize || ""}
                    onChange={(e) => handleFormChange("cartonSize", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 数量・梱包情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">数量・梱包情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>入数</Label>
                  <Input
                    value={formData.quantityPerPack || ""}
                    onChange={(e) => handleFormChange("quantityPerPack", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                    placeholder="例: 12個"
                  />
                </div>
                <div>
                  <Label>カートン入数/ケース梱入数</Label>
                  <Input
                    type="number"
                    value={formData.casePackQuantity || ""}
                    onChange={(e) => handleFormChange("casePackQuantity", e.target.value)}
                    disabled={!isEditMode}
                    className={!isEditMode ? "bg-slate-50" : ""}
                    placeholder="例: 72"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 商品詳細 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">商品詳細</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>パッケージ形態</Label>
                <Input
                  value={formData.packageType || ""}
                  onChange={(e) => handleFormChange("packageType", e.target.value)}
                  disabled={!isEditMode}
                  className={!isEditMode ? "bg-slate-50" : ""}
                  placeholder="例: ブリスター、箱"
                />
              </div>

              <div>
                <Label>セット内容・素材・仕様など</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => handleFormChange("description", e.target.value)}
                  disabled={!isEditMode}
                  className={!isEditMode ? "bg-slate-50" : ""}
                  rows={4}
                  placeholder="商品の詳細情報を入力してください"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
