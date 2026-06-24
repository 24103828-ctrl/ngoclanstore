import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface AuthSearch {
  redirect?: string;
}

const isSafeRedirect = (path: string | undefined): boolean => {
  if (!path) return false;
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("\\");
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const { redirect } = Route.useSearch();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (isSafeRedirect(redirect)) {
        nav({ to: redirect });
      } else {
        nav({ to: "/" });
      }
    }
  }, [authLoading, user, nav, redirect]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Đăng nhập thành công");
      if (isSafeRedirect(redirect)) {
        nav({ to: redirect });
      } else {
        nav({ to: "/" });
      }
    }
  };

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: name },
      },
    });

    setBusy(false);

    if (error) {
      console.error("[auth] signUp error", {
        code: (error as { code?: string }).code,
        message: error.message,
      });
      toast.error(error.message);
      return;
    }

    // public.users is created by the Supabase auth trigger. Avoid a second
    // frontend upsert, which can race the trigger or be blocked by RLS.
    if (data.session) {
      toast.success("Đăng ký thành công!");
      if (isSafeRedirect(redirect)) {
        nav({ to: redirect });
      } else {
        nav({ to: "/" });
      }
    } else {
      toast.success("Đăng ký thành công. Vui lòng kiểm tra email xác nhận.");
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex bg-secondary text-secondary-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-full bg-primary grid place-items-center font-bold text-primary-foreground">N</div>
          <span className="font-bold text-xl">Ngọc Lan Store</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Bước chạy của bạn,<br /><span className="text-primary">bắt đầu từ đây.</span></h2>
          <p className="mt-4 text-secondary-foreground/70 max-w-sm">Tham gia cộng đồng những người yêu thể thao và sở hữu đôi giày chính hãng.</p>
        </div>
        <div className="text-sm text-secondary-foreground/50">© Ngọc Lan Store</div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Chào mừng</h1>
            <p className="text-muted-foreground mt-1">Đăng nhập hoặc tạo tài khoản mới</p>
          </div>
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Đăng ký</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6">
              <form onSubmit={login} className="space-y-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Mật khẩu</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full h-11" disabled={busy}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Đăng nhập</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={signup} className="space-y-4">
                <div className="space-y-2"><Label>Họ tên</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Mật khẩu</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full h-11" disabled={busy}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Tạo tài khoản</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
