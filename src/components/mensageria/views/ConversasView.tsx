import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendReply, markConversationRead } from "@/lib/conversations.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "../ui-bits";

type Message = {
  id: string;
  journalist_id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  created_at: string;
};

type JournalistLite = { id: string; name: string; outlet: string | null; phone: string };

type ConversationSummary = {
  journalist: JournalistLite;
  lastMessage: Message;
  unreadCount: number;
};

export function ConversasView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [journalists, setJournalists] = useState<Record<string, JournalistLite>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const enviarResposta = useServerFn(sendReply);
  const marcarLida = useServerFn(markConversationRead);

  async function carregar() {
    const { data } = await supabase
      .from("conversation_messages")
      .select("id, journalist_id, direction, body, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setMessages((data ?? []) as Message[]);

    const ids = Array.from(new Set((data ?? []).map((m) => m.journalist_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: js } = await supabase
        .from("journalists")
        .select("id, name, outlet, phone")
        .in("id", ids as string[]);
      const map: Record<string, JournalistLite> = {};
      for (const j of js ?? []) map[j.id] = j;
      setJournalists(map);
    }
  }

  useEffect(() => {
    void carregar();
    // Poll simples a cada 15s — sem depender de realtime configurado.
    const interval = setInterval(() => void carregar(), 15000);
    return () => clearInterval(interval);
  }, []);

  const conversations: ConversationSummary[] = useMemo(() => {
    const byJournalist = new Map<string, Message[]>();
    for (const m of messages) {
      if (!m.journalist_id) continue;
      const list = byJournalist.get(m.journalist_id) ?? [];
      list.push(m);
      byJournalist.set(m.journalist_id, list);
    }
    const result: ConversationSummary[] = [];
    for (const [journalistId, list] of byJournalist) {
      const journalist = journalists[journalistId];
      if (!journalist) continue;
      const sorted = [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const unreadCount = list.filter(
        (m) => m.direction === "inbound" && m.status === "received",
      ).length;
      result.push({ journalist, lastMessage: sorted[0]!, unreadCount });
    }
    return result.sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
    );
  }, [messages, journalists]);

  const thread = useMemo(
    () =>
      messages
        .filter((m) => m.journalist_id === selectedId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages, selectedId],
  );

  async function abrirConversa(journalistId: string) {
    setSelectedId(journalistId);
    await marcarLida({ data: { journalistId } });
    void carregar();
  }

  async function enviar() {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      await enviarResposta({ data: { journalistId: selectedId, body: reply.trim() } });
      setReply("");
      void carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar resposta");
    } finally {
      setSending(false);
    }
  }

  const selecionado = selectedId ? journalists[selectedId] : null;

  return (
    <div>
      <PageHeader
        title="Conversas"
        subtitle="Respostas dos jornalistas ao WhatsApp da AIV, em um só lugar."
      />

      {conversations.length === 0 ? (
        <EmptyState message="Nenhuma conversa ainda. Assim que um jornalista responder, ela aparece aqui." />
      ) : (
        <div className="grid gap-4 rounded-xl border border-border bg-card md:grid-cols-[300px_1fr]">
          <div className="max-h-[70vh] overflow-y-auto border-b border-border md:border-b-0 md:border-r">
            {conversations.map((c) => (
              <button
                key={c.journalist.id}
                onClick={() => void abrirConversa(c.journalist.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition hover:bg-muted ${
                  selectedId === c.journalist.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{c.journalist.name}</span>
                  {c.unreadCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {c.lastMessage.direction === "outbound" ? "Você: " : ""}
                  {c.lastMessage.body}
                </span>
              </button>
            ))}
          </div>

          <div className="flex min-h-[50vh] flex-col">
            {!selecionado ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <MessageCircle className="mr-2 h-4 w-4" />
                Selecione uma conversa
              </div>
            ) : (
              <>
                <div className="border-b border-border px-4 py-3">
                  <div className="text-sm font-medium">{selecionado.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selecionado.outlet ?? ""} · {selecionado.phone}
                  </div>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === "outbound"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {m.body}
                      <div
                        className={`mt-1 text-[10px] ${
                          m.direction === "outbound"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-2 border-t border-border p-3">
                  <Textarea
                    rows={2}
                    placeholder="Escreva uma resposta..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void enviar();
                      }
                    }}
                  />
                  <Button onClick={enviar} disabled={sending || !reply.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                  Só é possível responder em texto livre até 24h após a última mensagem recebida.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
