import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, ShoppingCart, Minus, Plus, Loader2, ArrowLeft, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/db-types";
import { formatVND } from "@/lib/format";
import { useFavorites } from "@/hooks/use-favorites";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<{ code?: string; message: string; details?: string; hint?: string } | null>(null);
  const [qty, setQty] = useState(1);
  const { isFavorite, toggle } = useFavorites();
  const { addToCart } = useCart();

  const handleBuyNow = () => {
    if (!product) return;
    if (qty <= 0 || product.stock <= 0) {
      toast.error("Sản phẩm đã hết hàng hoặc số lượng không hợp lệ.");
      return;
    }
    if (qty > product.stock) {
      toast.error(`Chỉ có thể mua tối đa ${product.stock} sản phẩm.`);
      return;
    }

    const buyNowUrl = `/checkout?mode=buy-now&productId=${product.id}&quantity=${qty}`;

    if (user) {
      nav({ to: buyNowUrl });
    } else {
      nav({
        to: "/auth",
        search: { redirect: buyNowUrl },
      });
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setQueryError(null);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("[product-detail] fetch error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setQueryError(error);
        setProduct(null);
      } else {
        const prod = data as Product | null;
        setProduct(prod);
        if (prod) {
          setQty(prod.stock > 0 ? 1 : 0);
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <UserLayout>
        <div className="min-h-[60vh] grid place-items-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </UserLayout>
    );
  }

  if (queryError) {
    return (
      <UserLayout>
        <div className="container-px mx-auto max-w-7xl py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Lỗi tải sản phẩm</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {queryError.message}
            {queryError.code ? ` (Mã lỗi: ${queryError.code})` : ""}
          </p>
          <Link to="/products">
            <Button className="mt-4">Quay lại danh sách</Button>
          </Link>
        </div>
      </UserLayout>
    );
  }

  if (!product) {
    return (
      <UserLayout>
        <div className="container-px mx-auto max-w-7xl py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-muted-foreground">Không tìm thấy sản phẩm</h1>
          <p className="text-muted-foreground">Sản phẩm này không tồn tại hoặc đã bị xóa.</p>
          <Link to="/products">
            <Button className="mt-4">Quay lại danh sách</Button>
          </Link>
        </div>
      </UserLayout>
    );
  }


  const fav = isFavorite(product.id);

  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-7xl py-8">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="size-4" /> Tất cả sản phẩm
        </Link>
        <div className="grid md:grid-cols-2 gap-10">
          <div className="aspect-square bg-muted rounded-2xl overflow-hidden">
            {product.image_url ? <img src={product.image_url} alt={product.name} className="size-full object-cover" /> : null}
          </div>
          <div className="space-y-6">
            <div>
              <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">{product.category}</div>
              <h1 className="text-3xl md:text-4xl font-bold">{product.name}</h1>
              <div className="text-3xl font-bold text-primary mt-4">{formatVND(product.price)}</div>
            </div>
            <p className="text-foreground/80 leading-relaxed">
              {product.description && product.description.trim() !== ""
                ? product.description
                : "Sản phẩm hiện chưa có mô tả chi tiết."}
            </p>
            <div className="space-y-2">
              <div className="text-sm">
                Tình trạng:{" "}
                <span
                  className={cn(
                    "font-semibold px-2.5 py-1 rounded-full text-xs",
                    product.stock > 0
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {product.stock > 0 ? "Còn hàng" : "Hết hàng"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Còn lại: <span className={cn("font-semibold", product.stock > 0 ? "text-foreground" : "text-destructive")}>{product.stock} sản phẩm</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Số lượng mua:</span>
              <div className="flex items-center border rounded-full">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  disabled={qty <= 1 || product.stock <= 0}
                  onClick={() => setQty(Math.max(1, qty - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-10 text-center font-semibold">{qty}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  disabled={qty >= product.stock || product.stock <= 0}
                  onClick={() => setQty(Math.min(product.stock, qty + 1))}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap md:flex-nowrap">
              <Button
                size="lg"
                className="flex-1 rounded-full h-12"
                disabled={product.stock <= 0}
                onClick={handleBuyNow}
              >
                Mua ngay
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 rounded-full h-12"
                disabled={product.stock <= 0}
                onClick={() => addToCart(product.id, qty)}
              >
                <ShoppingCart className="size-4 mr-2" />
                {product.stock <= 0 ? "Hết hàng" : "Thêm vào giỏ"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={cn("rounded-full size-12 p-0 shrink-0", fav && "border-primary text-primary")}
                onClick={() => toggle(product.id)}
              >
                <Heart className={cn("size-5", fav && "fill-current")} />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-6 border-t">
              {[{ i: Truck, t: "Miễn phí ship" }, { i: ShieldCheck, t: "Chính hãng" }, { i: RefreshCw, t: "Đổi 30 ngày" }].map((f) => (
                <div key={f.t} className="text-center">
                  <f.i className="size-5 mx-auto text-primary mb-1" />
                  <div className="text-xs text-muted-foreground">{f.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}

