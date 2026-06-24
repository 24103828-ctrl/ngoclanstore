import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Favorite } from "@/lib/db-types";
import { toast } from "sonner";

interface FavoritesContextValue {
  items: Favorite[];
  loading: boolean;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function logSupabaseError(scope: string, error: { code?: string; message: string; details?: string; hint?: string }) {
  console.error(scope, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("favorites")
      .select("*, product:products(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logSupabaseError("[favorites] fetch error", error);
      setItems([]);
    } else {
      setItems((data as Favorite[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchFavorites();
    if (!user) return;

    const channelName = `favorites-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "favorites",
          filter: `user_id=eq.${user.id}`,
        },
        () => void fetchFavorites(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[favorites] realtime status", { status, channelName });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, fetchFavorites]);

  const isFavorite = useCallback(
    (productId: string) => items.some((item) => item.product_id === productId),
    [items],
  );

  const toggle = useCallback(
    async (productId: string) => {
      if (!user) {
        toast.error("Vui lòng đăng nhập");
        return;
      }

      const existing = items.find((item) => item.product_id === productId);
      const { error } = existing
        ? await supabase
            .from("favorites")
            .delete()
            .eq("id", existing.id)
            .eq("user_id", user.id)
        : await supabase
            .from("favorites")
            .insert({ user_id: user.id, product_id: productId });

      if (error) {
        logSupabaseError("[favorites] toggle error", error);
        toast.error("Không thể cập nhật sản phẩm yêu thích");
        return;
      }

      await fetchFavorites();
      toast.success(existing ? "Đã bỏ yêu thích" : "Đã thêm vào yêu thích");
    },
    [fetchFavorites, items, user],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      items,
      loading,
      isFavorite,
      toggle,
      refreshFavorites: fetchFavorites,
    }),
    [items, loading, isFavorite, toggle, fetchFavorites],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside FavoritesProvider");
  return context;
}
