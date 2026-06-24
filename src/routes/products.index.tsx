import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { ProductCard } from "@/components/product/ProductCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Product } from "@/lib/db-types";
import { realtimeChannelName } from "@/lib/realtime";

interface Search { category?: string }

export const Route = createFileRoute("/products/")({
  validateSearch: (s: Record<string, unknown>): Search => ({ category: typeof s.category === "string" ? s.category : undefined }),
  component: ProductsPage,
});

const PAGE_SIZE = 12;
const categories = ["All", "Running", "Basketball", "Lifestyle", "Training"];

function ProductsPage() {
  const { category } = Route.useSearch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(category ?? "All");
  const [sort, setSort] = useState<"new" | "price_asc" | "price_desc">("new");
  const [page, setPage] = useState(1);

  useEffect(() => { if (category) setCat(category); }, [category]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);

      if (error) {
        console.error("[products] fetch error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        toast.error("Không thể tải danh sách sản phẩm: " + error.message);
      } else {
        setProducts((data as Product[]) ?? []);
      }
      setLoading(false);
    };
    load();
    const ch = supabase.channel(realtimeChannelName("products-list")).on("postgres_changes", { event: "*", schema: "public", table: "products" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let arr = [...products];
    if (cat !== "All") arr = arr.filter((p) => p.category === cat);
    if (q.trim()) arr = arr.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (sort === "price_asc") arr.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") arr.sort((a, b) => b.price - a.price);
    else arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return arr;
  }, [products, cat, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [cat, q, sort]);

  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-7xl py-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Sản phẩm</h1>
        <p className="text-muted-foreground mb-8">{filtered.length} sản phẩm</p>

        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm sản phẩm..." className="pl-10 h-11" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-full md:w-48 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-full md:w-48 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Mới nhất</SelectItem>
              <SelectItem value="price_asc">Giá thấp → cao</SelectItem>
              <SelectItem value="price_desc">Giá cao → thấp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)
            : paged.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-20">Không tìm thấy sản phẩm nào.</div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Trước</Button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button key={i} variant={page === i + 1 ? "default" : "outline"} onClick={() => setPage(i + 1)}>{i + 1}</Button>
            ))}
            <Button variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Sau</Button>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
