import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/db-types";
import { formatVND } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { isFavorite, toggle } = useFavorites();
  const { addToCart } = useCart();
  const fav = isFavorite(product.id);
  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden border hover-lift">
      <Link to="/products/$id" params={{ id: product.id }} className="block">
        <div className="aspect-square bg-muted overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="size-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="size-full grid place-items-center text-muted-foreground text-xs">No image</div>
          )}
        </div>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); toggle(product.id); }}
        className={cn(
          "absolute top-3 right-3 size-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center transition",
          fav ? "text-primary" : "text-foreground/60 hover:text-primary",
        )}
        aria-label="Yêu thích"
      >
        <Heart className={cn("size-4", fav && "fill-current")} />
      </button>
      {product.is_new && (
        <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">New</span>
      )}
      <div className="p-4 space-y-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{product.category}</div>
        <Link to="/products/$id" params={{ id: product.id }} className="font-semibold text-foreground line-clamp-1 hover:text-primary transition">
          {product.name}
        </Link>
        <div className="flex items-center justify-between pt-1">
          <div className="font-bold text-lg">{formatVND(product.price)}</div>
          <Button
            size="icon"
            onClick={(e) => { e.preventDefault(); addToCart(product.id); }}
            disabled={product.stock <= 0}
            className="rounded-full size-9"
          >
            <ShoppingCart className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
