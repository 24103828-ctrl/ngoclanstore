import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, ShoppingBag, Users, DollarSign } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/format";
import type { Order } from "@/lib/db-types";
import { realtimeChannelName } from "@/lib/realtime";

export const Route = createFileRoute("/admin/")({
  component: () => <RequireAuth adminOnly><AdminLayout><Dashboard /></AdminLayout></RequireAuth>,
});

function Dashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, users: 0, revenue: 0 });
  const [recent, setRecent] = useState<Order[]>([]);

  useEffect(() => {
    const load = async () => {
      const [p, o, u, ro] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total_amount"),
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      const orders = (o.data as { total_amount: number }[]) ?? [];
      setStats({
        products: p.count ?? 0,
        orders: orders.length,
        users: u.count ?? 0,
        revenue: orders.reduce((s, x) => s + (x.total_amount ?? 0), 0),
      });
      setRecent((ro.data as Order[]) ?? []);
    };
    load();
    const ch = supabase.channel(realtimeChannelName("admin-stats")).on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cards = [
    { t: "Sản phẩm", v: stats.products, icon: Package },
    { t: "Đơn hàng", v: stats.orders, icon: ShoppingBag },
    { t: "Người dùng", v: stats.users, icon: Users },
    { t: "Doanh thu", v: formatVND(stats.revenue), icon: DollarSign },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.t} className="p-5 bg-card border rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.t}</div>
                <div className="text-2xl font-bold mt-2">{c.v}</div>
              </div>
              <div className="size-10 rounded-full bg-accent text-accent-foreground grid place-items-center"><c.icon className="size-5" /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-6 bg-card border rounded-2xl">
        <h3 className="font-semibold mb-4">Đơn hàng gần đây</h3>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có đơn hàng.</p> : (
          <div className="space-y-2">
            {recent.map((o) => (
              <div key={o.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div className="text-sm">
                  <div className="font-medium">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("vi-VN")}</div>
                </div>
                <div className="font-bold text-primary">{formatVND(o.total_amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
