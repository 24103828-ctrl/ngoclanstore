-- SUPABASE_ADMIN_STORE_MANAGEMENT.sql
-- Idempotent Supabase migration script for Ngọc Lan Store Admin Features

-- =====================================================================
-- 1. STANDARDIZE ORDER STATUSES & TRIGGER
-- =====================================================================

-- Normalize any existing order status values safely
UPDATE public.orders
SET order_status = CASE 
  WHEN order_status = 'shipped' THEN 'shipping'
  WHEN order_status = 'delivered' THEN 'completed'
  WHEN order_status = 'cancelled' THEN 'failed'
  WHEN order_status = 'processing' THEN 'pending'
  WHEN order_status IN ('pending', 'shipping', 'completed', 'failed') THEN order_status
  ELSE 'pending'
END;

-- Set default and NOT NULL constraints on order_status
ALTER TABLE public.orders ALTER COLUMN order_status SET DEFAULT 'pending';
UPDATE public.orders SET order_status = 'pending' WHERE order_status IS NULL;
ALTER TABLE public.orders ALTER COLUMN order_status SET NOT NULL;

-- Add check constraint for status values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_order_status;
ALTER TABLE public.orders ADD CONSTRAINT check_order_status CHECK (order_status IN ('pending', 'shipping', 'completed', 'failed'));

-- Set default to updated_at
ALTER TABLE public.orders ALTER COLUMN updated_at SET DEFAULT now();

-- Generic trigger function for updating updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to orders table
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2. CREATE ORDER STATUS HISTORY TABLE & INDEXES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status VARCHAR,
    new_status VARCHAR NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for optimization
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON public.order_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_new_status ON public.order_status_history(new_status);

-- =====================================================================
-- 3. ADMIN AUTHORIZATION HELPER
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    RETURN (v_role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Revoke and grant privileges safely
REVOKE ALL ON FUNCTION private.is_admin() FROM public;
REVOKE ALL ON FUNCTION private.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- =====================================================================
-- 4. ORDERS & ORDER_ITEMS RLS POLICIES
-- =====================================================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Orders table policies
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Users can insert own orders" ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders
FOR UPDATE
TO authenticated
USING (private.is_admin())
WITH CHECK (private.is_admin());

-- Order items table policies
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id = auth.uid() OR private.is_admin())
  )
);

DROP POLICY IF EXISTS "Users can insert order items" ON public.order_items;
CREATE POLICY "Users can insert order items" ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

-- Order status history table policies
DROP POLICY IF EXISTS "Admins can select order history" ON public.order_status_history;
CREATE POLICY "Admins can select order history" ON public.order_status_history
FOR SELECT
TO authenticated
USING (private.is_admin());

DROP POLICY IF EXISTS "Admins can insert order history" ON public.order_status_history;
CREATE POLICY "Admins can insert order history" ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin());

-- =====================================================================
-- 5. ADD IMAGE_PATH COLUMN TO PRODUCTS
-- =====================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_path TEXT;

-- =====================================================================
-- 6. CREATE SITE SETTINGS TABLE & CONSTRAINTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settings_key VARCHAR NOT NULL UNIQUE DEFAULT 'default',
    shop_name TEXT NOT NULL,
    shop_tagline TEXT,
    shop_description TEXT,
    logo_url TEXT,
    logo_path TEXT,
    hero_badge TEXT,
    hero_title_line_1 TEXT,
    hero_title_highlight TEXT,
    hero_title_line_2 TEXT,
    hero_description TEXT,
    hero_image_url TEXT,
    hero_image_path TEXT,
    primary_cta_label TEXT,
    primary_cta_href TEXT,
    secondary_cta_label TEXT,
    secondary_cta_href TEXT,
    primary_color VARCHAR,
    accent_color VARCHAR,
    shipping_title TEXT,
    shipping_subtitle TEXT,
    authenticity_title TEXT,
    authenticity_subtitle TEXT,
    returns_title TEXT,
    returns_subtitle TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    contact_address TEXT,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add constraints for key length and hex color codes
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS check_settings_key_not_blank;
ALTER TABLE public.site_settings ADD CONSTRAINT check_settings_key_not_blank CHECK (length(trim(settings_key)) > 0);

ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS check_primary_color_hex;
ALTER TABLE public.site_settings ADD CONSTRAINT check_primary_color_hex CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS check_accent_color_hex;
ALTER TABLE public.site_settings ADD CONSTRAINT check_accent_color_hex CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$');

