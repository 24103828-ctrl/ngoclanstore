export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type OrderStatus = "pending" | "shipping" | "completed" | "failed";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  image_path: string | null;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at?: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export interface Favorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
}

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  total_amount: number;
  order_status: OrderStatus;
  created_at: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface SiteSettings {
  id: string;
  settings_key: string;
  shop_name: string;
  shop_tagline: string | null;
  shop_description: string | null;
  logo_url: string | null;
  logo_path: string | null;
  hero_badge: string | null;
  hero_title_line_1: string | null;
  hero_title_highlight: string | null;
  hero_title_line_2: string | null;
  hero_description: string | null;
  hero_image_url: string | null;
  hero_image_path: string | null;
  primary_cta_label: string | null;
  primary_cta_href: string | null;
  secondary_cta_label: string | null;
  secondary_cta_href: string | null;
  primary_color: string | null;
  accent_color: string | null;
  shipping_title: string | null;
  shipping_subtitle: string | null;
  authenticity_title: string | null;
  authenticity_subtitle: string | null;
  returns_title: string | null;
  returns_subtitle: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface N8nChatMemoryRow {
  id: number;
  session_id: string;
  message: any;
}

export interface ChatbotMessage {
  id: string;
  user_id: string | null;
  role: "user" | "assistant";
  message: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      products: { Row: Product; Insert: Partial<Product> & { name: string; price: number; category: string }; Update: Partial<Product> };
      cart_items: { Row: CartItem; Insert: Omit<CartItem, "id" | "created_at" | "product">; Update: Partial<CartItem> };
      favorites: { Row: Favorite; Insert: Omit<Favorite, "id" | "created_at" | "product">; Update: Partial<Favorite> };
      orders: { Row: Order; Insert: Omit<Order, "id" | "created_at">; Update: Partial<Order> };
      order_items: { Row: OrderItem; Insert: Omit<OrderItem, "id" | "product">; Update: Partial<OrderItem> };
      order_status_history: { Row: OrderStatusHistory; Insert: Omit<OrderStatusHistory, "id" | "created_at">; Update: Partial<OrderStatusHistory> };
      site_settings: { Row: SiteSettings; Insert: Partial<SiteSettings> & { shop_name: string }; Update: Partial<SiteSettings> };
      n8n_chat_memory_v2: { Row: N8nChatMemoryRow; Insert: Omit<N8nChatMemoryRow, "id">; Update: Partial<N8nChatMemoryRow> };
    };
  };
}