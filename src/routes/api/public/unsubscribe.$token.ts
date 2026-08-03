import { createFileRoute } from "@tanstack/react-router";

const CONFIRMATION_PAGE = (message: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Descadastro — AIV</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0A2540; color: #fff; display: flex;
         align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; color: #0A2540; padding: 2rem; border-radius: 12px; max-width: 420px;
          text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <h1 style="font-size:1.2rem;">${message}</h1>
  </div>
</body>
</html>`;

export const Route = createFileRoute("/api/public/unsubscribe/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { verifyUnsubscribeToken } = await import("@/lib/unsubscribe.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const journalistId = await verifyUnsubscribeToken(params.token);
        if (!journalistId) {
          return new Response(CONFIRMATION_PAGE("Link de descadastro inválido ou expirado."), {
            status: 400,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        await supabaseAdmin
          .from("journalists")
          .update({ opt_in_email: false })
          .eq("id", journalistId);

        return new Response(
          CONFIRMATION_PAGE(
            "Você não receberá mais e-mails da AIV. Se mudar de ideia, é só pedir pra ser recadastrado.",
          ),
          { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      },
      // Suporte a List-Unsubscribe-Post (one-click), que alguns clientes de e-mail usam via POST.
      POST: async ({ params }) => {
        const { verifyUnsubscribeToken } = await import("@/lib/unsubscribe.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const journalistId = await verifyUnsubscribeToken(params.token);
        if (!journalistId) return new Response(null, { status: 400 });

        await supabaseAdmin
          .from("journalists")
          .update({ opt_in_email: false })
          .eq("id", journalistId);
        return new Response(null, { status: 200 });
      },
    },
  },
});
