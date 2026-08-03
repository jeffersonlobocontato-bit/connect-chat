import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSendingMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { isLiveMode } = await import("@/lib/whatsapp.server");
    const { isEmailLiveMode } = await import("@/lib/email.server");
    return { live: isLiveMode(), emailLive: isEmailLiveMode() };
  });

export const dispatchCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => {
    if (!input?.campaignId || typeof input.campaignId !== "string") {
      throw new Error("campaignId inválido");
    }
    return { campaignId: input.campaignId };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { runCampaignDispatch } = await import("@/lib/dispatch-core.server");
    const origin = new URL(getRequest().url).origin;
    return runCampaignDispatch({ campaignId: data.campaignId, origin });
  });

/**
 * Reengajamento: cria uma campanha filha visando só quem não leu/abriu a
 * campanha original, reaproveitando o mesmo template e canal, e dispara na hora.
 */
export const reengageCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => {
    if (!input?.campaignId || typeof input.campaignId !== "string") {
      throw new Error("campaignId inválido");
    }
    return { campaignId: input.campaignId };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
    const { runCampaignDispatch } = await import("@/lib/dispatch-core.server");

    const { data: original, error: originalError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();
    if (originalError || !original) throw new Error("Campanha original não encontrada");
    if (original.status !== "SENT" && original.status !== "FAILED") {
      throw new Error("Só é possível reengajar uma campanha já disparada");
    }

    const { data: logs } = await supabase
      .from("dispatch_logs")
      .select("journalist_id, status")
      .eq("campaign_id", data.campaignId)
      .neq("status", "READ")
      .neq("status", "FAILED");

    const naoLidos = Array.from(
      new Set((logs ?? []).map((l) => l.journalist_id).filter((id): id is string => Boolean(id))),
    );
    if (naoLidos.length === 0) {
      throw new Error("Todo mundo já leu (ou falhou) essa campanha — nada para reengajar");
    }

    const { data: list, error: listError } = await supabase
      .from("contact_lists")
      .insert({ name: `Reengajamento — ${original.name}` })
      .select("id")
      .single();
    if (listError || !list) throw new Error("Falha ao criar a lista de reengajamento");

    await supabase
      .from("contact_list_members")
      .insert(naoLidos.map((journalist_id) => ({ list_id: list.id, journalist_id })));

    const { data: newCampaign, error: newCampaignError } = await supabase
      .from("campaigns")
      .insert({
        name: `${original.name} — reengajamento`,
        channel: original.channel,
        template_id: original.template_id,
        list_id: list.id,
        link_url: original.link_url,
        media_id: original.media_id,
        media_url: original.media_url,
        media_type: original.media_type,
        reengagement_of: original.id,
        status: "DRAFT",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (newCampaignError || !newCampaign)
      throw new Error("Falha ao criar a campanha de reengajamento");

    const origin = new URL(getRequest().url).origin;
    const result = await runCampaignDispatch({ campaignId: newCampaign.id, origin });
    return { ...result, targeted: naoLidos.length };
  });
