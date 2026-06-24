import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/db-types";

export const Route = createFileRoute("/admin/users")({
  component: () => <RequireAuth adminOnly><AdminLayout><UsersAdmin /></AdminLayout></RequireAuth>,
});

function UsersAdmin() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[admin users] fetch error", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          return;
        }
        setUsers((data as Profile[]) ?? []);
      });
  }, []);
  const filtered = useMemo(() => users.filter((u) => !q.trim() || (u.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || u.id.includes(q)), [users, q]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Người dùng</h1>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc ID..." className="pl-10" />
      </div>
      <div className="bg-card border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">Họ tên</th><th className="p-3">SĐT</th><th className="p-3">Vai trò</th><th className="p-3">Đăng ký</th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                <td className="p-3">{u.phone ?? "—"}</td>
                <td className="p-3"><span className={`px-2 py-0.5 text-xs rounded-full ${u.role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{u.role}</span></td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
