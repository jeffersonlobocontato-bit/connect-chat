import { createFileRoute } from "@tanstack/react-router";

// Expurga logs operacionais antigos — princípio de minimização/retenção da
// LGPD: não faz sentido guardar log de entrega de campanha indefinidamente.
//
// NÃO apaga:
//   - journalists (cadastro em si, incluindo prova de consentimento)
//   - conversation_messages (histórico de relacionamento — valor de negócio
//     contínuo, retenção decidida à parte se um dia for necessário)
//
// Apaga (configurável via env, padrão 365 dias):
//   - dispatch_logs (log de envio de campanha)
//   - email_events (eventos de webhook do Resend)
//
// Configurar o mesmo cron externo do /api/cron/run-scheduled pra chamar
// esta rota também, ex: uma vez por dia.
//   curl -X POST https://mensageria.aivozes.com.br/api/public/data-retention \
//        -H "x-cron-secret: <CRON_SECRET>"

function getRetentionDays(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const Route = createFileRoute("/api/public/data-retention")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        if (!expected) {
          return new Response(JSON.stringify({ ok: false, error: "CRON_SECRET não configurado" }), {
            status: 500,
          });
        }
        if (request.headers.get("x-cron-secret") !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "Não autorizado" }), {
            status: 401,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const dispatchLogsDays = getRetentionDays("RETENTION_DISPATCH_LOGS_DAYS", 365);
        const emailEventsDays = getRetentionDays("RETENTION_EMAIL_EVENTS_DAYS", 365);

        const dispatchLogsCutoff = new Date(
          Date.now() - dispatchLogsDays * 24 * 60 * 60 * 1000,
        ).toISOString();
        const emailEventsCutoff = new Date(
          Date.now() - emailEventsDays * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { error: dispatchLogsError, count: dispatchLogsDeleted } = await supabaseAdmin
          .from("dispatch_logs")
          .delete({ count: "exact" })
          .lt("created_at", dispatchLogsCutoff);

        const { error: emailEventsError, count: emailEventsDeleted } = await supabaseAdmin
          .from("email_events")
          .delete({ count: "exact" })
          .lt("created_at", emailEventsCutoff);

        return new Response(
          JSON.stringify({
            ok: true,
            dispatch_logs: {
              deleted: dispatchLogsDeleted ?? 0,
              error: dispatchLogsError?.message ?? null,
            },
            email_events: {
              deleted: emailEventsDeleted ?? 0,
              error: emailEventsError?.message ?? null,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
