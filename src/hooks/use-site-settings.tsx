import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SiteSettings } from "@/lib/db-types";

// Fallback settings using the existing hardcoded storefront content
const FALLBACK: SiteSettings = {
  id: "",
  settings_key: "default",
  shop_name: "Ngọc Lan Store",
  shop_tagline: "Thời trang & Phụ kiện cao cấp",
  shop_description: "Giày thể thao chính hãng.",
  logo_url: null,
  logo_path: null,
  hero_badge: "Bộ sưu tập 2025",
  hero_title_line_1: "Ngọc Lan Store",
  hero_title_highlight: "Giày Thể Thao",
  hero_title_line_2: "Chính Hãng",
  hero_description: "Khám phá bộ sưu tập giày thể thao mới nhất từ các thương hiệu hàng đầu thế giới.",
  hero_image_url: null,
  hero_image_path: null,
  primary_cta_label: "Mua Ngay",
  primary_cta_href: "/products",
  secondary_cta_label: "Khám phá",
  secondary_cta_href: "/products",
  primary_color: "#22C55E",
  accent_color: "#F59E0B",
  shipping_title: "Miễn phí vận chuyển",
  shipping_subtitle: "Đơn từ 500.000đ",
  authenticity_title: "Chính hãng 100%",
  authenticity_subtitle: "Cam kết hoàn tiền",
  returns_title: "Đổi trả 30 ngày",
  returns_subtitle: "Dễ dàng & nhanh chóng",
  contact_phone: "1900 1234",
  contact_email: "hello@ngoclan.vn",
  contact_address: "123 Đường Lê Lợi, Q.1, TP.HCM",
  updated_by: null,
  created_at: "",
  updated_at: "",
};

interface SiteSettingsCtx {
  settings: SiteSettings;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const Ctx = createContext<SiteSettingsCtx | null>(null);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("site_settings")
      .select("*")
      .eq("settings_key", "default")
      .maybeSingle();

    if (err) {
      console.error("[site-settings] fetch error", {
        code: err.code,
        message: err.message,
        details: err.details,
        hint: err.hint,
      });
      setError(err.message);
      // Keep fallback settings — don't crash the storefront
    } else if (data) {
      setSettings(data as SiteSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("site-settings-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_settings" },
        () => void load(),
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [load]);

  return (
    <Ctx.Provider value={{ settings, loading, error, refetch: load }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSiteSettings(): SiteSettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSiteSettings must be used inside SiteSettingsProvider");
  return ctx;
}

export { FALLBACK as SITE_SETTINGS_FALLBACK };
