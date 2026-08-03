import { createServerFn } from "@tanstack/react-start";
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
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { matchesRules } = await import("@/lib/segments");

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, message_templates(*)")
      .eq("id", data.campaignId)
      .single();
    if (campaignError || !campaign) throw new Error("Campanha não encontrada");
    if (campaign.status === "SENDING" || campaign.status === "SENT") {
      throw new Error("Esta campanha já foi disparada");
    }

    const channel = campaign.channel ?? "whatsapp";

    // Destinatários — mesma base (journalists), telefone ou e-mail conforme o canal.
    let recipients: Array<{
      id: string;
      phone: string;
      name: string;
      email: string | null;
      outlet: string | null;
    }> = [];

    if (campaign.list_id) {
      const { data: members } = await supabase
        .from("contact_list_members")
        .select("journalists(id, name, phone, email, outlet, opt_in, active)")
        .eq("list_id", campaign.list_id);
      recipients = (members ?? [])
        .map((row) => row.journalists)
        .filter((j): j is NonNullable<typeof j> => Boolean(j) && j!.opt_in && j!.active)
        .map((j) => ({ id: j.id, phone: j.phone, name: j.name, email: j.email, outlet: j.outlet }));
    } else if (campaign.segment_id) {
      const { data: segment } = await supabase
        .from("segments")
        .select("rules")
        .eq("id", campaign.segment_id)
        .single();
      const { data: journalists } = await supabase
        .from("journalists")
        .select("id, name, phone, email, outlet, region, tags")
        .eq("active", true)
        .eq("opt_in", true);
      const rules = (segment?.rules ?? []) as never;
      recipients = (journalists ?? [])
        .filter((j) => matchesRules(j, rules))
        .map((j) => ({ id: j.id, phone: j.phone, name: j.name, email: j.email, outlet: j.outlet }));
    }

    // Canal de e-mail só faz sentido para quem tem e-mail cadastrado.
    if (channel === "email") {
      recipients = recipients.filter((r) => Boolean(r.email));
    }

    if (recipients.length === 0) {
      throw new Error(
        channel === "email"
          ? "Nenhum destinatário com e-mail cadastrado e opt-in para este alvo"
          : "Nenhum destinatário com opt-in para este alvo",
      );
    }

    await supabase.from("campaigns").update({ status: "SENDING" }).eq("id", campaign.id);

    const template = campaign.message_templates;

    // Encurta o link do material para medir cliques (comum aos dois canais).
    let linkParaEnvio = campaign.link_url;
    if (campaign.link_url) {
      const { getRequest } = await import("@tanstack/react-start/server");
      const { makeShortCode } = await import("@/lib/whatsapp.server");
      const origin = new URL(getRequest().url).origin;
      const code = makeShortCode();
      const { error: linkError } = await supabase.from("short_links").insert({
        short_code: code,
        original_url: campaign.link_url,
        campaign_id: campaign.id,
      });
      if (!linkError) linkParaEnvio = `${origin}/api/public/r/${code}`;
    }

    let sent = 0;
    let failed = 0;
    let live = false;

    if (channel === "email") {
      const { sendEmail, renderEmailTemplate, isEmailLiveMode } =
        await import("@/lib/email.server");
      live = isEmailLiveMode();

      for (const recipient of recipients) {
        const vars = {
          nome: recipient.name,
          veiculo: recipient.outlet ?? "",
          link: linkParaEnvio ?? "",
        };
        const subject = renderEmailTemplate(template?.subject ?? "Comunicado da AIV", vars);
        const html = renderEmailTemplate(template?.html_body ?? "", vars);

        const result = await sendEmail({ to: recipient.email!, subject, html });
        const now = new Date().toISOString();

        if (result.ok) {
          sent += 1;
          // Sem webhook de bounce/abertura configurado ainda: registramos como enviado.
          await supabase.from("dispatch_logs").insert({
            campaign_id: campaign.id,
            journalist_id: recipient.id,
            email: recipient.email,
            status: "SENT",
            resend_message_id: result.messageId ?? null,
            sent_at: now,
          });
        } else {
          failed += 1;
          await supabase.from("dispatch_logs").insert({
            campaign_id: campaign.id,
            journalist_id: recipient.id,
            email: recipient.email,
            status: "FAILED",
            error_message: result.error ?? "Falha desconhecida",
          });
        }
      }
    } else {
      const { sendWhatsAppMessage, isLiveMode, metaMediaIsFresh, uploadMediaToMeta } =
        await import("@/lib/whatsapp.server");
      live = isLiveMode();

      // Resolve a mídia uma única vez para a campanha inteira: se já tiver um
      // media_id "fresco" na biblioteca, reutiliza; senão sobe pra Meta agora
      // e grava o id pra próxima campanha reaproveitar.
      let resolvedMediaId: string | null = null;
      let resolvedMediaType: string | null = null;
      if (campaign.media_id) {
        const { data: media } = await supabase
          .from("media_library")
          .select("*")
          .eq("id", campaign.media_id)
          .single();

        if (media) {
          resolvedMediaType = media.media_type.toLowerCase();

          if (media.meta_media_id && metaMediaIsFresh(media.meta_media_uploaded_at)) {
            resolvedMediaId = media.meta_media_id;
          } else {
            const uploadResult = await uploadMediaToMeta({
              publicUrl: media.public_url,
              mimeType: media.mime_type,
            });
            if (uploadResult.ok) {
              resolvedMediaId = uploadResult.mediaId;
              await supabase
                .from("media_library")
                .update({
                  meta_media_id: uploadResult.mediaId,
                  meta_media_uploaded_at: new Date().toISOString(),
                })
                .eq("id", media.id);
            } else {
              console.error(`[campanha] upload de mídia falhou: ${uploadResult.error}`);
            }
          }
        }
      }

      for (const recipient of recipients) {
        const result = await sendWhatsAppMessage({
          to: recipient.phone,
          templateName: template?.meta_template_name ?? "sem_template",
          language: template?.language ?? "pt_BR",
          bodyParams: [recipient.name],
          linkUrl: linkParaEnvio,
          mediaId: resolvedMediaId,
          mediaUrl: resolvedMediaId ? null : campaign.media_url,
          mediaType: resolvedMediaType ?? campaign.media_type,
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
    }

    await supabase
      .from("campaigns")
      .update({
        status: failed === recipients.length ? "FAILED" : "SENT",
        sent_at: new Date().toISOString(),
      })
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
