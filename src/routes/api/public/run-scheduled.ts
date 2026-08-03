import { createFileRoute } from "@tanstack/react-router";

// Processa campanhas com status=SCHEDULED cujo scheduled_at já passou.
// TanStack Start não tem cron nativo — configure um cron externo (ex:
// cron-job.org, GitHub Actions scheduled workflow) pra chamar esta rota
// a cada poucos minutos, ex:
//
//   curl -X POST https://mensageria.aivozes.com.br/api/public/run-scheduled \
//        -H "x-cron-secret: <CRON_SECRET>"
//
// Protegida por CRON_SECRET — sem essa env configurada, a rota recusa tudo.

export const Route = createFileRoute("/api/public/run-scheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCronRequest } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCronRequest(request)) {
          return new Response(JSON.stringify({ ok: false, error: "Não autorizado" }), {
            status: 401,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runCampaignDispatch } = await import("@/lib/dispatch-core.server");

        const { data: due } = await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("status", "SCHEDULED")
          .lte("scheduled_at", new Date().toISOString());

        const origin = new URL(request.url).origin;
        const results: Array<{ campaignId: string; ok: boolean; error?: string }> = [];

        for (const campaign of due ?? []) {
          try {
            await runCampaignDispatch({ campaignId: campaign.id, origin });
            results.push({ campaignId: campaign.id, ok: true });
          } catch (error) {
            results.push({
              campaignId: campaign.id,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
