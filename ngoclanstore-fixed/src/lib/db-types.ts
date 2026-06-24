export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  stock: number;
  is_featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  created_at: string;
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
  phone: string;
  address: string;
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: Product;
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
      chatbot_history: { Row: ChatbotMessage; Insert: Omit<ChatbotMessage, "id" | "created_at">; Update: Partial<ChatbotMessage> };
    };
  };
}