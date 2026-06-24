# Ngọc Lan Store — Supabase Connection Audit

**Project URL:** `https://euubswbzxwzgywqqtunn.supabase.co`
**Anon key:** configured in `src/integrations/supabase/client.ts` (verified valid JWT, role=`anon`, exp 2097)
**Auth model:** Supabase Auth (`signUp`, `signInWithPassword`, `onAuthStateChange`) — no fake/mock auth anywhere.
**Storage of user data:** 100% in Supabase tables. No `localStorage` is used for products, cart, favorites, orders, or session (Supabase Auth manages its own session storage internally — that is required, not custom).

## Connection matrix

| Page / Module                  | Path                                  | Supabase tables / APIs                                  | Realtime | Status |
|--------------------------------|---------------------------------------|----------------------------------------------------------|:--------:|:------:|
| Home                           | `src/routes/index.tsx`                | `products` (select)                                      | ✅       | ✅ Connected |
| Product list                   | `src/routes/products.tsx`             | `products` (select)                                      | ✅       | ✅ Connected |
| Product detail                 | `src/routes/products.$id.tsx`         | `products` (select by id)                                | —        | ✅ Connected |
| Cart                           | `src/routes/cart.tsx` + `use-cart.ts` | `cart_items` (CRUD) + `products` (join)                  | ✅ per user | ✅ Connected |
| Favorites                      | `src/routes/favorites.tsx` + `use-favorites.ts` | `favorites` (CRUD) + `products` (join)         | ✅ per user | ✅ Connected |
| Checkout                       | `src/routes/checkout.tsx`             | `orders` (insert) + `order_items` (insert)               | —        | ✅ Connected |
| Profile / order history        | `src/routes/profile.tsx`              | `users` (update) + `orders` (select)                  | —        | ✅ Connected |
| Register                       | `src/routes/auth.tsx`                 | `supabase.auth.signUp()` + `users` (upsert)           | —        | ✅ Connected |
| Login                          | `src/routes/auth.tsx`                 | `supabase.auth.signInWithPassword()`                     | —        | ✅ Connected |
| Auth session / role            | `src/lib/auth-context.tsx`            | `supabase.auth` + `users`                             | onAuthStateChange | ✅ Connected |
| Admin dashboard                | `src/routes/admin.index.tsx`          | `products`, `orders`, `users` (counts + recent)       | —        | ✅ Connected |
| Admin · Products               | `src/routes/admin.products.tsx`       | `products` (CRUD)                                        | ✅       | ✅ Connected |
| Admin · Orders                 | `src/routes/admin.orders.tsx`         | `orders` (select + update status)                        | ✅       | ✅ Connected |
| Admin · Users                  | `src/routes/admin.users.tsx`          | `users` (select)                                      | —        | ✅ Connected |
| Admin · Chat history           | `src/routes/admin.chats.tsx`          | `chatbot_history` (select)                               | —        | ✅ Connected |
| Chatbot widget + page          | `ChatbotWidget.tsx`, `chatbot.tsx`    | `chatbot_history` (insert/select) + n8n webhook          | —        | ✅ Connected |

## Items NOT connected to Supabase (by design)

| Item | Where | Why it is not a DB row |
|------|-------|------------------------|
| Hero copy & feature strip ("Free ship", "Chính hãng", "Đổi trả") | `src/routes/index.tsx` | Static marketing content — not business data. |
| Category chip list (Running / Basketball / Lifestyle / Training) | `src/routes/index.tsx`, `src/routes/products.tsx` | Static taxonomy used for filtering; products themselves are loaded from `products.category`. |
| Testimonial reviews (3 quotes) | `src/routes/index.tsx` | Marketing copy. Move to a `reviews` table if you want them user-editable — say the word and I'll add it. |

No other mock data, hardcoded arrays, fake products, or fake users exist in the codebase.

## Realtime subscriptions

| Channel              | Table         | Filter                  | File |
|----------------------|---------------|-------------------------|------|
| `home-products`      | `products`    | all                     | `src/routes/index.tsx` |
| `products-list`      | `products`    | all                     | `src/routes/products.tsx` |
| `admin-products`     | `products`    | all                     | `src/routes/admin.products.tsx` |
| `admin-orders`       | `orders`      | all                     | `src/routes/admin.orders.tsx` |
| `cart-<userId>`      | `cart_items`  | `user_id=eq.<userId>`   | `src/hooks/use-cart.ts` |
| `fav-<userId>`       | `favorites`   | `user_id=eq.<userId>`   | `src/hooks/use-favorites.ts` |

For realtime to actually fire you must publish the tables: in Supabase SQL editor run
`ALTER PUBLICATION supabase_realtime ADD TABLE public.products, public.orders, public.cart_items, public.favorites;`

## Request / error logging

`src/integrations/supabase/client.ts` now installs a `global.fetch` wrapper that logs every Supabase HTTP call:

```
[supabase] → GET /rest/v1/products?select=*
[supabase] ✓ GET /rest/v1/products?select=* → 200 (87ms)
[supabase] ✗ POST /rest/v1/users → 404  { "code":"PGRST205", ... }
```

Open the browser console to watch traffic in real time.

## Action required from you

Your network log shows two symptoms that are NOT code bugs — they are missing database setup:

1. `GET /rest/v1/products` returns `[]` → the `products` table exists but has no rows (seed it via the SQL script I delivered earlier, or add products from `/admin/products`).
2. `POST /rest/v1/users` returns `404 PGRST205 "Could not find the table 'public.users'"` → the `users` table has not been created yet. Run the full SQL setup script in the Supabase SQL Editor (creates `users`, `products`, `cart_items`, `favorites`, `orders`, `order_items`, `chatbot_history`, RLS policies, the auto-profile trigger, and the realtime publication). After that, promote your account to admin with:

   ```sql
   UPDATE public.users SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
   ```

Once the schema is in place, every page in the table above will light up immediately — no further code changes needed.