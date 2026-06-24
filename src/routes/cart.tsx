import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/lib/auth-context";
import { formatVND } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, updateQuantity, removeItem, total } = useCart();
  const nav = useNavigate();

  if (authLoading) return <UserLayout><div className="py-20"><Skeleton className="h-40 max-w-3xl mx-auto" /></div></UserLayout>;

  if (!user) {
    return (
      <UserLayout>
        <div className="container-px mx-auto max-w-md py-20 text-center">
          <ShoppingBag className="size-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Đăng nhập để xem giỏ hàng</h2>
          <Button onClick={() => nav({ to: "/auth" })} className="mt-4">Đăng nhập</Button>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-5xl py-10">
        <h1 className="text-3xl font-bold mb-8">Giỏ hàng</h1>
        {loading ? (
          <Skeleton className="h-60" />
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Giỏ hàng trống</p>
            <Link to="/products"><Button>Tiếp tục mua sắm</Button></Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((it) => (
                <div key={it.id} className="flex gap-4 p-4 bg-card border rounded-2xl">
                  <div className="size-24 rounded-xl bg-muted overflow-hidden shrink-0">
                    {it.product?.image_url && <img src={it.product.image_url} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase text-muted-foreground">{it.product?.category}</div>
                    <Link to="/products/$id" params={{ id: it.product_id }} className="font-semibold hover:text-primary line-clamp-1">{it.product?.name}</Link>
                    <div className="text-primary font-bold mt-1">{formatVND(it.product?.price ?? 0)}</div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border rounded-full">
                        <Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={() => updateQuantity(it.id, it.quantity - 1)}><Minus className="size-3" /></Button>
                        <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                        <Button size="icon" variant="ghost" className="size-8 rounded-full" onClick={() => updateQuantity(it.id, it.quantity + 1)}><Plus className="size-3" /></Button>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeItem(it.id)}><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="p-6 bg-card border rounded-2xl sticky top-24 space-y-4">
                <h3 className="font-bold text-lg">Tóm tắt</h3>
                <div className="flex justify-between text-sm"><span>Tạm tính</span><span>{formatVND(total)}</span></div>
                <div className="flex justify-between text-sm"><span>Vận chuyển</span><span className="text-primary">Miễn phí</span></div>
                <div className="border-t pt-4 flex justify-between font-bold text-lg"><span>Tổng</span><span>{formatVND(total)}</span></div>
                <Button size="lg" className="w-full rounded-full" onClick={() => nav({ to: "/checkout" })}>Thanh toán</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
