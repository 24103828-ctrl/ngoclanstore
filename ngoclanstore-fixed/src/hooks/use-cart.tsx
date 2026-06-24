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
import type { CartItem } from "@/lib/db-types";
import { toast } from "sonner";

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function logSupabaseError(scope: string, error: { code?: string; message: string; details?: string; hint?: string }) {
  console.error(scope, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("cart_items")
      .select("*, product:products(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logSupabaseError("[cart] fetch error", error);
      setItems([]);
    } else {
      setItems((data as CartItem[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchCart();
    if (!user) return;

    // Unique topic prevents React StrictMode/HMR or multiple mounted consumers
    // from reusing a channel that has already been subscribed.
    const channelName = `cart-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${user.id}`,
        },
        () => void fetchCart(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[cart] realtime status", { status, channelName });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, fetchCart]);

  const addToCart = useCallback(
    async (productId: string, quantity = 1) => {
      if (!user) {
        toast.error("Vui lòng đăng nhập để thêm vào giỏ");
        return;
      }

      const existing = items.find((item) => item.product_id === productId);
      const query = existing
        ? supabase
            .from("cart_items")
            .update({ quantity: existing.quantity + quantity })
            .eq("id", existing.id)
            .eq("user_id", user.id)
        : supabase
            .from("cart_items")
            .insert({ user_id: user.id, product_id: productId, quantity });

      const { error } = await query;
      if (error) {
        logSupabaseError("[cart] add error", error);
        toast.error("Không thể thêm vào giỏ hàng");
        return;
      }

      await fetchCart();
      toast.success("Đã thêm vào giỏ hàng");
    },
    [fetchCart, items, user],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!user) return;
      const previous = items;
      setItems((current) => current.filter((item) => item.id !== id));

      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        logSupabaseError("[cart] remove error", error);
        setItems(previous);
        toast.error("Không thể xóa sản phẩm khỏi giỏ");
        return;
      }
      toast.success("Đã xóa khỏi giỏ");
    },
    [items, user],
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (!user) return;
      if (quantity < 1) {
        await removeItem(id);
        return;
      }

      const previous = items;
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, quantity } : item)),
      );

      const { error } = await supabase
        .from("cart_items")
        .update({ quantity })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        logSupabaseError("[cart] update error", error);
        setItems(previous);
        toast.error("Không thể cập nhật số lượng");
      }
    },
    [items, removeItem, user],
  );

  const clearCart = useCallback(async () => {
    if (!user) return;
    const previous = items;
    setItems([]);

    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      logSupabaseError("[cart] clear error", error);
      setItems(previous);
      toast.error("Không thể xóa giỏ hàng");
    }
  }, [items, user]);

  const value = useMemo<CartContextValue>(() => {
    const total = items.reduce(
      (sum, item) => sum + (item.product?.price ?? 0) * item.quantity,
      0,
    );
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      loading,
      addToCart,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart: fetchCart,
      total,
      count,
    };
  }, [items, loading, addToCart, updateQuantity, removeItem, clearCart, fetchCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
