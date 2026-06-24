import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const WEBHOOK = "https://n8n.anduynguyen.id.vn/webhook/b9f19eed-d9b0-4b1b-8921-9b756baa1259/chat";

interface Msg { role: "user" | "assistant"; message: string; }

export function ChatbotWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", message: "Xin chào! Tôi là trợ lý AI của Ngọc Lan Store. Tôi có thể giúp gì cho bạn?" },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", message: text }]);
    setLoading(true);
    const userId = user?.id ?? "guest";
    try {
      await supabase.from("chatbot_history").insert({ user_id: user?.id ?? null, role: "user", message: text });
    } catch {}
    try {
      const res = await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userId }),
      });
      const data = await res.json().catch(() => ({}));
      const reply: string = data.output ?? data.message ?? data.reply ?? data.text ?? "Cảm ơn bạn, tôi sẽ phản hồi sớm.";
      setMsgs((m) => [...m, { role: "assistant", message: reply }]);
      try {
        await supabase.from("chatbot_history").insert({ user_id: user?.id ?? null, role: "assistant", message: reply });
      } catch {}
    } catch {
      setMsgs((m) => [...m, { role: "assistant", message: "Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-all grid place-items-center"
        aria-label="Chatbot"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
      <div
        className={cn(
          "fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 h-[32rem] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all origin-bottom-right",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none",
        )}
      >
        <div className="bg-primary text-primary-foreground px-4 py-3">
          <div className="font-semibold">Trợ lý Ngọc Lan</div>
          <div className="text-xs opacity-80">Hỗ trợ 24/7</div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border rounded-bl-sm",
                )}
              >
                {m.message}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-background border rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm">
                <Loader2 className="size-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="border-t bg-background p-2 flex gap-2"
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập tin nhắn..." disabled={loading} />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
