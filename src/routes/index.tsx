import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Truck, ShieldCheck, RefreshCw, Star } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/db-types";
import { Skeleton } from "@/components/ui/skeleton";
import { realtimeChannelName } from "@/lib/realtime";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

const categories = [
  { name: "Running", emoji: "🏃", desc: "Bứt phá tốc độ" },
  { name: "Basketball", emoji: "🏀", desc: "Thống trị sân đấu" },
  { name: "Lifestyle", emoji: "👟", desc: "Phong cách hàng ngày" },
  { name: "Training", emoji: "💪", desc: "Tập luyện đỉnh cao" },
];

const reviews = [
  { name: "Minh Anh", text: "Giày đẹp, chính hãng 100%, giao nhanh. Sẽ ủng hộ shop dài dài!", rating: 5 },
  { name: "Quang Huy", text: "Chất lượng tốt, giá hợp lý. Form chuẩn, êm chân khi chạy bộ.", rating: 5 },
  { name: "Thảo Vy", text: "Mua làm quà tặng, đóng gói cẩn thận. Bạn mình rất thích.", rating: 5 },
];

function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .limit(8);

      if (error) {
        console.error("[home-products] fetch error", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        toast.error("Không thể tải sản phẩm trang chủ: " + error.message);
      } else {
        setProducts((data as Product[]) ?? []);
      }
      setLoading(false);
    };
    load();
    const ch = supabase.channel(realtimeChannelName("home-products")).on("postgres_changes", { event: "*", schema: "public", table: "products" }, load).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);
  return { products, loading };
}

function Index() {
  const { products, loading } = useProducts();
  const { settings } = useSiteSettings();
  const featured = products.filter((p) => p.is_featured).slice(0, 4);
  const newArrivals = products.filter((p) => p.is_new).slice(0, 4);
  const bestSellers = products.filter((p) => p.is_best_seller).slice(0, 4);

  const primaryCtaHref = settings.primary_cta_href ?? "/products";
  const secondaryCtaHref = settings.secondary_cta_href ?? "/products";

  const isSafeHref = (href: string) =>
    href.startsWith("/") || href.startsWith("http://") || href.startsWith("https://");

  return (
    <UserLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground">
        <div className="container-px mx-auto max-w-7xl grid md:grid-cols-2 gap-8 items-center py-16 md:py-24">
          <div className="space-y-6 z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/20 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              {settings.hero_badge ?? "Bộ sưu tập 2025"}
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05]">
              {settings.hero_title_line_1 ?? "Ngọc Lan Store"}
              <br />
              <span className="text-primary">{settings.hero_title_highlight ?? "Giày Thể Thao"}</span>
              <br />
              {settings.hero_title_line_2 ?? "Chính Hãng"}
            </h1>
            <p className="text-lg text-secondary-foreground/70 max-w-md">
              {settings.hero_description ?? "Khám phá bộ sưu tập giày thể thao mới nhất từ các thương hiệu hàng đầu thế giới."}
            </p>
            <div className="flex gap-3">
              {isSafeHref(primaryCtaHref) && primaryCtaHref.startsWith("/") ? (
                <Link to={primaryCtaHref as "/"}>
                  <Button size="lg" className="rounded-full px-7 h-12 text-base font-semibold">
                    {settings.primary_cta_label ?? "Mua Ngay"} <ArrowRight className="size-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <a href={isSafeHref(primaryCtaHref) ? primaryCtaHref : "/products"}>
                  <Button size="lg" className="rounded-full px-7 h-12 text-base font-semibold">
                    {settings.primary_cta_label ?? "Mua Ngay"} <ArrowRight className="size-4 ml-2" />
                  </Button>
                </a>
              )}
              {isSafeHref(secondaryCtaHref) && secondaryCtaHref.startsWith("/") ? (
                <Link to={secondaryCtaHref as "/"}>
                  <Button variant="outline" size="lg" className="rounded-full px-7 h-12 text-base bg-transparent border-white/20 hover:bg-white/10">
                    {settings.secondary_cta_label ?? "Khám phá"}
                  </Button>
                </Link>
              ) : (
                <a href={isSafeHref(secondaryCtaHref) ? secondaryCtaHref : "/products"}>
                  <Button variant="outline" size="lg" className="rounded-full px-7 h-12 text-base bg-transparent border-white/20 hover:bg-white/10">
                    {settings.secondary_cta_label ?? "Khám phá"}
                  </Button>
                </a>
              )}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-10 bg-primary/20 blur-3xl rounded-full" />
            {settings.hero_image_url ? (
              <img
                src={settings.hero_image_url}
                alt="Hero"
                className="relative w-full h-auto rounded-2xl object-cover max-h-[480px]"
              />
            ) : (
              <div className="relative w-full aspect-[4/3] rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-primary/40 text-6xl font-bold">
                  {(settings.shop_name ?? "N").charAt(0)}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-background">
        <div className="container-px mx-auto max-w-7xl grid md:grid-cols-3 gap-8 py-10">
          {[
            { icon: Truck, t: settings.shipping_title ?? "Miễn phí vận chuyển", d: settings.shipping_subtitle ?? "Đơn từ 500.000đ" },
            { icon: ShieldCheck, t: settings.authenticity_title ?? "Chính hãng 100%", d: settings.authenticity_subtitle ?? "Cam kết hoàn tiền" },
            { icon: RefreshCw, t: settings.returns_title ?? "Đổi trả 30 ngày", d: settings.returns_subtitle ?? "Dễ dàng & nhanh chóng" },
          ].map((f) => (
            <div key={f.t} className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-accent text-accent-foreground grid place-items-center">
                <f.icon className="size-5" />
              </div>
              <div>
                <div className="font-semibold">{f.t}</div>
                <div className="text-sm text-muted-foreground">{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <Section title="Danh mục">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((c) => (
            <Link
              key={c.name}
              to="/products"
              search={{ category: c.name } as never}
              className="group p-6 bg-muted rounded-2xl hover-lift text-center"
            >
              <div className="text-4xl mb-2">{c.emoji}</div>
              <div className="font-bold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.desc}</div>
            </Link>
          ))}
        </div>
      </Section>

      <ProductSection title="Sản phẩm nổi bật" products={featured.length ? featured : products.slice(0, 4)} loading={loading} />
      <ProductSection title="Hàng mới về" products={newArrivals.length ? newArrivals : products.slice(0, 4)} loading={loading} />
      <ProductSection title="Bán chạy nhất" products={bestSellers.length ? bestSellers : products.slice(0, 4)} loading={loading} />

      {/* Reviews */}
      <Section title="Khách hàng nói gì">
        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <div key={r.name} className="p-6 bg-card border rounded-2xl space-y-3">
              <div className="flex gap-1 text-primary">
                {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">"{r.text}"</p>
              <div className="font-semibold text-sm pt-2 border-t">{r.name}</div>
            </div>
          ))}
        </div>
      </Section>
    </UserLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="container-px mx-auto max-w-7xl py-16">
      <h2 className="text-2xl md:text-3xl font-bold mb-8">{title}</h2>
      {children}
    </section>
  );
}

function ProductSection({ title, products, loading }: { title: string; products: Product[]; loading: boolean }) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)
          : products.length
          ? products.map((p) => <ProductCard key={p.id} product={p} />)
          : <div className="col-span-full text-center text-muted-foreground py-10">Chưa có sản phẩm.</div>}
      </div>
    </Section>
  );
}
