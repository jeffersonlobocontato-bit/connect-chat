import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

// Recebe eventos do Resend (delivered, bounced, complained, opened, clicked).
// Configurar em resend.com/webhooks apontando para:
//   https://mensageria.aivozes.com.br/api/public/resend-webhook
// Secret necessário: RESEND_WEBHOOK_SECRET (formato "whsec_...", copiado da
// tela de criação do webhook no Resend).
//
// Resend assina os webhooks no padrão Svix (svix-id / svix-timestamp / svix-signature).

function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifySvixSignature(params: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  body: string;
  svixSignatureHeader: string;
}): Promise<boolean> {
  const secretBytes = base64ToBytes(params.secret.replace(/^whsec_/, ""));
  const signedContent = `${params.svixId}.${params.svixTimestamp}.${params.body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(signature);

  // O header traz uma ou mais assinaturas "v1,<base64>" separadas por espaço.
  return params.svixSignatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean)
    .some((sig) => sig === expected);
}

type ResendEvent = {
  type: string;
  data: {
    email_id?: string;
    click?: { link?: string };
    bounce?: { message?: string };
  };
};

export const Route = createFileRoute("/api/public/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const secret = process.env["RESEND_WEBHOOK_SECRET"];

        const svixId = request.headers.get("svix-id");
        const svixTimestamp = request.headers.get("svix-timestamp");
        const svixSignature = request.headers.get("svix-signature");

        if (secret) {
          if (!svixId || !svixTimestamp || !svixSignature) {
            return new Response(JSON.stringify({ ok: false, error: "Assinatura ausente" }), {
              status: 401,
            });
          }
          const valid = await verifySvixSignature({
            secret,
            svixId,
            svixTimestamp,
            body,
            svixSignatureHeader: svixSignature,
          });
          if (!valid) {
            return new Response(JSON.stringify({ ok: false, error: "Assinatura inválida" }), {
              status: 401,
            });
          }
        } else {
          // Sem RESEND_WEBHOOK_SECRET configurado ainda: aceita sem verificar,
          // só pra não travar setup inicial. Configure a secret assim que possível.
          console.warn(
            "[resend-webhook] RESEND_WEBHOOK_SECRET não configurado — aceitando sem verificar assinatura",
          );
        }

        let event: ResendEvent;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
            status: 400,
          });
        }

        const emailId = event.data?.email_id;
        if (!emailId) return new Response(JSON.stringify({ ok: true }), { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: log } = await supabaseAdmin
          .from("dispatch_logs")
          .select("id, journalist_id, status")
          .eq("resend_message_id", emailId)
          .maybeSingle();

        if (!log) return new Response(JSON.stringify({ ok: true }), { status: 200 });

        const now = new Date().toISOString();

        // Não deixa um evento atrasado regredir um status mais avançado.
        const rank: Record<string, number> = {
          SENT: 0,
          DELIVERED: 1,
          READ: 2,
          FAILED: 2,
        };

        switch (event.type) {
          case "email.delivered": {
            if ((rank[log.status] ?? 0) < (rank["DELIVERED"] ?? 0)) {
              await supabaseAdmin
                .from("dispatch_logs")
                .update({ status: "DELIVERED", delivered_at: now })
                .eq("id", log.id);
            }
            break;
          }
          case "email.opened":
          case "email.clicked": {
            await supabaseAdmin
              .from("dispatch_logs")
              .update({ status: "READ", read_at: now })
              .eq("id", log.id);
            break;
          }
          case "email.bounced":
          case "email.complained": {
            await supabaseAdmin
              .from("dispatch_logs")
              .update({
                status: "FAILED",
                error_message: event.data?.bounce?.message ?? event.type,
              })
              .eq("id", log.id);

            // Supressão automática — protege a reputação do domínio.
            if (log.journalist_id) {
              await supabaseAdmin
                .from("journalists")
                .update({
                  opt_in_email: false,
                  bounced_at: now,
                  bounce_reason: event.data?.bounce?.message ?? event.type,
                })
                .eq("id", log.journalist_id);
            }
            break;
          }
          default:
            break;
        }

        await supabaseAdmin.from("email_events").insert({
          dispatch_log_id: log.id,
          event_type: event.type,
          payload: (event.data ?? {}) as unknown as Json,
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
