import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Package, ShoppingBag, Users, MessageSquare, Home, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products", label: "Sản phẩm", icon: Package },
  { to: "/admin/orders", label: "Đơn hàng", icon: ShoppingBag },
  { to: "/admin/users", label: "Người dùng", icon: Users },
  { to: "/admin/chats", label: "Chatbot", icon: MessageSquare },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="hidden md:flex w-64 flex-col border-r bg-background">
        <div className="h-16 flex items-center gap-2 px-6 border-b">
          <div className="size-9 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">N</div>
          <span className="font-bold">Admin Panel</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((it) => {
            const active = loc.pathname === it.to || (it.to !== "/admin" && loc.pathname.startsWith(it.to));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <it.icon className="size-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted">
            <Home className="size-4" /> Về trang chính
          </Link>
          <button onClick={() => signOut().then(() => nav({ to: "/" }))} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted">
            <LogOut className="size-4" /> Đăng xuất
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="md:hidden h-14 border-b bg-background flex items-center px-4 gap-2">
          <Link to="/" className="font-bold">Ngọc Lan Admin</Link>
        </header>
        <div className="md:hidden border-b bg-background overflow-x-auto">
          <div className="flex gap-1 p-2">
            {items.map((it) => {
              const active = loc.pathname === it.to || (it.to !== "/admin" && loc.pathname.startsWith(it.to));
              return (
                <Link key={it.to} to={it.to} className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
        <div className="md:hidden p-3 border-t bg-background">
          <Button variant="outline" className="w-full" onClick={() => signOut().then(() => nav({ to: "/" }))}>
            <LogOut className="size-4 mr-2" /> Đăng xuất
          </Button>
        </div>
      </div>
    </div>
  );
}
