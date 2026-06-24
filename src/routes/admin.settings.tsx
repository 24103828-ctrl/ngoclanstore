import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, RotateCcw, Save, Eye, EyeOff, Truck, ShieldCheck, RefreshCw } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { supabase } from "@/integrations/supabase/client";
import type { SiteSettings } from "@/lib/db-types";
import { SITE_SETTINGS_FALLBACK } from "@/hooks/use-site-settings";
import {
  uploadFile,
  removeFile,
  siteAssetPath,
  validateCtaLink,
  validateHexColor,
} from "@/lib/storage-upload";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <RequireAuth adminOnly>
      <AdminLayout>
        <SettingsAdmin />
      </AdminLayout>
    </RequireAuth>
  ),
});

type SettingsForm = Omit<SiteSettings, "id" | "created_at" | "updated_at" | "updated_by">;

function makeForm(s: SiteSettings): SettingsForm {
  return {
    settings_key: s.settings_key,
    shop_name: s.shop_name,
    shop_tagline: s.shop_tagline,
    shop_description: s.shop_description,
    logo_url: s.logo_url,
    logo_path: s.logo_path,
    hero_badge: s.hero_badge,
    hero_title_line_1: s.hero_title_line_1,
    hero_title_highlight: s.hero_title_highlight,
    hero_title_line_2: s.hero_title_line_2,
    hero_description: s.hero_description,
    hero_image_url: s.hero_image_url,
    hero_image_path: s.hero_image_path,
    primary_cta_label: s.primary_cta_label,
    primary_cta_href: s.primary_cta_href,
    secondary_cta_label: s.secondary_cta_label,
    secondary_cta_href: s.secondary_cta_href,
    primary_color: s.primary_color,
    accent_color: s.accent_color,
    shipping_title: s.shipping_title,
    shipping_subtitle: s.shipping_subtitle,
    authenticity_title: s.authenticity_title,
    authenticity_subtitle: s.authenticity_subtitle,
    returns_title: s.returns_title,
    returns_subtitle: s.returns_subtitle,
    contact_phone: s.contact_phone,
    contact_email: s.contact_email,
    contact_address: s.contact_address,
  };
}

