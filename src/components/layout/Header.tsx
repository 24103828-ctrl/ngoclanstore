import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Heart, User, Menu, LogOut, Shield, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/hooks/use-cart";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  { to: "/", label: "Trang chủ" },
  { to: "/products", label: "Sản phẩm" },
  { to: "/favorites", label: "Yêu thích" },
  { to: "/chatbot", label: "Hỗ trợ" },
];

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-lg">
      <div className="container-px mx-auto flex h-16 items-center justify-between gap-4 max-w-7xl">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="size-9 rounded-full object-cover" />
            ) : (
              <div className="size-9 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                {(settings.shop_name ?? "N").charAt(0)}
              </div>
            )}
            <span className="font-bold text-lg tracking-tight hidden sm:inline">
              {settings.shop_name ?? "Ngọc Lan"}
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
                activeProps={{ className: "text-primary" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/products" })}
            className="hidden sm:inline-flex"
          >
            <Search className="size-5" />
          </Button>
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="size-5" />
            </Button>
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 size-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          <Link to="/favorites" className="hidden sm:inline-flex">
            <Button variant="ghost" size="icon">
              <Heart className="size-5" />
            </Button>
          </Link>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm">
                  <div className="font-medium truncate">{profile?.full_name ?? user.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  <User className="size-4 mr-2" /> Tài khoản
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    <Shield className="size-4 mr-2" /> Quản trị
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut().then(() => navigate({ to: "/" }))}>
                  <LogOut className="size-4 mr-2" /> Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => navigate({ to: "/auth" })} size="sm" className="ml-2">
              Đăng nhập
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <nav className="flex flex-col gap-1 mt-8">
                {nav.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="px-4 py-3 text-base font-medium rounded-md hover:bg-muted"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
