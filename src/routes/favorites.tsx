import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { ProductCard } from "@/components/product/ProductCard";
import { useFavorites } from "@/hooks/use-favorites";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/favorites")({
  component: () => <RequireAuth><Favs /></RequireAuth>,
});

function Favs() {
  const { items, loading } = useFavorites();
  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-7xl py-10">
        <h1 className="text-3xl font-bold mb-8">Sản phẩm yêu thích</h1>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><Skeleton className="aspect-[3/4] rounded-2xl" /><Skeleton className="aspect-[3/4] rounded-2xl" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Chưa có sản phẩm yêu thích</p>
            <Link to="/products"><Button>Khám phá ngay</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {items.filter((i) => i.product).map((i) => <ProductCard key={i.id} product={i.product!} />)}
          </div>
        )}
      </div>
    </UserLayout>
  );
}
