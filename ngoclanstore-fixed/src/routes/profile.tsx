import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserLayout } from "@/components/layout/UserLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Order } from "@/lib/db-types";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { realtimeChannelName } from "@/lib/realtime";

export const Route = createFileRoute("/profile")({
  component: () => <RequireAuth><Profile /></RequireAuth>,
});

const statusLabel: Record<string, string> = {
  pending: "Chờ xử lý", processing: "Đang xử lý", shipped: "Đang giao", delivered: "Đã giao", cancelled: "Đã hủy",
};

function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [orders, setOrders] = useState<Order[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (profile) { setName(profile.full_name ?? ""); setPhone(profile.phone ?? ""); } }, [profile]);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error("[orders] fetch error", {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
            return;
          }
          setOrders((data as Order[]) ?? []);
        });
    };
    load();
    const ch = supabase
      .channel(realtimeChannelName(`orders-${user.id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({ full_name: name, phone, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("[profile] update error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      setSaving(false);
      toast.error("Không thể lưu thông tin tài khoản");
      return;
    }

    await refreshProfile();
    setSaving(false);
    toast.success("Đã lưu thông tin");
  };

  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-5xl py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-6">Tài khoản</h1>
          <div className="p-6 bg-card border rounded-2xl space-y-4 max-w-xl">
            <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div className="space-y-2"><Label>Họ tên</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Số điện thoại</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="size-4 mr-2 animate-spin" />}Lưu</Button>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-4">Đơn hàng của tôi</h2>
          {orders.length === 0 ? (
            <p className="text-muted-foreground">Chưa có đơn hàng nào.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="p-4 bg-card border rounded-xl flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <div className="font-semibold">#{o.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("vi-VN")}</div>
                  </div>
                  <div className="text-sm">{o.customer_name} — {o.phone}</div>
                  <div className="font-bold text-primary">{formatVND(o.total)}</div>
                  <span className="text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground font-medium">{statusLabel[o.status] ?? o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
