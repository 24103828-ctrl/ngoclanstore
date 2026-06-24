import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  component: () => <RequireAuth><Checkout /></RequireAuth>,
});

function Checkout() {
  const { user, profile } = useAuth();
  const { items, total, clearCart } = useCart();
  const nav = useNavigate();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || items.length === 0) return;
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    setSubmitting(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({ user_id: user.id, customer_name: name, phone, address, total, status: "pending" })
      .select()
      .single();
    if (error || !order) {
      toast.error("Đặt hàng thất bại");
      setSubmitting(false);
      return;
    }
    const rows = items.map((it) => ({
      order_id: (order as { id: string }).id,
      product_id: it.product_id,
      quantity: it.quantity,
      price: it.product?.price ?? 0,
    }));
    await supabase.from("order_items").insert(rows);
    await clearCart();
    toast.success("Đặt hàng thành công!");
    nav({ to: "/profile" });
  };

  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-5xl py-10">
        <h1 className="text-3xl font-bold mb-8">Thanh toán</h1>
        <form onSubmit={submit} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4 p-6 bg-card border rounded-2xl">
            <h3 className="font-semibold">Thông tin giao hàng</h3>
            <div className="space-y-2">
              <Label>Họ và tên *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ *</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={3} />
            </div>
          </div>
          <div className="p-6 bg-card border rounded-2xl h-fit space-y-3 sticky top-24">
            <h3 className="font-semibold mb-2">Đơn hàng ({items.length})</h3>
            {items.map((it) => (
              <div key={it.id} className="flex justify-between text-sm">
                <span className="truncate pr-2">{it.product?.name} ×{it.quantity}</span>
                <span className="shrink-0">{formatVND((it.product?.price ?? 0) * it.quantity)}</span>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between font-bold"><span>Tổng</span><span>{formatVND(total)}</span></div>
            <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting || items.length === 0}>
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Đặt hàng
            </Button>
          </div>
        </form>
      </div>
    </UserLayout>
  );
}
