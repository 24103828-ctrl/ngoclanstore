import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import type { N8nChatMemoryRow } from "@/lib/db-types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/chats")({
  component: () => <RequireAuth adminOnly><AdminLayout><Chats /></AdminLayout></RequireAuth>,
});

interface ProcessedMessage {
  id: number;
  sessionId: string;
  role: "human" | "ai";
  content: string;
}

interface ChatGroup {
  sessionId: string;
  displayName: string;
  messages: ProcessedMessage[];
}

function Chats() {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch raw messages, sort by id asc to keep natural chat order
        const { data: rawData, error } = await supabase
          .from("n8n_chat_memory_v2")
          .select("*")
          .order("id", { ascending: true });

        if (error || !rawData) {
          console.error("Lỗi lấy lịch sử chat", error);
          setLoading(false);
          return;
        }

        // 2. Filter and map
        const processed: ProcessedMessage[] = [];
        for (const row of rawData as N8nChatMemoryRow[]) {
          const msg = row.message as any;
          if (!msg) continue;

          const type = msg.type;
          const content = msg.content;

          if ((type === "human" || type === "ai") && typeof content === "string" && content.trim() !== "") {
            processed.push({
              id: row.id,
              sessionId: row.session_id,
              role: type,
              content: content.trim(),
            });
          }
        }

        // 3. Group by session_id
        const groupedMap = new Map<string, ProcessedMessage[]>();
        for (const p of processed) {
          if (!groupedMap.has(p.sessionId)) {
            groupedMap.set(p.sessionId, []);
          }
          groupedMap.get(p.sessionId)!.push(p);
        }

        // 4. Fetch users to match session_id
        // Extract sessionIds that look like UUIDs to avoid DB errors when fetching
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const potentialUuids = Array.from(groupedMap.keys()).filter(id => uuidRegex.test(id));

        const usersMap = new Map<string, any>();
        if (potentialUuids.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("*")
            .in("id", potentialUuids);

          if (usersData) {
            for (const u of usersData) {
              usersMap.set(u.id, u);
            }
          }
        }

        // 5. Build final array
        const finalGroups: ChatGroup[] = [];
        for (const [sessionId, messages] of groupedMap.entries()) {
          const u = usersMap.get(sessionId);
          let displayName = `Người dùng ${sessionId.slice(0, 8)}`;

          if (u) {
            displayName = u.full_name || u.display_name || u.name || u.email || displayName;
          }

          finalGroups.push({
            sessionId,
            displayName,
            messages
          });
        }

        // Sort groups by latest message id descending (newest chat first)
        finalGroups.sort((a, b) => {
          const aMax = Math.max(...a.messages.map(m => m.id));
          const bMax = Math.max(...b.messages.map(m => m.id));
          return bMax - aMax;
        });

        setGroups(finalGroups);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lịch sử chatbot</h1>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-6 rounded-xl border">
          <Loader2 className="size-4 animate-spin" /> Đang tải lịch sử...
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.sessionId} className="bg-card border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                <div className="font-semibold text-primary">{g.displayName}</div>
                <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">ID: {g.sessionId}</div>
              </div>
              <div className="space-y-3">
                {g.messages.map((m) => (
                  <div key={m.id} className={cn("text-sm p-3.5 rounded-2xl max-w-[85%]", m.role === "human" ? "bg-primary/10 ml-auto border border-primary/20 rounded-br-sm" : "bg-muted border rounded-bl-sm")}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                      {m.role === "human" ? "Người dùng" : "Trợ lý AI"}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-muted-foreground bg-muted p-8 rounded-2xl text-center border">
              Chưa có lịch sử hội thoại nào.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
