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
    <div className="group relative bg-card rounded-2xl overflow-hidden border hover-lift flex flex-col h-full">
      {/* 1. Clickable Image Link */}
      <Link
        to="/products/$id"
        params={{ id: product.id }}
        className="block aspect-square bg-muted overflow-hidden relative z-0"
        aria-label={`Xem chi tiết ${product.name}`}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="size-full grid place-items-center text-muted-foreground text-xs">
            No image
          </div>
        )}

        {/* Hover overlay with "Xem chi tiết" affordance */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="bg-background/90 text-foreground px-4 py-2 rounded-full text-xs font-semibold shadow-md">
            Xem chi tiết
          </span>
        </div>
      </Link>

      {/* Heart button (Favorite) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(product.id);
        }}
        className={cn(
          "absolute top-3 right-3 size-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center transition z-10 hover:scale-105 shadow-sm",
          fav ? "text-primary" : "text-foreground/60 hover:text-primary"
        )}
        aria-label="Yêu thích"
      >
        <Heart className={cn("size-4", fav && "fill-current")} />
      </button>

      {/* New badge */}
      {product.is_new && (
        <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded z-10">
          New
        </span>
      )}

      {/* Card Info content */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            {product.category}
          </div>
          {/* 2. Clickable Product Name Link */}
          <Link
            to="/products/$id"
            params={{ id: product.id }}
            className="font-semibold text-foreground line-clamp-1 hover:text-primary transition block"
          >
            {product.name}
          </Link>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between pt-1">
            <div className="font-bold text-lg">{formatVND(product.price)}</div>
            <Button
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addToCart(product.id);
              }}
              disabled={product.stock <= 0}
              className="rounded-full size-9 z-10"
            >
              <ShoppingCart className="size-4" />
            </Button>
          </div>

          {/* 3. Button asChild with Link for "Xem chi tiết" */}
          <Button asChild variant="outline" size="sm" className="w-full rounded-xl">
            <Link
              to="/products/$id"
              params={{ id: product.id }}
            >
              Xem chi tiết
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

