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

    const channelName = `cart-${user.id}`;
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

      // Fetch the product first to get latest stock info
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        logSupabaseError("[cart] fetch product stock error", productError || new Error("Product not found"));
        toast.error("Không thể lấy thông tin sản phẩm");
        return;
      }

      if (product.stock <= 0) {
        toast.error("Sản phẩm đã hết hàng");
        return;
      }

      const existing = items.find((item) => item.product_id === productId);
      let targetQuantity = existing ? existing.quantity + quantity : quantity;

      if (targetQuantity < 1) {
        targetQuantity = 1;
      }
      if (targetQuantity > product.stock) {
        targetQuantity = product.stock;
        toast.warning(`Chỉ có thể thêm tối đa ${product.stock} sản phẩm (đã giới hạn theo kho hàng)`);
      }

      let mutatedItem: CartItem | null = null;
      let mutationError: any = null;

      if (existing) {
        // Update quantity of existing item
        const { data, error } = await supabase
          .from("cart_items")
          .update({ quantity: targetQuantity })
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .select("*, product:products(*)")
          .maybeSingle();

        mutatedItem = data as CartItem | null;
        mutationError = error;
      } else {
        // Insert new cart item
        const { data, error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.id, product_id: productId, quantity: targetQuantity })
          .select("*, product:products(*)")
          .maybeSingle();

        mutatedItem = data as CartItem | null;
        mutationError = error;
      }

      if (mutationError) {
        // Handle unique constraint error 23505 safely
        if (mutationError.code === "23505") {
          const { data: refetchedItem, error: refetchError } = await supabase
            .from("cart_items")
            .select("*")
            .eq("user_id", user.id)
            .eq("product_id", productId)
            .maybeSingle();

          if (refetchError) {
            logSupabaseError("[cart] refetch after 23505 error", refetchError);
            toast.error("Không thể cập nhật giỏ hàng: " + refetchError.message);
            return;
          }

          if (refetchedItem) {
            const newQty = Math.min(product.stock, Math.max(1, refetchedItem.quantity + quantity));
            const { data: updatedItem, error: updateError } = await supabase
              .from("cart_items")
              .update({ quantity: newQty })
              .eq("id", refetchedItem.id)
              .eq("user_id", user.id)
              .select("*, product:products(*)")
              .maybeSingle();

            if (updateError) {
              logSupabaseError("[cart] update after 23505 error", updateError);
              toast.error("Không thể cập nhật giỏ hàng: " + updateError.message);
              return;
            }
            mutatedItem = updatedItem as CartItem | null;
          } else {
            toast.error("Không thể thêm vào giỏ hàng");
            return;
          }
        } else {
          logSupabaseError("[cart] add error", mutationError);
          toast.error("Không thể thêm vào giỏ hàng: " + mutationError.message);
          return;
        }
      }

      if (mutatedItem) {
        setItems((prev) => {
          const idx = prev.findIndex((item) => item.product_id === productId);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = mutatedItem!;
            return next;
          } else {
            return [mutatedItem!, ...prev];
          }
        });
        toast.success("Đã thêm vào giỏ hàng");
      } else {
        await fetchCart();
      }
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
        toast.error("Không thể xóa sản phẩm khỏi giỏ: " + error.message);
        return;
      }
      toast.success("Đã xóa khỏi giỏ");
    },
    [items, user],
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (!user) return;

      const existingItem = items.find((item) => item.id === id);
      if (!existingItem) return;

      const productStock = existingItem.product?.stock ?? 9999;
      let targetQuantity = quantity;

      if (targetQuantity < 1) {
        await removeItem(id);
        return;
      }

      if (targetQuantity > productStock) {
        targetQuantity = productStock;
        toast.warning(`Chỉ có thể đặt tối đa ${productStock} sản phẩm`);
      }

      const previous = items;
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, quantity: targetQuantity } : item)),
      );

      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: targetQuantity })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        logSupabaseError("[cart] update error", error);
        setItems(previous);
        toast.error("Không thể cập nhật số lượng: " + error.message);
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
