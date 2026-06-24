import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Search, ChevronDown, X, Eye, Loader2 } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem, OrderStatus, OrderStatusHistory } from "@/lib/db-types";
import { statusMap, getStatusLabel } from "@/lib/order-status";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({
  component: () => (
    <RequireAuth adminOnly>
      <AdminLayout>
        <OrdersAdmin />
      </AdminLayout>
    </RequireAuth>
  ),
});

const ALL_STATUSES = Object.keys(statusMap) as OrderStatus[];
const PAGE_SIZE = 20;

/* ─── Types ─────────────────────────────────────────────── */

interface OrderWithItems extends Order {
  items?: OrderItem[];
  history?: OrderStatusHistory[];
}

interface PendingStatusChange {
  order: Order;
  newStatus: OrderStatus;
}

/* ─── Main Component ─────────────────────────────────────── */

function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [page, setPage] = useState(1);

  // Order detail
  const [detailOrder, setDetailOrder] = useState<OrderWithItems | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Status change confirmation
  const [pendingChange, setPendingChange] = useState<PendingStatusChange | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [changing, setChanging] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ─── Load orders ──────────────────────────────────────── */

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[admin-orders] fetch error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      setLoadError(error.message);
    } else {
      setOrders((data as Order[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOrders();

    // One Realtime channel for the whole orders list
    const channel = supabase
      .channel("admin-orders-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => void loadOrders(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => void loadOrders(),
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [loadOrders]);

  /* ─── Filtering / search ───────────────────────────────── */

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.id.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  /* ─── Order detail ─────────────────────────────────────── */

  const openDetail = async (order: Order) => {
    setDetailOrder(order);
    setDetailLoading(true);

    const [itemsRes, historyRes] = await Promise.all([
      supabase
        .from("order_items")
        .select("*, product:products(id, name, image_url, price)")
        .eq("order_id", order.id),
      supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false }),
    ]);

    if (itemsRes.error) {
      console.error("[admin-orders] items fetch error", {
        code: itemsRes.error.code,
        message: itemsRes.error.message,
        details: itemsRes.error.details,
        hint: itemsRes.error.hint,
      });
    }
    if (historyRes.error) {
      console.error("[admin-orders] history fetch error", {
        code: historyRes.error.code,
        message: historyRes.error.message,
        details: historyRes.error.details,
        hint: historyRes.error.hint,
      });
    }

    setDetailOrder({
      ...order,
      items: (itemsRes.data as OrderItem[]) ?? [],
      history: (historyRes.data as OrderStatusHistory[]) ?? [],
    });
    setDetailLoading(false);
  };

  /* ─── Status change ────────────────────────────────────── */

  const requestStatusChange = (order: Order, newStatus: OrderStatus) => {
    if (order.order_status === newStatus) return;
    setPendingChange({ order, newStatus });
    setChangeNote("");
  };

  const confirmStatusChange = async () => {
    if (!pendingChange || changing) return;
    setChanging(true);

    const { data, error } = await supabase.rpc("admin_update_order_status", {
      p_order_id: pendingChange.order.id,
      p_new_status: pendingChange.newStatus,
      p_note: changeNote.trim() || null,
    });

    if (error) {
      console.error("[admin-orders] status change error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      toast.error("Không thể cập nhật trạng thái: " + error.message);
      setChanging(false);
      return;
    }

    // Optimistic update
    const updated = data as Order;
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
    );
    // Refresh detail if open
    if (detailOrder?.id === pendingChange.order.id) {
      void openDetail({ ...pendingChange.order, ...updated });
    }

    toast.success("Đã cập nhật trạng thái đơn hàng");
    setPendingChange(null);
    setChanging(false);
  };

  /* ─── Render ───────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Đơn hàng</h1>
        <Button variant="outline" size="sm" onClick={() => void loadOrders()} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm mã, tên, SĐT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "all" | OrderStatus)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {getStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {loadError && !loading && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
          <p className="text-destructive font-medium">Không thể tải đơn hàng</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void loadOrders()}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Table */}
      {!loadError && (
        <div className="bg-card border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Mã</th>
                <th className="p-3">Khách</th>
                <th className="p-3">SĐT</th>
                <th className="p-3">Địa chỉ</th>
                <th className="p-3">Tổng</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Ngày đặt</th>
                <th className="p-3">Cập nhật</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-muted-foreground">
                    Không có đơn hàng nào.
                  </td>
                </tr>
              ) : (
                paginated.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="p-3 font-medium">{o.customer_name}</td>
                    <td className="p-3">{o.customer_phone}</td>
                    <td className="p-3 max-w-[180px] truncate text-muted-foreground">
                      {o.shipping_address}
                    </td>
                    <td className="p-3 font-semibold">{formatVND(o.total_amount)}</td>
                    <td className="p-3">
                      <StatusDropdown order={o} onChange={requestStatusChange} />
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {o.updated_at ? new Date(o.updated_at).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="p-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void openDetail(o)}
                        title="Xem chi tiết"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !loadError && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}

      {/* Status Change Confirmation Dialog */}
      <Dialog open={!!pendingChange} onOpenChange={(open) => !open && setPendingChange(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận đổi trạng thái</DialogTitle>
          </DialogHeader>
          {pendingChange && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mã đơn:</span>
                  <span className="font-mono font-medium">#{pendingChange.order.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Trạng thái cũ:</span>
                  <StatusBadge status={pendingChange.order.order_status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Trạng thái mới:</span>
                  <StatusBadge status={pendingChange.newStatus} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú (tuỳ chọn)</Label>
                <Textarea
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="Ghi chú cho lần thay đổi này…"
                  rows={3}
                  disabled={changing}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingChange(null)} disabled={changing}>
              Hủy
            </Button>
            <Button onClick={() => void confirmStatusChange()} disabled={changing}>
              {changing && <Loader2 className="size-4 mr-2 animate-spin" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog
        open={!!detailOrder}
        onOpenChange={(open) => !open && setDetailOrder(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Chi tiết đơn hàng #{detailOrder?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : detailOrder ? (
            <div className="space-y-6">
              {/* Order info */}
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <InfoRow label="Người nhận" value={detailOrder.customer_name} />
                <InfoRow label="SĐT" value={detailOrder.customer_phone} />
                <InfoRow label="Địa chỉ giao" value={detailOrder.shipping_address} />
                <InfoRow
                  label="Tổng tiền"
                  value={<span className="font-bold text-primary">{formatVND(detailOrder.total_amount)}</span>}
                />
                <InfoRow
                  label="Trạng thái"
                  value={<StatusBadge status={detailOrder.order_status} />}
                />
                <InfoRow
                  label="Ngày đặt"
                  value={new Date(detailOrder.created_at).toLocaleString("vi-VN")}
                />
              </div>

              {/* Items */}
              {(detailOrder.items?.length ?? 0) > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Sản phẩm</h3>
                  <div className="space-y-2">
                    {detailOrder.items!.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-muted rounded-xl text-sm"
                      >
                        {item.product?.image_url && (
                          <img
                            src={item.product.image_url}
                            alt=""
                            className="size-12 object-cover rounded-lg shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {item.product?.name ?? item.product_id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatVND(item.unit_price)} × {item.quantity}
                          </div>
                        </div>
                        <div className="shrink-0 font-semibold">
                          {formatVND(item.subtotal)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status history */}
              {(detailOrder.history?.length ?? 0) > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Lịch sử trạng thái</h3>
                  <div className="space-y-2">
                    {detailOrder.history!.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-start gap-3 p-3 bg-muted rounded-xl text-sm"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {h.previous_status && (
                              <>
                                <StatusBadge status={h.previous_status} />
                                <span className="text-muted-foreground">→</span>
                              </>
                            )}
                            <StatusBadge status={h.new_status} />
                          </div>
                          {h.note && (
                            <p className="text-xs text-muted-foreground">{h.note}</p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {new Date(h.created_at).toLocaleString("vi-VN")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function StatusDropdown({
  order,
  onChange,
}: {
  order: Order;
  onChange: (order: Order, newStatus: OrderStatus) => void;
}) {
  return (
    <Select
      value={order.order_status}
      onValueChange={(v) => onChange(order, v as OrderStatus)}
    >
      <SelectTrigger className="w-44 h-8 text-xs">
        <StatusBadge status={order.order_status} />
        <ChevronDown className="size-3 ml-1 shrink-0" />
      </SelectTrigger>
      <SelectContent>
        {ALL_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <div className="flex items-center gap-2">
              <StatusBadge status={s} />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
