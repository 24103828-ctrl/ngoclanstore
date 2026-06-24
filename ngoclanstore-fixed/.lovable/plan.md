# Ngọc Lan Store – Implementation Plan

A premium sports shoes e-commerce site (Nike/Adidas style) — white background, black typography, green #22C55E accent — built on the existing TanStack Start + TypeScript + Tailwind v4 stack, wired to the user-provided Supabase project.

## Backend (user's Supabase)

Connect directly to the provided project (`euubswbzxwzgywqqtunn`) via the browser client using the supplied publishable key. No Lovable Cloud — this is BYO Supabase, so all data access goes through the browser client + RLS. The admin (`/admin`) is gated by a role check, not service-role keys.

Files:
- `src/integrations/supabase/client.ts` – createClient with provided URL/key, persisted session, realtime enabled.
- `src/integrations/supabase/types.ts` – hand-written Database types matching the schema below.

### Schema (user must run this SQL in their Supabase SQL editor — provided in chat after build)

Tables: `users` (id, full_name, phone, role enum user|admin), `products`, `cart_items`, `favorites`, `orders`, `order_items`, `chatbot_history`. RLS on all; realtime publication for products/orders/cart_items/favorites. Trigger to auto-create profile + default role on signup. Admin policies via `has_role()` security-definer fn.

Since this is external Supabase, the SQL will be delivered as a one-shot setup script the user pastes into their dashboard.

## Frontend structure

```
src/
  routes/
    __root.tsx                 # providers, toaster, chatbot widget, auth listener
    index.tsx                  # Home: hero, categories, featured, new arrivals, best sellers, reviews
    products.tsx               # Listing: search, category filter, price sort, pagination
    products.$id.tsx           # Detail: gallery, qty, add-to-cart, favorite
    cart.tsx
    checkout.tsx
    favorites.tsx
    auth.tsx                   # login + register tabs
    chatbot.tsx                # full-page chat
    _authenticated/
      route.tsx                # session gate (ssr:false, redirect to /auth)
      profile.tsx
    _authenticated/_admin/
      route.tsx                # role gate (redirect non-admins)
      index.tsx                # dashboard stats
      products.tsx             # CRUD
      orders.tsx               # status mgmt
      users.tsx                # search/view
      chats.tsx                # chatbot history
  components/
    layout/{UserLayout,AdminLayout,Header,Footer,MobileNav}.tsx
    product/{ProductCard,ProductGrid,ProductFilters,QuantitySelector}.tsx
    home/{Hero,CategoryGrid,FeaturedSection,ReviewsSection}.tsx
    chatbot/ChatbotWidget.tsx  # floating bottom-right
    ui/                        # existing shadcn
  hooks/
    useAuth.ts, useCart.ts, useFavorites.ts, useProducts.ts (with realtime)
  lib/
    cn.ts, format.ts (VND currency), seedProducts.ts (optional)
```

## Design system

Update `src/styles.css`:
- White bg, near-black foreground, primary = green `oklch` of #22C55E with white foreground.
- Display font (Space Grotesk) + body (Inter) via Google Fonts `<link>` in `__root.tsx` head.
- Smooth hover-lift transitions, subtle shadows, large product imagery.

Hero uses generated sports-shoe image (premium quality).

## Key behaviors

- **Auth**: email/password via Supabase; on signup create profile row (trigger). `_authenticated/route.tsx` redirects unauthed to `/auth`; `_admin/route.tsx` reads profile.role, redirects non-admins to `/`.
- **Cart & Favorites**: Stored in DB when logged in, with realtime channel subscriptions. Optimistic updates + toast.
- **Realtime products**: listing & admin subscribe to `products` table changes.
- **Checkout**: form (name/phone/address) → insert order + order_items in transaction-like sequence → clear cart → toast → redirect to profile.
- **Chatbot**: floating widget on all pages + full `/chatbot` route. POST to provided n8n webhook with `{message, userId}`, persist both sides to `chatbot_history`. Admin can browse all conversations.
- **Toasts**: sonner (already installed).
- **Loading states**: skeletons on grids, spinners on buttons.

## Out of scope / assumptions

- The provided Supabase publishable key is treated as public (it is). All security relies on RLS.
- Product seed data: I'll insert a handful of demo sneakers via SQL so the site isn't empty on first load.
- No payment integration — checkout creates an order with status `pending` (COD style).
- I'll provide the SQL setup script in chat for the user to run in their Supabase SQL editor before the site works end-to-end.

## Deliverables

1. Full TanStack Start app with the routes/components above, wired to the user's Supabase.
2. SQL setup script (schema + RLS + realtime + trigger + seed) delivered in chat.
3. Brief usage notes: how to promote a user to admin (single UPDATE statement).
