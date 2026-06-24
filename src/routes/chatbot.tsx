import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot } from "lucide-react";
import { UserLayout } from "@/components/layout/UserLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { ChatbotMessage } from "@/lib/db-types";

const WEBHOOK = "https://n8n.anduynguyen.id.vn/webhook/b9f19eed-d9b0-4b1b-8921-9b756baa1259/chat";

export const Route = createFileRoute("/chatbot")({
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatbotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (user?.id) {
      setSessionId(user.id);
    } else {
      let sid = localStorage.getItem("chatbot_session_id");
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem("chatbot_session_id", sid);
      }
      setSessionId(sid);
    }
  }, [user]);

  useEffect(() => {
    // History is now managed by n8n, frontend does not fetch it directly in this view
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const message = input.trim();
    if (!message) return;
    
    if (!sessionId) {
      throw new Error("Không xác định được sessionId cho cuộc trò chuyện");
    }

    if (loading) return;
    setInput("");
    const userMsg: ChatbotMessage = { id: crypto.randomUUID(), user_id: user?.id ?? null, role: "user", message, created_at: new Date().toISOString() };
    setMsgs((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sendMessage", chatInput: message, sessionId }) });
      const data = await res.json().catch(() => ({}));
      const reply: string = data.output ?? data.message ?? data.reply ?? data.text ?? "Đã nhận được tin nhắn của bạn.";
      const aiMsg: ChatbotMessage = { id: crypto.randomUUID(), user_id: user?.id ?? null, role: "assistant", message: reply, created_at: new Date().toISOString() };
      setMsgs((m) => [...m, aiMsg]);
    } catch {
      setMsgs((m) => [...m, { id: crypto.randomUUID(), user_id: user?.id ?? null, role: "assistant", message: "Đã có lỗi, vui lòng thử lại.", created_at: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  return (
    <UserLayout>
      <div className="container-px mx-auto max-w-3xl py-8">
        <div className="bg-card border rounded-2xl overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
          <div className="px-6 py-4 border-b bg-secondary text-secondary-foreground flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary grid place-items-center"><Bot className="size-5 text-primary-foreground" /></div>
            <div>
              <div className="font-bold">Trợ lý Ngọc Lan</div>
              <div className="text-xs opacity-70">AI hỗ trợ 24/7</div>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/30">
            {msgs.length === 0 && (
              <div className="text-center text-muted-foreground py-10">Bắt đầu trò chuyện với trợ lý AI...</div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border rounded-bl-sm")}>
                  {m.message}
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-background border rounded-2xl px-4 py-2.5"><Loader2 className="size-4 animate-spin text-primary" /></div></div>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t flex gap-2 bg-background">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập tin nhắn..." disabled={loading} />
            <Button type="submit" disabled={loading || !input.trim()}><Send className="size-4" /></Button>
          </form>
        </div>
      </div>
    </UserLayout>
  );
}
