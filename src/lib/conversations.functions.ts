import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Envia uma resposta de texto livre para um jornalista (dentro da janela
 * de 24h) e registra na conversa. Diferente de campanhas, isso não passa
 * por template — é conversa direta.
 */
export const sendReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { journalistId: string; body: string }) => {
    if (!input?.journalistId || !input?.body?.trim()) {
      throw new Error("journalistId e body são obrigatórios");
    }
    return { journalistId: input.journalistId, body: input.body.trim() };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
    const { sendFreeformText } = await import("@/lib/whatsapp.server");

    const { data: journalist, error: journalistError } = await supabase
      .from("journalists")
      .select("phone")
      .eq("id", data.journalistId)
      .single();
    if (journalistError || !journalist) throw new Error("Jornalista não encontrado");

    const result = await sendFreeformText({ to: journalist.phone, body: data.body });

    if (!result.ok) {
      await supabase.from("conversation_messages").insert({
        journalist_id: data.journalistId,
        direction: "outbound",
        body: data.body,
        status: "failed",
      });
      throw new Error(
        result.error?.includes("131047") || result.error?.includes("24")
          ? "Fora da janela de 24h de conversa — a Meta só permite texto livre até 24h após a última mensagem recebida desse contato."
          : `Falha ao enviar: ${result.error}`,
      );
    }

    await supabase.from("conversation_messages").insert({
      journalist_id: data.journalistId,
      direction: "outbound",
      body: data.body,
      wa_message_id: result.messageId ?? null,
      status: "sent",
    });

    return { ok: true };
  });

/**
 * Marca as mensagens recebidas de um jornalista como lidas pelo admin —
 * some com o indicador de "não lida" na lista de conversas.
 */
export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { journalistId: string }) => {
    if (!input?.journalistId) throw new Error("journalistId é obrigatório");
    return { journalistId: input.journalistId };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
    await supabase
      .from("conversation_messages")
      .update({ read_by_admin: true })
      .eq("journalist_id", data.journalistId)
      .eq("direction", "inbound")
      .eq("read_by_admin", false);
    return { ok: true };
  });