-- Insert default storefront configuration row
INSERT INTO public.site_settings (
    settings_key,
    shop_name,
    shop_tagline,
    shop_description,
    logo_url,
    hero_badge,
    hero_title_line_1,
    hero_title_highlight,
    hero_title_line_2,
    hero_description,
    hero_image_url,
    primary_cta_label,
    primary_cta_href,
    secondary_cta_label,
    secondary_cta_href,
    primary_color,
    accent_color,
    shipping_title,
    shipping_subtitle,
    authenticity_title,
    authenticity_subtitle,
    returns_title,
    returns_subtitle,
    contact_phone,
    contact_email,
    contact_address
) VALUES (
    'default',
    'Ngọc Lan Store',
    'Thời trang & Phụ kiện cao cấp',
    'Ngọc Lan Store cung cấp quần áo thời trang, túi xách, giày dép và phụ kiện cao cấp chính hãng với chất lượng dịch vụ tốt nhất.',
    NULL,
    'BST Mới Nhất 2026',
    'Thời Trang Cao Cấp',
    'Ngọc Lan Store',
    'Nâng tầm phong cách của bạn',
    'Khám phá bộ sưu tập quần áo và phụ kiện thời thượng được thiết kế tinh tế giúp bạn tự tin tỏa sáng mỗi ngày.',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070',
    'Mua Ngay',
    '/products',
    'Xem Chi Tiết',
    '/products',
    '#22C55E',
    '#F59E0B',
    'Miễn phí vận chuyển',
    'Cho mọi đơn hàng từ 500k',
    'Chính hãng 100%',
    'Cam kết hoàn tiền nếu phát hiện hàng giả',
    'Đổi trả dễ dàng',
    'Hỗ trợ đổi trả trong vòng 30 ngày',
    '0987.654.321',
    'contact@ngoclanstore.com',
    '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh'
) ON CONFLICT (settings_key) DO NOTHING;

-- Apply updated_at trigger to site_settings table
DROP TRIGGER IF EXISTS trigger_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trigger_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can select site settings" ON public.site_settings;
CREATE POLICY "Anyone can select site settings" ON public.site_settings
FOR SELECT
TO public
USING (settings_key = 'default');

DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
CREATE POLICY "Admins can update site settings" ON public.site_settings
FOR UPDATE
TO authenticated
USING (private.is_admin())
WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings" ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin());

-- =====================================================================
-- 7. STORAGE BUCKETS & RLS POLICIES
-- =====================================================================

-- Ensure storage buckets exist with proper size and type limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('site-assets', 'site-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS Policies
DROP POLICY IF EXISTS "Anyone can select product images" ON storage.objects;
CREATE POLICY "Anyone can select product images" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images' OR bucket_id = 'site-assets');

-- Restricted Admin Policies by Bucket
DROP POLICY IF EXISTS "Admins can insert product images" ON storage.objects;
CREATE POLICY "Admins can insert product images" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND private.is_admin());

DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
CREATE POLICY "Admins can update product images" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND private.is_admin())
WITH CHECK (bucket_id = 'product-images' AND private.is_admin());

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND private.is_admin());

DROP POLICY IF EXISTS "Admins can insert site assets" ON storage.objects;
CREATE POLICY "Admins can insert site assets" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-assets' AND private.is_admin());

DROP POLICY IF EXISTS "Admins can update site assets" ON storage.objects;
CREATE POLICY "Admins can update site assets" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'site-assets' AND private.is_admin())
WITH CHECK (bucket_id = 'site-assets' AND private.is_admin());

DROP POLICY IF EXISTS "Admins can delete site assets" ON storage.objects;
CREATE POLICY "Admins can delete site assets" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'site-assets' AND private.is_admin());

-- =====================================================================
-- 8. DATABASE REALTIME SUBSCRIPTIONS
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Enable orders Realtime
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_rel pr 
      JOIN pg_class c ON pr.prrelid = c.oid 
      JOIN pg_namespace n ON c.relnamespace = n.oid 
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
      AND n.nspname = 'public' 
      AND c.relname = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    -- Enable site_settings Realtime
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_rel pr 
      JOIN pg_class c ON pr.prrelid = c.oid 
      JOIN pg_namespace n ON c.relnamespace = n.oid 
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime') 
      AND n.nspname = 'public' 
      AND c.relname = 'site_settings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
    END IF;
  END IF;
END;
$$;

-- =====================================================================
-- 9. ADMIN ORDER STATUS TRANSACTION HELPER RPC
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_update_order_status(
    p_order_id UUID,
    p_new_status TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_order RECORD;
    v_prev_status TEXT;
    v_changed_by UUID;
    v_result JSON;
BEGIN
    -- 1. Security Check
    IF NOT private.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can update order status.';
    END IF;

    -- 2. Validate parameters
    IF p_new_status NOT IN ('pending', 'shipping', 'completed', 'failed') THEN
        RAISE EXCEPTION 'Invalid status value: %', p_new_status;
    END IF;

    -- 3. Lock and retrieve order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found for ID: %', p_order_id;
    END IF;

    v_prev_status := v_order.order_status;
    v_changed_by := auth.uid();

    -- 4. Update status if changed
    IF v_prev_status <> p_new_status THEN
        UPDATE public.orders 
        SET order_status = p_new_status,
            updated_at = now()
        WHERE id = p_order_id
        RETURNING * INTO v_order;

        -- 5. Insert history record
        INSERT INTO public.order_status_history (
            order_id,
            previous_status,
            new_status,
            changed_by,
            note,
            created_at
        ) VALUES (
            p_order_id,
            v_prev_status,
            p_new_status,
            v_changed_by,
            p_note,
            now()
        );
    END IF;

    -- 6. Construct return JSON
    SELECT json_build_object(
        'id', v_order.id,
        'user_id', v_order.user_id,
        'customer_name', v_order.customer_name,
        'customer_phone', v_order.customer_phone,
        'shipping_address', v_order.shipping_address,
        'total_amount', v_order.total_amount,
        'order_status', v_order.order_status,
        'created_at', v_order.created_at,
        'updated_at', v_order.updated_at
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT, TEXT) TO authenticated;
