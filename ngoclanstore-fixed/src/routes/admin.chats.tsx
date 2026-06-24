import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import type { ChatbotMessage } from "@/lib/db-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/chats")({
  component: () => <RequireAuth adminOnly><AdminLayout><Chats /></AdminLayout></RequireAuth>,
});

function Chats() {
  const [msgs, setMsgs] = useState<ChatbotMessage[]>([]);
  useEffect(() => {
    supabase.from("chatbot_history").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setMsgs((data as ChatbotMessage[]) ?? []));
  }, []);

  // Group by user_id
  const groups = msgs.reduce<Record<string, ChatbotMessage[]>>((acc, m) => {
    const k = m.user_id ?? "guest";
    (acc[k] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lịch sử chatbot</h1>
      <div className="space-y-6">
        {Object.entries(groups).map(([uid, list]) => (
          <div key={uid} className="bg-card border rounded-2xl p-5">
            <div className="text-xs font-mono text-muted-foreground mb-3">User: {uid.slice(0, 12)}...</div>
            <div className="space-y-2">
              {list.slice().reverse().map((m) => (
                <div key={m.id} className={cn("text-sm p-2.5 rounded-lg max-w-[80%]", m.role === "user" ? "bg-primary/10 ml-auto" : "bg-muted")}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{m.role}</div>
                  {m.message}
                </div>
              ))}
            </div>
          </div>
        ))}
        {msgs.length === 0 && <p className="text-muted-foreground">Chưa có hội thoại nào.</p>}
      </div>
    </div>
  );
}
