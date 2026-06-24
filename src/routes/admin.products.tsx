import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/db-types";
import { realtimeChannelName } from "@/lib/realtime";
import { formatVND } from "@/lib/format";
import {
  uploadFile,
  removeFile,
  productImagePath,
} from "@/lib/storage-upload";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products")({
  component: () => (
    <RequireAuth adminOnly>
      <AdminLayout>
        <ProductsAdmin />
      </AdminLayout>
    </RequireAuth>
  ),
});

type FormState = Partial<Product>;

function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FormState>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[admin-products] fetch error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      } else {
        setProducts((data as Product[]) ?? []);
      }
    };
    void load();
    const ch = supabase
      .channel(realtimeChannelName("admin-products"))
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const openNew = () => {
    setEditing({ category: "Running", stock: 10, price: 0 });
    setPendingFile(null);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setPendingFile(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (saving || uploading) return;
    setOpen(false);
    setPendingFile(null);
  };

  /* ─── Save (create / edit) ─────────────────────────────── */

  const save = async () => {
    if (!editing.name || !editing.price || !editing.category) {
      toast.error("Vui lòng điền đầy đủ tên, giá và danh mục.");
      return;
    }
    if (saving || uploading) return;

    setSaving(true);

    let imageUrl = editing.image_url ?? null;
    let imagePath = editing.image_path ?? null;
    let uploadedPath: string | null = null;
    const previousPath = editing.image_path ?? null;

    // ── Handle image upload ────────────────────────────────
    if (pendingFile) {
      setUploading(true);
      const productId = editing.id ?? crypto.randomUUID();
      const path = productImagePath(productId, pendingFile);
      try {
        const result = await uploadFile("product-images", path, pendingFile);
        uploadedPath = result.path;
        imageUrl = result.publicUrl;
        imagePath = result.path;
        setUploading(false);
      } catch (err: unknown) {
        setUploading(false);
        setSaving(false);
        toast.error(err instanceof Error ? err.message : "Không thể tải ảnh lên.");
        return;
      }
    }

    const payload = {
      name: editing.name,
      description: editing.description ?? null,
      price: Number(editing.price),
      category: editing.category,
      image_url: imageUrl,
      image_path: imagePath,
      stock: Number(editing.stock ?? 0),
      is_active: editing.is_active ?? true,
      is_featured: !!editing.is_featured,
      is_new: !!editing.is_new,
      is_best_seller: !!editing.is_best_seller,
    };

    if (editing.id) {
      // ── Update existing product ────────────────────────
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editing.id);

      if (error) {
        console.error("[admin-products] update error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        // Rollback newly uploaded image since DB failed
        if (uploadedPath) {
          await removeFile("product-images", uploadedPath);
        }
        toast.error("Không thể cập nhật sản phẩm: " + error.message);
        setSaving(false);
        return;
      }

      // Only remove old image AFTER successful DB update
      if (uploadedPath && previousPath && previousPath !== uploadedPath) {
        await removeFile("product-images", previousPath);
      }

      toast.success("Đã cập nhật sản phẩm");
    } else {
      // ── Insert new product ─────────────────────────────
      const { error } = await supabase.from("products").insert(payload);

      if (error) {
        console.error("[admin-products] insert error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        // Rollback uploaded image
        if (uploadedPath) {
          await removeFile("product-images", uploadedPath);
        }
        toast.error("Không thể thêm sản phẩm: " + error.message);
        setSaving(false);
        return;
      }
      toast.success("Đã thêm sản phẩm");
    }

    setSaving(false);
    setOpen(false);
    setPendingFile(null);
  };

  /* ─── Delete ───────────────────────────────────────────── */

  const del = async (product: Product) => {
    if (!confirm("Xóa sản phẩm này?")) return;

    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      console.error("[admin-products] delete error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      toast.error("Không thể xóa sản phẩm: " + error.message);
      return;
    }

    // Remove storage object only if image_path exists
    if (product.image_path) {
      await removeFile("product-images", product.image_path);
    }

    toast.success("Đã xóa sản phẩm");
  };

  /* ─── Render ───────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <Button onClick={openNew}>
          <Plus className="size-4 mr-1" /> Thêm
        </Button>
      </div>

      <div className="bg-card border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Ảnh</th>
              <th className="p-3">Tên</th>
              <th className="p-3">Danh mục</th>
              <th className="p-3">Giá</th>
              <th className="p-3">Kho</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="size-10 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="size-10 rounded-lg bg-muted" />
                  )}
                </td>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{p.category}</td>
                <td className="p-3">{formatVND(p.price)}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void del(p)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Product form dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image uploader */}
            <div>
              <Label className="mb-1.5 block">Ảnh sản phẩm</Label>
              <ImageUploader
                currentUrl={editing.image_url ?? null}
                onFileSelect={setPendingFile}
                uploading={uploading}
                aspectHint="Khuyến nghị tỉ lệ 1:1 hoặc 4:3"
              />
            </div>

            <div>
              <Label>Tên</Label>
              <Input
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Mô tả</Label>
              <Textarea
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Giá (VND)</Label>
                <Input
                  type="number"
                  value={editing.price ?? 0}
                  onChange={(e) => setEditing({ ...editing, price: +e.target.value })}
                />
              </div>
              <div>
                <Label>Kho</Label>
                <Input
                  type="number"
                  value={editing.stock ?? 0}
                  onChange={(e) => setEditing({ ...editing, stock: +e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Danh mục</Label>
              <Input
                value={editing.category ?? ""}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Đang kinh doanh
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.is_featured}
                  onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
                />
                Nổi bật
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.is_new}
                  onChange={(e) => setEditing({ ...editing, is_new: e.target.checked })}
                />
                Mới
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.is_best_seller}
                  onChange={(e) => setEditing({ ...editing, is_best_seller: e.target.checked })}
                />
                Bán chạy
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={saving || uploading}>
              Hủy
            </Button>
            <Button onClick={() => void save()} disabled={saving || uploading}>
              {(saving || uploading) && <Loader2 className="size-4 mr-2 animate-spin" />}
              {uploading ? "Đang tải ảnh…" : saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
