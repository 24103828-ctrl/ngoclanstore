# BẢN CHUYỂN NGỌC LAN STORE SANG REACT + VITE SPA

Bản vá này bỏ cấu hình Lovable và TanStack Start SSR, nhưng vẫn giữ:
- React
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- Supabase
- Các route hiện có trong `src/routes`

## 1. Sao lưu repository trước

Tạo một branch mới hoặc tải bản ZIP hiện tại về máy.

## 2. Chép đè các file trong gói này

Chép các file vào đúng vị trí trong repository:
- `vite.config.ts`
- `index.html`
- `vercel.json`
- `package.json`
- `src/main.tsx`
- `src/router.tsx`
- `src/routes/__root.tsx`

## 3. Xóa các file/thư mục chỉ dành cho Lovable hoặc TanStack Start SSR

Xóa:
- `.lovable/`
- `src/start.ts`
- `src/server.ts`
- `src/lib/lovable-error-reporting.ts`
- thư mục `ngoclanstore-fixed/` nếu đó chỉ là một bản sao lồng bên trong repository

Không xóa:
- `src/routes/`
- `src/routeTree.gen.ts`
- `src/components/`
- `src/hooks/`
- `src/integrations/`
- `src/lib/`
- `src/styles.css`

## 4. Làm mới dependency lock

Xóa:
- `package-lock.json`
- `bun.lock`

Sau đó chạy:

```bash
npm install
npm run build
```

Commit cả `package-lock.json` mới được tạo.

## 5. Cấu hình Vercel

Trong Vercel > Settings > Build and Deployment:

- Framework Preset: Vite
- Root Directory: `./`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Sau đó Redeploy và chọn Clear build cache.

## Lưu ý quan trọng

Không tải nguyên file ZIP vào GitHub rồi mong GitHub tự giải nén.
Phải giải nén trên máy, sau đó đưa các file/thư mục bên trong lên repository.

Nếu bất kỳ file route nào vẫn import từ `@tanstack/react-start`,
hãy chuyển logic đó sang phía client hoặc Supabase trước khi build.
