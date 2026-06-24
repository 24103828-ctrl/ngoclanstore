import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, ShoppingCart, Minus, Plus, Loader2, ArrowLeft, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/db-types";
import { formatVND } from "@/lib/format";
import { useFavorites } from "@/hooks/use-favorites";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const { isFavorite, toggle } = useFavorites();
  const { addToCart } = useCart();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      setProduct((data as Product | null) ?? null);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return <UserLayout><div className="min-h-[60vh] grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div></UserLayout>;
  }
  if (!product) {
    return (
      <UserLayout>
        <div className="container-px mx-auto max-w-7xl py-20 text-center">
          <p className="text-muted-foreground">Không tìm thấy sản phẩm.</p>
          <Link to="/products"><Button className="mt-4">Quay lại</Button></Link>
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
            <p className="text-foreground/80 leading-relaxed">{product.description}</p>
            <div className="text-sm">
              Còn lại: <span className={cn("font-semibold", product.stock > 0 ? "text-primary" : "text-destructive")}>{product.stock}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-full">
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="size-4" /></Button>
                <span className="w-10 text-center font-semibold">{qty}</span>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty(Math.min(product.stock, qty + 1))}><Plus className="size-4" /></Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 rounded-full h-12"
                disabled={product.stock <= 0}
                onClick={() => addToCart(product.id, qty)}
              >
                <ShoppingCart className="size-4 mr-2" /> Thêm vào giỏ
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={cn("rounded-full size-12 p-0", fav && "border-primary text-primary")}
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
