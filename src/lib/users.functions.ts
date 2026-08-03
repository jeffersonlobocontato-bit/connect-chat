import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Gestão de usuários da plataforma. Só administradores acessam.
 * Papéis: "admin" (tudo) e "user" (Agente — Dashboard + Conversas).
 */

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data: isAdmin } = await (
    context.supabase.rpc as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null }>
  )("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Acesso restrito a administradores");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleByUser = new Map<string, string>();
    for (const r of roles ?? []) {
      // admin ganha da role padrão quando as duas existem
      if (r.role === "admin" || !roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);
    }

    return authUsers.users.map((u) => ({
      userId: u.id,
      email: u.email ?? "(sem e-mail)",
      role: roleByUser.get(u.id) ?? "user",
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "admin" | "user" }) => {
    if (!input?.userId || (input.role !== "admin" && input.role !== "user")) {
      throw new Error("userId e role (admin|user) são obrigatórios");
    }
    return { userId: input.userId, role: input.role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("Você não pode rebaixar a própria conta de administrador");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => {
    const email = input?.email?.trim();
    if (!email || !email.includes("@")) throw new Error("Informe um e-mail válido");
    return { email };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invited, error } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (error) throw new Error(error.message);

    if (invited?.user?.id) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: invited.user.id, role: "user" })
        .select();
    }
    return { ok: true };
  });
