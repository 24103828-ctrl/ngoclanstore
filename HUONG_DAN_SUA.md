# Hướng dẫn sửa lỗi đăng nhập Ngọc Lan Store

## Hai lỗi đã được xác định

1. Ứng dụng gọi `public.profiles`, nhưng Supabase hiện có bảng `public.users`. Điều này tạo lỗi `404 PGRST205` sau đăng nhập.
2. Mỗi `ProductCard` tự tạo một subscription giỏ hàng và yêu thích với cùng tên channel. Khi nhiều thẻ sản phẩm cùng render, Supabase Realtime báo `cannot add postgres_changes callbacks ... after subscribe()` và React chuyển sang màn hình `This page didn't load`.

## Việc cần làm

### 1. Cập nhật Supabase

Mở Supabase Dashboard -> SQL Editor -> New query, sao chép toàn bộ nội dung file `SUPABASE_FIX.sql`, rồi nhấn Run.

Sau khi chạy thành công, kiểm tra:

```sql
select
  au.id as auth_id,
  au.email,
  u.id as public_user_id,
  u.full_name,
  u.role
from auth.users au
left join public.users u on u.id = au.id
order by au.created_at desc;
```

`auth_id` và `public_user_id` phải giống nhau.

### 2. Cập nhật mã nguồn

Đưa toàn bộ mã nguồn trong thư mục này lên repository đang kết nối với website, sau đó deploy/publish lại.

Các thay đổi chính:

- Mọi query hồ sơ đổi từ `profiles` sang `users`.
- Đăng ký không còn tự upsert hồ sơ từ frontend; trigger Supabase tạo hồ sơ an toàn.
- Cart và Favorites được chuyển thành global providers, nên toàn trang chỉ có một subscription cho mỗi bảng.
- Realtime channel có tên duy nhất để tránh xung đột khi React mount lại component.
- Các lỗi Supabase được ghi rõ trong Console thay vì làm trang crash.

### 3. Xóa phiên cũ và thử lại

Sau khi deploy:

1. Mở website bằng cửa sổ ẩn danh, hoặc xóa Local Storage có khóa bắt đầu bằng `sb-`.
2. Đăng nhập lại.
3. Mở F12 -> Console. Không còn request `/rest/v1/profiles` và không còn lỗi `cannot add postgres_changes callbacks`.
