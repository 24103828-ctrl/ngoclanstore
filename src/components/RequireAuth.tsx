import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const {
    user,
    sessionLoading,
    profileLoading,
    profile,
    profileError,
    profileMissing,
    isAdmin,
    refreshProfile,
    signOut,
  } = useAuth();
  const nav = useNavigate();

  // Redirect unauthenticated users to /auth once the initial session is resolved.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      const redirectPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      nav({
        to: "/auth",
        search: { redirect: redirectPath },
      });
    }
  }, [sessionLoading, user, nav]);

  // Once we know the profile, kick non-admins out of admin-only routes.
  useEffect(() => {
    if (!adminOnly) return;
    if (sessionLoading || profileLoading) return;
    if (profile && !isAdmin) nav({ to: "/" });
  }, [adminOnly, sessionLoading, profileLoading, profile, isAdmin, nav]);

  // 1) Still restoring the session — show a spinner.
  if (sessionLoading) return <FullPageSpinner />;

  // 2) Session resolved but no user — redirect effect above will take us to /auth.
  if (!user) return <FullPageSpinner />;

  // 3) Profile is loading.
  if (profileLoading) return <FullPageSpinner />;

  // 4) Profile query errored — show recoverable error instead of crashing.
  if (profileError) {
    return (
      <RecoverableState
        title="Không tải được hồ sơ"
        message={`Đã có lỗi khi tải hồ sơ của bạn.${profileError.code ? ` (${profileError.code})` : ""} ${profileError.message}`}
        onRetry={refreshProfile}
        onSignOut={signOut}
      />
    );
  }

  // 5) Profile row missing — recoverable, not a crash.
  if (profileMissing || !profile) {
    return (
      <RecoverableState
        title="Hồ sơ chưa sẵn sàng"
        message="Tài khoản của bạn vừa được tạo nhưng hồ sơ chưa khởi tạo. Vui lòng thử lại sau giây lát."
        onRetry={refreshProfile}
        onSignOut={signOut}
      />
    );
  }

  // 6) Admin gate — keep showing spinner while redirect effect runs.
  if (adminOnly && !isAdmin) return <FullPageSpinner />;

  return <>{children}</>;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen grid place-items-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}

function RecoverableState({
  title,
  message,
  onRetry,
  onSignOut,
}: {
  title: string;
  message: string;
  onRetry: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => void onRetry()}>Thử lại</Button>
          <Button variant="outline" onClick={() => void onSignOut()}>
            Đăng xuất
          </Button>
        </div>
      </div>
    </div>
  );
}
