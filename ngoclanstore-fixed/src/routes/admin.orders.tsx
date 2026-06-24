import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Order } from "@/lib/db-types";
import { realtimeChannelName } from "@/lib/realtime";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({
  component: () => <RequireAuth adminOnly><AdminLayout><OrdersAdmin /></AdminLayout></RequireAuth>,
});

const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
    };
    load();
    const ch = supabase.channel(realtimeChannelName("admin-orders")).on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Đã cập nhật trạng thái");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Đơn hàng</h1>
      <div className="bg-card border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Mã</th><th className="p-3">Khách</th><th className="p-3">SĐT</th><th className="p-3">Tổng</th><th className="p-3">Trạng thái</th><th className="p-3">Ngày</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                <td className="p-3">{o.customer_name}</td>
                <td className="p-3">{o.phone}</td>
                <td className="p-3 font-semibold">{formatVND(o.total)}</td>
                <td className="p-3">
                  <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                    <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
