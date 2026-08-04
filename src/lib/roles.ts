// Checagem de papel do usuário logado.
//
// A função `has_role` vive no schema `private` (fora da API pública), então
// não é chamável por RPC. Aqui consultamos a tabela `user_roles` com o
// cliente autenticado — a política de RLS já garante que cada usuário só
// enxerga os próprios papéis.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type RoleClient = { from: (table: string) => any };

export async function userHasRole(
  supabase: RoleClient,
  userId: string,
  role: "admin" | "user",
): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return Boolean(data);
}
