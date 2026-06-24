import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";

import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import { CartProvider } from "@/hooks/use-cart";
import { FavoritesProvider } from "@/hooks/use-favorites";
import { SiteSettingsProvider } from "@/hooks/use-site-settings";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Không tìm thấy trang
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Trang bạn đang tìm không tồn tại hoặc đã được di chuyển.
        </p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Trang này không tải được
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Đã xảy ra lỗi. Hãy thử tải lại trang hoặc quay về trang chủ.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              void router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Thử lại
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SiteSettingsProvider>
          <CartProvider>
            <FavoritesProvider>
              <Outlet />
              <ChatbotWidget />
              <Toaster position="top-right" richColors />
            </FavoritesProvider>
          </CartProvider>
        </SiteSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
