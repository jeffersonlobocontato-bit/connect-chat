import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";

type DispatchLogsUpdate = Database["public"]["Tables"]["dispatch_logs"]["Update"];

// Recebe callbacks da Meta Cloud API:
//   GET  -> handshake de verificação do webhook (hub.challenge)
//   POST -> eventos de status de mensagem (sent/delivered/read/failed)
//
// Configurar no Meta Business Manager -> WhatsApp -> Configuration -> Webhook
//   URL: https://<seu-dominio>/api/public/whatsapp-webhook
//   Verify token: o mesmo valor de META_WEBHOOK_VERIFY_TOKEN
//   Campo assinado: messages

const STATUS_MAP: Record<string, string> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const expected = process.env["META_WEBHOOK_VERIFY_TOKEN"];

        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
            status: 400,
          });
        }

        type MetaStatusEvent = {
          id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{ code?: number; title?: string }>;
        };
        type MetaInboundMessage = {
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        };
        type MetaWebhookBody = {
          entry?: Array<{
            changes?: Array<{
              value?: { statuses?: MetaStatusEvent[]; messages?: MetaInboundMessage[] };
            }>;
          }>;
        };
        const entries = (body as MetaWebhookBody)?.entry ?? [];

        for (const entry of entries) {
          for (const change of entry?.changes ?? []) {
            // ------------------------------------------------------------
            // Mensagens recebidas (jornalista respondeu) — caixa de entrada
            // ------------------------------------------------------------
            for (const msg of change?.value?.messages ?? []) {
              if (!msg?.from) continue;

              const { data: journalist } = await supabaseAdmin
                .from("journalists")
                .select("id")
                .eq("phone", msg.from)
                .maybeSingle();

              // Mensagem de um número que não está na base — registramos
              // ignorando por enquanto (não criamos jornalista automaticamente
              // pra não poluir a base com números desconhecidos).
              if (!journalist) continue;

              await supabaseAdmin.from("conversation_messages").insert({
                journalist_id: journalist.id,
                channel: "whatsapp",
                direction: "inbound",
                body: msg.text?.body ?? `[${msg.type ?? "mídia"} recebido]`,
                wa_message_id: msg.id ?? null,
                status: "received",
              });
            }

            const statuses = change?.value?.statuses ?? [];

            for (const s of statuses) {
              const waMessageId = s?.id;
              const newStatus = STATUS_MAP[s?.status as string];
              if (!waMessageId || !newStatus) continue;

              type DispatchLogUpdate = {
                status: string;
                delivered_at?: string;
                read_at?: string;
                error_code?: string | null;
                error_message?: string | null;
              };
              const update: DispatchLogUpdate = { status: newStatus };
              const ts = s?.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : null;

              // Nunca regride um status (ex: um evento "sent" atrasado não pode
              // sobrescrever um "read" que já chegou antes).
              const rank: Record<string, number> = {
                QUEUED: 0,
                SENT: 1,
                DELIVERED: 2,
                READ: 3,
                FAILED: 3,
              };

              if (newStatus === "DELIVERED" && ts) update.delivered_at = ts;
              if (newStatus === "READ" && ts) update.read_at = ts;
              if (newStatus === "FAILED") {
                update.error_code = s?.errors?.[0]?.code ? String(s.errors[0].code) : null;
                update.error_message = s?.errors?.[0]?.title ?? "Falha reportada pela Meta";
              }

              const { data: current } = await supabaseAdmin
                .from("dispatch_logs")
                .select("id, status")
                .eq("wa_message_id", waMessageId)
                .maybeSingle();

              if (current) {
                if ((rank[current.status] ?? 0) <= (rank[newStatus] ?? 0)) {
                  // `error_code` só entra nos tipos gerados do Supabase depois que a
                  // migração 20260802020000 rodar e os tipos forem regenerados pelo Lovable.
                  // Cast necessário só até lá — remova depois que os tipos forem regenerados.
                  await supabaseAdmin
                    .from("dispatch_logs")
                    .update(update as unknown as DispatchLogsUpdate)
                    .eq("id", current.id);
                }
                continue;
              }

              // Não achou em dispatch_logs — pode ser uma resposta manual enviada
              // pela caixa de entrada (conversation_messages).
              await supabaseAdmin
                .from("conversation_messages")
                .update({ status: newStatus.toLowerCase() })
                .eq("wa_message_id", waMessageId);
            }
          }
        }

        // A Meta exige 200 rápido, mesmo se nada relevante tiver sido encontrado.
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
