/**
 * Autorização das rotas de cron (`/api/public/*`).
 *
 * Aceita duas formas:
 *  1. Header `x-cron-secret` igual a CRON_SECRET — usado por cron externo.
 *  2. Header `apikey` igual à chave publicável do backend — usado pelo
 *     agendador interno (pg_cron + pg_net), que não tem acesso ao cofre
 *     de segredos da aplicação.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env["CRON_SECRET"];
  const headerSecret = request.headers.get("x-cron-secret");
  if (cronSecret && headerSecret && headerSecret === cronSecret) return true;

  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  const apikey = request.headers.get("apikey");
  if (publishableKey && apikey && apikey === publishableKey) return true;

  return false;
}
