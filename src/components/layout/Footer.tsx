import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Mail, MapPin, Phone } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";

export function Footer() {
  const { settings } = useSiteSettings();

  return (
    <footer className="border-t bg-secondary text-secondary-foreground mt-24">
      <div className="container-px mx-auto max-w-7xl py-16 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-4">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="size-9 rounded-full object-cover" />
            ) : (
              <div className="size-9 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                {(settings.shop_name ?? "N").charAt(0)}
              </div>
            )}
            <span className="font-bold text-lg">{settings.shop_name ?? "Ngọc Lan Store"}</span>
          </div>
          <p className="text-sm text-secondary-foreground/70 leading-relaxed">
            {settings.shop_description ?? "Giày thể thao chính hãng. Cảm hứng từ những bước chạy không giới hạn."}
          </p>
          <div className="flex gap-3 mt-5">
            <a href="#" className="size-9 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition"><Facebook className="size-4" /></a>
            <a href="#" className="size-9 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition"><Instagram className="size-4" /></a>
            <a href="#" className="size-9 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition"><Twitter className="size-4" /></a>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Cửa hàng</h4>
          <ul className="space-y-2 text-sm text-secondary-foreground/70">
            <li><Link to="/products" className="hover:text-primary">Tất cả sản phẩm</Link></li>
            <li><Link to="/products" search={{ category: "Running" } as never} className="hover:text-primary">Running</Link></li>
            <li><Link to="/products" search={{ category: "Basketball" } as never} className="hover:text-primary">Basketball</Link></li>
            <li><Link to="/products" search={{ category: "Lifestyle" } as never} className="hover:text-primary">Lifestyle</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Hỗ trợ</h4>
          <ul className="space-y-2 text-sm text-secondary-foreground/70">
            <li><Link to="/chatbot" className="hover:text-primary">Chatbot AI</Link></li>
            <li><a className="hover:text-primary" href="#">Chính sách đổi trả</a></li>
            <li><a className="hover:text-primary" href="#">Hướng dẫn chọn size</a></li>
            <li><a className="hover:text-primary" href="#">Vận chuyển</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Liên hệ</h4>
          <ul className="space-y-3 text-sm text-secondary-foreground/70">
            {(settings.contact_address ?? "123 Đường Lê Lợi, Q.1, TP.HCM") && (
              <li className="flex gap-2">
                <MapPin className="size-4 mt-0.5 shrink-0 text-primary" />
                {settings.contact_address ?? "123 Đường Lê Lợi, Q.1, TP.HCM"}
              </li>
            )}
            {(settings.contact_phone ?? "1900 1234") && (
              <li className="flex gap-2">
                <Phone className="size-4 mt-0.5 shrink-0 text-primary" />
                {settings.contact_phone ?? "1900 1234"}
              </li>
            )}
            {(settings.contact_email ?? "hello@ngoclan.vn") && (
              <li className="flex gap-2">
                <Mail className="size-4 mt-0.5 shrink-0 text-primary" />
                {settings.contact_email ?? "hello@ngoclan.vn"}
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-secondary-foreground/60">
        © {new Date().getFullYear()} {settings.shop_name ?? "Ngọc Lan Store"}. All rights reserved.
      </div>
    </footer>
  );
}
