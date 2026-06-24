import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";
import type { Product } from "@/lib/db-types";

interface CheckoutSearch {
  mode?: "buy-now";
  productId?: string;
  quantity?: number;
}

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => {
    return {
      mode: search.mode === "buy-now" ? "buy-now" : undefined,
      productId: typeof search.productId === "string" ? search.productId : undefined,
      quantity: typeof search.quantity === "number" 
        ? search.quantity 
        : (typeof search.quantity === "string" ? parseInt(search.quantity, 10) : undefined),
    };
  },
  component: () => (
    <RequireAuth>
      <Checkout />
    </RequireAuth>
  ),
});

const ensureNumber = (val: any): number => {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
};

function Checkout() {
  const { user, profile } = useAuth();
  const { items, clearCart } = useCart();
  const nav = useNavigate();
  
  const { mode, productId, quantity } = Route.useSearch();
  
  const [buyNowProduct, setBuyNowProduct] = useState<Product | null>(null);
  const [buyNowLoading, setBuyNowLoading] = useState(mode === "buy-now");
  const [buyNowError, setBuyNowError] = useState<string | null>(null);
  
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (mode !== "buy-now") return;
    if (!productId) {
      setBuyNowError("Mã sản phẩm mua ngay không hợp lệ.");
      setBuyNowLoading(false);
      return;
    }
    const loadProduct = async () => {
      setBuyNowLoading(true);
      setBuyNowError(null);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          setBuyNowError("Không thể tải thông tin sản phẩm: " + error.message);
        } else if (!data) {
          setBuyNowError("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.");
        } else {
          setBuyNowProduct(data as Product);
        }
      } catch (err: any) {
        setBuyNowError("Có lỗi xảy ra: " + (err.message || err));
      } finally {
        setBuyNowLoading(false);
      }
    };
    loadProduct();
  }, [mode, productId]);

  if (mode === "buy-now" && buyNowLoading) {
    return (
      <UserLayout>
        <div className="min-h-[60vh] grid place-items-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </UserLayout>
    );
  }

  if (mode === "buy-now" && (buyNowError || !buyNowProduct)) {
    return (
      <UserLayout>
        <div className="container-px mx-auto max-w-7xl py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Lỗi thanh toán</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {buyNowError || "Sản phẩm không hợp lệ hoặc không tìm thấy."}
          </p>
          <Link to="/products">
            <Button className="mt-4">Quay lại danh sách sản phẩm</Button>
          </Link>
        </div>
      </UserLayout>
    );
  }

  const checkoutItems = mode === "buy-now" 
    ? (buyNowProduct ? [{
        id: "buy-now-temp",
        user_id: user?.id ?? "",
        product_id: buyNowProduct.id,
        quantity: quantity && quantity > 0 ? quantity : 1,
        created_at: new Date().toISOString(),
        product: buyNowProduct
      }] : [])
    : items;

  const totalAmount = mode === "buy-now"
    ? (buyNowProduct ? ensureNumber(buyNowProduct.price) * (quantity && quantity > 0 ? quantity : 1) : 0)
    : items.reduce((sum, item) => sum + ensureNumber(item.product?.price) * item.quantity, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (checkoutItems.length === 0) {
      toast.error("Không có sản phẩm nào để thanh toán");
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Fetch current product records again for stock protection and price verification
      const productIds = checkoutItems.map(item => item.product_id);
      const { data: latestProducts, error: fetchProductsError } = await supabase
        .from("products")
        .select("id, name, price, stock, is_active")
        .in("id", productIds);

      if (fetchProductsError || !latestProducts) {
        console.error("Fetch products verification error:", {
          code: fetchProductsError?.code,
          message: fetchProductsError?.message,
          details: fetchProductsError?.details,
          hint: fetchProductsError?.hint,
        });
        toast.error("Không thể xác thực thông tin sản phẩm mới nhất");
        setSubmitting(false);
        return;
      }

      const productMap = new Map(latestProducts.map(p => [p.id, p]));

      // Validate all checkout items against latest DB data
      for (const item of checkoutItems) {
        const dbProd = productMap.get(item.product_id);
        if (!dbProd) {
          toast.error("Sản phẩm không tồn tại trong hệ thống.");
          setSubmitting(false);
          return;
        }
        if (!dbProd.is_active) {
          toast.error(`Sản phẩm "${dbProd.name}" hiện đã ngừng kinh doanh.`);
          setSubmitting(false);
          return;
        }
        if (item.quantity <= 0) {
          toast.error(`Số lượng sản phẩm "${dbProd.name}" phải lớn hơn 0.`);
          setSubmitting(false);
          return;
        }
        if (dbProd.stock <= 0) {
          toast.error(`Sản phẩm "${dbProd.name}" hiện đã hết hàng.`);
          setSubmitting(false);
          return;
        }
        if (dbProd.stock < item.quantity) {
          toast.error(`Sản phẩm "${dbProd.name}" chỉ còn ${dbProd.stock} sản phẩm trong kho, không đủ số lượng ${item.quantity} yêu cầu.`);
          setSubmitting(false);
          return;
        }
      }

      // 2. Before creating an order, get the authenticated user using getUser()
      const { data: { user }, error: authUserError } = await supabase.auth.getUser();
      if (authUserError || !user) {
        console.error("Auth user retrieval error:", authUserError);
        toast.error("Vui lòng đăng nhập để thanh toán");
        setSubmitting(false);
        return;
      }

      // Calculate total_amount from current checkout items: Number(product.price) * Number(quantity)
      let calculatedTotal = 0;
      for (const item of checkoutItems) {
        const dbProd = productMap.get(item.product_id)!;
        calculatedTotal += Number(dbProd.price) * Number(item.quantity);
      }

      // 3. Create order with exactly required fields
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          shipping_address: address.trim(),
          total_amount: calculatedTotal
        })
        .select("id")
        .single();

      if (orderError || !order) {
        console.error("Order creation error:", {
          code: orderError?.code,
          message: orderError?.message,
          details: orderError?.details,
          hint: orderError?.hint,
        });
        toast.error("Không thể tạo đơn hàng");
        setSubmitting(false);
        return;
      }

      // 4. Create order items
      const orderItemsRows = checkoutItems.map((item) => {
        const dbProd = productMap.get(item.product_id)!;
        const unitPrice = Number(dbProd.price);
        return {
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          subtotal: unitPrice * item.quantity,
        };
      });

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsRows);

      if (itemsError) {
        console.error("Order items insertion error:", {
          code: itemsError.code,
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
        });
        toast.error("Không thể lưu chi tiết đơn hàng");

        // Rollback created order
        const { error: rollbackError } = await supabase
          .from("orders")
          .delete()
          .eq("id", order.id);

        if (rollbackError) {
          console.error("Rollback deletion error:", {
            code: rollbackError.code,
            message: rollbackError.message,
            details: rollbackError.details,
            hint: rollbackError.hint,
          });
        }
        setSubmitting(false);
        return;
      }

      // 5. Clear cart if in normal cart mode
      if (mode !== "buy-now") {
        await clearCart();
      }

      toast.success("Đặt hàng thành công!");
      nav({ to: "/profile" });

    } catch (err: any) {
      console.error("Unexpected error during checkout submission:", err);
      toast.error("Có lỗi xảy ra: " + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-5xl py-10">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-3xl font-bold">Thanh toán</h1>
          {mode === "buy-now" ? (
            <span className="bg-primary/15 text-primary px-3 py-1 rounded-full text-xs font-semibold">
              Mua ngay
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-semibold">
              Thanh toán giỏ hàng
            </span>
          )}
        </div>
        <form onSubmit={submit} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4 p-6 bg-card border rounded-2xl">
            <h3 className="font-semibold">Thông tin giao hàng</h3>
            <div className="space-y-2">
              <Label>Họ và tên *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ *</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={3} />
            </div>
          </div>
          <div className="p-6 bg-card border rounded-2xl h-fit space-y-4 sticky top-24">
            <h3 className="font-semibold">Đơn hàng ({checkoutItems.length})</h3>
            <div className="space-y-3">
              {checkoutItems.map((it) => {
                const itemPrice = ensureNumber(it.product?.price);
                return (
                  <div key={it.id} className="flex gap-3 text-sm">
                    {it.product?.image_url && (
                      <div className="size-12 shrink-0 bg-muted rounded-md overflow-hidden">
                        <img src={it.product.image_url} alt={it.product.name} className="size-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{it.product?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatVND(itemPrice)} × {it.quantity}
                      </div>
                    </div>
                    <div className="shrink-0 font-semibold text-right">
                      {formatVND(itemPrice * it.quantity)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t pt-3 flex justify-between font-bold">
              <span>Tổng</span>
              <span>{formatVND(totalAmount)}</span>
            </div>
            <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting || checkoutItems.length === 0}>
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Đặt hàng
            </Button>
          </div>
        </form>
      </div>
    </UserLayout>
  );
}