function SettingsAdmin() {
  const [dbSettings, setDbSettings] = useState<SiteSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>(makeForm(SITE_SETTINGS_FALLBACK));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Pending image files (not yet uploaded)
  const [logoPendingFile, setLogoPendingFile] = useState<File | null>(null);
  const [heroPendingFile, setHeroPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("settings_key", "default")
      .maybeSingle();

    if (error) {
      console.error("[admin-settings] load error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      setLoadError(error.message);
    } else if (data) {
      const s = data as SiteSettings;
      setDbSettings(s);
      setForm(makeForm(s));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const restoreFromDb = () => {
    if (dbSettings) {
      setForm(makeForm(dbSettings));
      setLogoPendingFile(null);
      setHeroPendingFile(null);
      toast.success("Đã khôi phục nội dung từ cơ sở dữ liệu.");
    }
  };

  /* ─── Validate ─────────────────────────────────────────── */

  const validate = (): string | null => {
    if (!form.shop_name?.trim()) return "Tên cửa hàng không được để trống.";
    if (form.primary_color && !validateHexColor(form.primary_color))
      return "Màu chính không hợp lệ (phải là #RRGGBB).";
    if (form.accent_color && !validateHexColor(form.accent_color))
      return "Màu nhấn không hợp lệ (phải là #RRGGBB).";
    if (form.primary_cta_href && !validateCtaLink(form.primary_cta_href))
      return "Liên kết nút chính không hợp lệ (chỉ cho phép đường dẫn nội bộ hoặc https://).";
    if (form.secondary_cta_href && !validateCtaLink(form.secondary_cta_href))
      return "Liên kết nút phụ không hợp lệ (chỉ cho phép đường dẫn nội bộ hoặc https://).";
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email))
      return "Địa chỉ email không hợp lệ.";
    return null;
  };

  /* ─── Save ─────────────────────────────────────────────── */

  const saveSettings = async () => {
    if (saving || uploading) return;

    const validationError = validate();
    if (validationError) { toast.error(validationError); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."); return; }

    setSaving(true);

    let logoUrl = form.logo_url;
    let logoPath = form.logo_path;
    let heroUrl = form.hero_image_url;
    let heroPath = form.hero_image_path;

    const prevLogoPath = dbSettings?.logo_path ?? null;
    const prevHeroPath = dbSettings?.hero_image_path ?? null;

    let newLogoPath: string | null = null;
    let newHeroPath: string | null = null;

    try {
      // ── Upload logo ──────────────────────────────────────
      if (logoPendingFile) {
        setUploading(true);
        const path = siteAssetPath("logo", logoPendingFile);
        const result = await uploadFile("site-assets", path, logoPendingFile);
        newLogoPath = result.path;
        logoUrl = result.publicUrl;
        logoPath = result.path;
        setUploading(false);
      }

      // ── Upload hero image ────────────────────────────────
      if (heroPendingFile) {
        setUploading(true);
        const path = siteAssetPath("hero", heroPendingFile);
        const result = await uploadFile("site-assets", path, heroPendingFile);
        newHeroPath = result.path;
        heroUrl = result.publicUrl;
        heroPath = result.path;
        setUploading(false);
      }
    } catch (err: unknown) {
      setUploading(false);
      setSaving(false);
      // Rollback any uploads already done
      if (newLogoPath) await removeFile("site-assets", newLogoPath);
      if (newHeroPath) await removeFile("site-assets", newHeroPath);
      toast.error(err instanceof Error ? err.message : "Không thể tải tài sản lên.");
      return;
    }

    const payload = {
      ...form,
      logo_url: logoUrl,
      logo_path: logoPath,
      hero_image_url: heroUrl,
      hero_image_path: heroPath,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("site_settings")
      .upsert(payload, { onConflict: "settings_key" });

    if (error) {
      console.error("[admin-settings] save error", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      // Rollback uploads
      if (newLogoPath) await removeFile("site-assets", newLogoPath);
      if (newHeroPath) await removeFile("site-assets", newHeroPath);
      toast.error("Không thể lưu cài đặt: " + error.message);
      setSaving(false);
      return;
    }

    // Remove old images AFTER DB update succeeds
    if (newLogoPath && prevLogoPath && prevLogoPath !== newLogoPath)
      await removeFile("site-assets", prevLogoPath);
    if (newHeroPath && prevHeroPath && prevHeroPath !== newHeroPath)
      await removeFile("site-assets", prevHeroPath);

    toast.success("Đã lưu cài đặt giao diện thành công!");
    setLogoPendingFile(null);
    setHeroPendingFile(null);
    void loadSettings();
    setSaving(false);
  };

  /* ─── Render ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 text-center py-20">
        <p className="text-destructive font-medium">Không thể tải cài đặt</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => void loadSettings()}>
          Thử lại
        </Button>
      </div>
    );
  }

  const busy = saving || uploading;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Giao diện cửa hàng</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
            {showPreview ? "Ẩn xem trước" : "Xem trước"}
          </Button>
          <Button variant="outline" size="sm" onClick={restoreFromDb} disabled={busy}>
            <RotateCcw className="size-4 mr-2" /> Khôi phục
          </Button>
          <Button onClick={() => void saveSettings()} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {uploading ? "Đang tải ảnh…" : saving ? "Đang lưu…" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      <div className={showPreview ? "grid lg:grid-cols-2 gap-8" : ""}>
        {/* ── Form ── */}
        <div className="space-y-8">

          {/* Section 1: Thương hiệu */}
          <SettingsSection title="Thương hiệu">
            <Field label="Tên cửa hàng *">
              <Input
                value={form.shop_name ?? ""}
                maxLength={80}
                onChange={(e) => set("shop_name", e.target.value)}
              />
            </Field>
            <Field label="Khẩu hiệu ngắn">
              <Input
                value={form.shop_tagline ?? ""}
                maxLength={120}
                onChange={(e) => set("shop_tagline", e.target.value)}
              />
            </Field>
            <Field label="Mô tả cửa hàng">
              <Textarea
                value={form.shop_description ?? ""}
                maxLength={500}
                rows={3}
                onChange={(e) => set("shop_description", e.target.value)}
              />
            </Field>
            <Field label="Logo">
              <ImageUploader
                currentUrl={form.logo_url}
                onFileSelect={setLogoPendingFile}
                uploading={uploading && !!logoPendingFile}
                aspectHint="Khuyến nghị hình vuông (1:1)"
              />
            </Field>
          </SettingsSection>

          {/* Section 2: Hero */}
          <SettingsSection title="Banner chính (Hero)">
            <Field label="Nhãn nhỏ">
              <Input
                value={form.hero_badge ?? ""}
                maxLength={60}
                onChange={(e) => set("hero_badge", e.target.value)}
              />
            </Field>
            <Field label="Tiêu đề dòng 1">
              <Input
                value={form.hero_title_line_1 ?? ""}
                maxLength={80}
                onChange={(e) => set("hero_title_line_1", e.target.value)}
              />
            </Field>
            <Field label="Tiêu đề nổi bật">
              <Input
                value={form.hero_title_highlight ?? ""}
                maxLength={80}
                onChange={(e) => set("hero_title_highlight", e.target.value)}
              />
            </Field>
            <Field label="Tiêu đề dòng 2">
              <Input
                value={form.hero_title_line_2 ?? ""}
                maxLength={80}
                onChange={(e) => set("hero_title_line_2", e.target.value)}
              />
            </Field>
            <Field label="Mô tả hero">
              <Textarea
                value={form.hero_description ?? ""}
                maxLength={300}
                rows={3}
                onChange={(e) => set("hero_description", e.target.value)}
              />
            </Field>
            <Field label="Ảnh bìa hero">
              <ImageUploader
                currentUrl={form.hero_image_url}
                onFileSelect={setHeroPendingFile}
                uploading={uploading && !!heroPendingFile}
                aspectHint="Khuyến nghị 16:9 hoặc 4:3"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nhãn nút chính">
                <Input
                  value={form.primary_cta_label ?? ""}
                  maxLength={40}
                  onChange={(e) => set("primary_cta_label", e.target.value)}
                />
              </Field>
              <Field label="Liên kết nút chính">
                <Input
                  value={form.primary_cta_href ?? ""}
                  placeholder="/products hoặc https://…"
                  onChange={(e) => set("primary_cta_href", e.target.value)}
                />
              </Field>
              <Field label="Nhãn nút phụ">
                <Input
                  value={form.secondary_cta_label ?? ""}
                  maxLength={40}
                  onChange={(e) => set("secondary_cta_label", e.target.value)}
                />
              </Field>
              <Field label="Liên kết nút phụ">
                <Input
                  value={form.secondary_cta_href ?? ""}
                  placeholder="/products hoặc https://…"
                  onChange={(e) => set("secondary_cta_href", e.target.value)}
                />
              </Field>
            </div>
          </SettingsSection>

          {/* Section 3: Cam kết */}
          <SettingsSection title="Cam kết dịch vụ">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tiêu đề vận chuyển">
                <Input value={form.shipping_title ?? ""} maxLength={60} onChange={(e) => set("shipping_title", e.target.value)} />
              </Field>
              <Field label="Mô tả vận chuyển">
                <Input value={form.shipping_subtitle ?? ""} maxLength={100} onChange={(e) => set("shipping_subtitle", e.target.value)} />
              </Field>
              <Field label="Tiêu đề chính hãng">
                <Input value={form.authenticity_title ?? ""} maxLength={60} onChange={(e) => set("authenticity_title", e.target.value)} />
              </Field>
              <Field label="Mô tả chính hãng">
                <Input value={form.authenticity_subtitle ?? ""} maxLength={100} onChange={(e) => set("authenticity_subtitle", e.target.value)} />
              </Field>
              <Field label="Tiêu đề đổi trả">
                <Input value={form.returns_title ?? ""} maxLength={60} onChange={(e) => set("returns_title", e.target.value)} />
              </Field>
              <Field label="Mô tả đổi trả">
                <Input value={form.returns_subtitle ?? ""} maxLength={100} onChange={(e) => set("returns_subtitle", e.target.value)} />
              </Field>
            </div>
          </SettingsSection>

          {/* Section 4: Màu */}
          <SettingsSection title="Màu giao diện">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Màu chính (#RRGGBB)">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.primary_color ?? "#22C55E"}
                    onChange={(e) => set("primary_color", e.target.value)}
                    className="h-10 w-12 rounded border cursor-pointer shrink-0"
                  />
                  <Input
                    value={form.primary_color ?? ""}
                    placeholder="#22C55E"
                    maxLength={7}
                    onChange={(e) => set("primary_color", e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Màu nhấn (#RRGGBB)">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.accent_color ?? "#F59E0B"}
                    onChange={(e) => set("accent_color", e.target.value)}
                    className="h-10 w-12 rounded border cursor-pointer shrink-0"
                  />
                  <Input
                    value={form.accent_color ?? ""}
                    placeholder="#F59E0B"
                    maxLength={7}
                    onChange={(e) => set("accent_color", e.target.value)}
                  />
                </div>
              </Field>
            </div>
          </SettingsSection>

          {/* Section 5: Liên hệ */}
          <SettingsSection title="Thông tin liên hệ">
            <Field label="Điện thoại">
              <Input value={form.contact_phone ?? ""} maxLength={30} onChange={(e) => set("contact_phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.contact_email ?? ""} maxLength={120} onChange={(e) => set("contact_email", e.target.value)} />
            </Field>
            <Field label="Địa chỉ">
              <Textarea value={form.contact_address ?? ""} maxLength={300} rows={2} onChange={(e) => set("contact_address", e.target.value)} />
            </Field>
          </SettingsSection>
        </div>

        {/* ── Preview ── */}
        {showPreview && <HeroPreview form={form} />}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 bg-card border rounded-2xl space-y-4">
      <h2 className="font-semibold text-base border-b pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function HeroPreview({ form }: { form: SettingsForm }) {
  const primaryColor = form.primary_color ?? "#22C55E";
  const accentColor = form.accent_color ?? "#F59E0B";

  return (
    <div className="space-y-4 sticky top-20">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Xem trước</p>
      <div
        className="rounded-2xl overflow-hidden border shadow-lg"
        style={{ background: `color-mix(in srgb, ${primaryColor} 8%, #1a1a2e)` }}
      >
        {/* Mini hero */}
        <div className="p-6 space-y-3 text-white">
          {form.hero_badge && (
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: `${primaryColor}33`, color: primaryColor }}
            >
              {form.hero_badge}
            </span>
          )}
          <div className="text-2xl font-bold leading-tight">
            <div>{form.hero_title_line_1}</div>
            <div style={{ color: primaryColor }}>{form.hero_title_highlight}</div>
            <div>{form.hero_title_line_2}</div>
          </div>
          {form.hero_description && (
            <p className="text-sm opacity-70 max-w-xs">{form.hero_description}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {form.primary_cta_label && (
              <span
                className="px-4 py-2 rounded-full text-sm font-semibold text-white"
                style={{ background: primaryColor }}
              >
                {form.primary_cta_label}
              </span>
            )}
            {form.secondary_cta_label && (
              <span className="px-4 py-2 rounded-full text-sm font-semibold border border-white/30">
                {form.secondary_cta_label}
              </span>
            )}
          </div>
        </div>
        {form.hero_image_url && (
          <img
            src={form.hero_image_url}
            alt="Hero preview"
            className="w-full h-32 object-cover"
          />
        )}
        {/* Trust strip */}
        <div className="grid grid-cols-3 divide-x bg-black/20 text-white text-xs">
          {[
            { icon: Truck, t: form.shipping_title, d: form.shipping_subtitle },
            { icon: ShieldCheck, t: form.authenticity_title, d: form.authenticity_subtitle },
            { icon: RefreshCw, t: form.returns_title, d: form.returns_subtitle },
          ].map((f, i) => (
            <div key={i} className="p-3 text-center">
              <f.icon className="size-4 mx-auto mb-1" style={{ color: accentColor }} />
              <div className="font-semibold leading-tight">{f.t}</div>
              <div className="opacity-60 text-[10px]">{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shop identity preview */}
      <div className="p-4 border rounded-xl flex items-center gap-3">
        {form.logo_url ? (
          <img src={form.logo_url} alt="Logo" className="size-10 rounded-full object-cover" />
        ) : (
          <div
            className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: primaryColor }}
          >
            {(form.shop_name ?? "N").charAt(0)}
          </div>
        )}
        <div>
          <div className="font-bold">{form.shop_name}</div>
          {form.shop_tagline && (
            <div className="text-xs text-muted-foreground">{form.shop_tagline}</div>
          )}
        </div>
      </div>
    </div>
  );
}
