import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthContext = {
  supabase: unknown;
  userId: string;
};

/** Admin gerencia tudo; Agente ("user") também opera a Caixa de Entrada. */
async function assertInboxAccess(context: AuthContext) {
  const { userHasRole } = await import("@/lib/roles");
  const client = context.supabase as Parameters<typeof userHasRole>[0];
  const [isAdmin, isAgent] = await Promise.all([
    userHasRole(client, context.userId, "admin"),
    userHasRole(client, context.userId, "user"),
  ]);
  if (!isAdmin && !isAgent) throw new Error("Acesso restrito");
}

/**
 * Envia uma resposta de texto livre para um contato (dentro da janela
 * de 24h) e registra na conversa. Detecta o canal da conversa —
 * WhatsApp, Messenger ou Instagram — e responde pelo canal certo.
 */
export const sendReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { journalistId: string; body: string; channel?: string }) => {
    if (!input?.journalistId || !input?.body?.trim()) {
      throw new Error("journalistId e body são obrigatórios");
    }
    return {
      journalistId: input.journalistId,
      body: input.body.trim(),
      channel: input.channel ?? "whatsapp",
    };
  })
  .handler(async ({ data, context }) => {
    await assertInboxAccess(context as unknown as AuthContext);

    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");

    const { data: journalist, error: journalistError } = await supabase
      .from("journalists")
      .select("phone, messenger_psid, instagram_igsid")
      .eq("id", data.journalistId)
      .single();
    if (journalistError || !journalist) throw new Error("Contato não encontrado");

    const contato = journalist as unknown as {
      phone: string | null;
      messenger_psid: string | null;
      instagram_igsid: string | null;
    };

    let result: { ok: boolean; messageId?: string | undefined; error?: string | undefined };

    if (data.channel === "messenger") {
      if (!contato.messenger_psid) throw new Error("Contato sem identificador do Messenger");
      const { sendMessengerText } = await import("@/lib/facebook.server");
      result = await sendMessengerText({ psid: contato.messenger_psid, body: data.body });
    } else if (data.channel === "instagram") {
      if (!contato.instagram_igsid) throw new Error("Contato sem identificador do Instagram");
      const { sendInstagramText } = await import("@/lib/facebook.server");
      result = await sendInstagramText({ igsid: contato.instagram_igsid, body: data.body });
    } else {
      if (!contato.phone) throw new Error("Contato sem telefone cadastrado");
      const { sendFreeformText } = await import("@/lib/whatsapp.server");
      result = await sendFreeformText({ to: contato.phone, body: data.body });
    }

    if (!result.ok) {
      await supabase.from("conversation_messages").insert({
        journalist_id: data.journalistId,
        channel: data.channel,
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
      channel: data.channel,
      direction: "outbound",
      body: data.body,
      wa_message_id: result.messageId ?? null,
      status: "sent",
    });

    return { ok: true };
  });

/**
 * Marca as mensagens recebidas de um contato como lidas —
 * some com o indicador de "não lida" na lista de conversas.
 */
export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { journalistId: string }) => {
    if (!input?.journalistId) throw new Error("journalistId é obrigatório");
    return { journalistId: input.journalistId };
  })
  .handler(async ({ data, context }) => {
    await assertInboxAccess(context as unknown as AuthContext);
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
    await supabase
      .from("conversation_messages")
      .update({ read_by_admin: true })
      .eq("journalist_id", data.journalistId)
      .eq("direction", "inbound")
      .eq("read_by_admin", false);
    return { ok: true };
  });
