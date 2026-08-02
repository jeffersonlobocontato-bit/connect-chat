import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSendingMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { isLiveMode } = await import("@/lib/whatsapp.server");
    return { live: isLiveMode() };
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
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { matchesRules } = await import("@/lib/segments");
    const { sendWhatsAppMessage, isLiveMode } = await import("@/lib/whatsapp.server");

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, message_templates(*)")
      .eq("id", data.campaignId)
      .single();
    if (campaignError || !campaign) throw new Error("Campanha não encontrada");
    if (campaign.status === "SENDING" || campaign.status === "SENT") {
      throw new Error("Esta campanha já foi disparada");
    }

    // Destinatários
    let recipients: Array<{ id: string; phone: string; name: string }> = [];

    if (campaign.list_id) {
      const { data: members } = await supabase
        .from("contact_list_members")
        .select("journalists(id, name, phone, opt_in, active)")
        .eq("list_id", campaign.list_id);
      recipients = (members ?? [])
        .map((row) => row.journalists)
        .filter((j): j is NonNullable<typeof j> => Boolean(j) && j!.opt_in && j!.active)
        .map((j) => ({ id: j.id, phone: j.phone, name: j.name }));
    } else if (campaign.segment_id) {
      const { data: segment } = await supabase
        .from("segments")
        .select("rules")
        .eq("id", campaign.segment_id)
        .single();
      const { data: journalists } = await supabase
        .from("journalists")
        .select("id, name, phone, outlet, region, tags")
        .eq("active", true)
        .eq("opt_in", true);
      const rules = (segment?.rules ?? []) as never;
      recipients = (journalists ?? [])
        .filter((j) => matchesRules(j, rules))
        .map((j) => ({ id: j.id, phone: j.phone, name: j.name }));
    }

    if (recipients.length === 0) {
      throw new Error("Nenhum destinatário com opt-in para este alvo");
    }

    await supabase.from("campaigns").update({ status: "SENDING" }).eq("id", campaign.id);

    const template = campaign.message_templates;
    const live = isLiveMode();
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const result = await sendWhatsAppMessage({
        to: recipient.phone,
        templateName: template?.meta_template_name ?? "sem_template",
        language: template?.language ?? "pt_BR",
        bodyParams: [recipient.name],
        linkUrl: campaign.link_url,
        mediaUrl: campaign.media_url,
        mediaType: campaign.media_type,
      });

      const now = new Date().toISOString();
      if (result.ok) {
        sent += 1;
        // Em modo simulado não há webhook da Meta: geramos entrega e leitura.
        const simulatedRead = !live && Math.random() < 0.62;
        await supabase.from("dispatch_logs").insert({
          campaign_id: campaign.id,
          journalist_id: recipient.id,
          phone: recipient.phone,
          status: live ? "SENT" : simulatedRead ? "READ" : "DELIVERED",
          wa_message_id: result.messageId ?? null,
          sent_at: now,
          delivered_at: live ? null : now,
          read_at: !live && simulatedRead ? now : null,
        });
      } else {
        failed += 1;
        await supabase.from("dispatch_logs").insert({
          campaign_id: campaign.id,
          journalist_id: recipient.id,
          phone: recipient.phone,
          status: "FAILED",
          error_message: result.error ?? "Falha desconhecida",
        });
      }
    }

    await supabase
      .from("campaigns")
      .update({ status: failed === recipients.length ? "FAILED" : "SENT", sent_at: new Date().toISOString() })
      .eq("id", campaign.id);

    if (template) {
      await supabase
        .from("message_templates")
        .update({
          usage_count: (template.usage_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", template.id);
    }

    return { total: recipients.length, sent, failed, live };
  });
