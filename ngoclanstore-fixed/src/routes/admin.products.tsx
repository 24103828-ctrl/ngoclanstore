import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/db-types";
import { realtimeChannelName } from "@/lib/realtime";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products")({
  component: () => <RequireAuth adminOnly><AdminLayout><ProductsAdmin /></AdminLayout></RequireAuth>,
});

type FormState = Partial<Product>;

function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FormState>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      setProducts((data as Product[]) ?? []);
    };
    load();
    const ch = supabase.channel(realtimeChannelName("admin-products")).on("postgres_changes", { event: "*", schema: "public", table: "products" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const openNew = () => { setEditing({ category: "Running", stock: 10, price: 0 }); setOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setOpen(true); };

  const save = async () => {
    if (!editing.name || !editing.price || !editing.category) { toast.error("Thiếu thông tin"); return; }
    const payload = {
      name: editing.name, description: editing.description ?? null, price: Number(editing.price),
      category: editing.category, image_url: editing.image_url ?? null, stock: Number(editing.stock ?? 0),
      is_featured: !!editing.is_featured, is_new: !!editing.is_new, is_best_seller: !!editing.is_best_seller,
    };
    if (editing.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Đã cập nhật");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) toast.error(error.message); else toast.success("Đã thêm sản phẩm");
    }
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("Xóa sản phẩm này?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Đã xóa");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <Button onClick={openNew}><Plus className="size-4 mr-1" /> Thêm</Button>
      </div>
      <div className="bg-card border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Tên</th><th className="p-3">Danh mục</th><th className="p-3">Giá</th><th className="p-3">Kho</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{p.category}</td>
                <td className="p-3">{formatVND(p.price)}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing.id ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tên</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Mô tả</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Giá (VND)</Label><Input type="number" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} /></div>
              <div><Label>Kho</Label><Input type="number" value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: +e.target.value })} /></div>
            </div>
            <div><Label>Danh mục</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
            <div><Label>Ảnh URL</Label><Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Nổi bật</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!editing.is_new} onChange={(e) => setEditing({ ...editing, is_new: e.target.checked })} /> Mới</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!editing.is_best_seller} onChange={(e) => setEditing({ ...editing, is_best_seller: e.target.checked })} /> Bán chạy</label>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button onClick={save}>Lưu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
