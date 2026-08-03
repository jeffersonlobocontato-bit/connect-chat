import { createFileRoute } from "@tanstack/react-router";

// Webhook do Messenger e do Instagram Direct.
// Só recebe mensagens (inbound) — resposta sai pela Caixa de Entrada.
// Configure na Meta: campos "messages" das páginas Facebook/Instagram,
// apontando para https://mensageria.aivozes.com.br/api/public/meta-social-webhook

type SocialMessagingEvent = {
  sender?: { id?: string };
  message?: { mid?: string; text?: string; attachments?: unknown[] };
};
type SocialWebhookBody = {
  object?: string;
  entry?: Array<{ messaging?: SocialMessagingEvent[] }>;
};

export const Route = createFileRoute("/api/public/meta-social-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env["META_WEBHOOK_VERIFY_TOKEN"];

        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false }), { status: 400 });
        }

        const payload = body as SocialWebhookBody;
        // "instagram" quando vem do Direct; "page" quando vem do Messenger.
        const channel = payload.object === "instagram" ? "instagram" : "messenger";
        const idColumn = channel === "instagram" ? "instagram_igsid" : "messenger_psid";

        for (const entry of payload.entry ?? []) {
          for (const event of entry.messaging ?? []) {
            const senderId = event.sender?.id;
            if (!senderId || !event.message) continue;

            const { data: contato } = await supabaseAdmin
              .from("journalists")
              .select("id")
              .eq(idColumn, senderId)
              .maybeSingle();

            // Contato desconhecido: não criamos cadastro automático pra não
            // poluir a base — o identificador precisa ser vinculado na ficha.
            if (!contato) continue;

            const texto = event.message.text ?? "[mídia recebida]";

            await supabaseAdmin.from("conversation_messages").insert({
              journalist_id: contato.id,
              channel,
              direction: "inbound",
              body: texto,
              wa_message_id: event.message.mid ?? null,
              status: "received",
            });

            if (event.message.text) {
              const { applyAutoTags } = await import("@/lib/auto-tag.server");
              await applyAutoTags({ journalistId: contato.id, text: event.message.text });
            }
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
