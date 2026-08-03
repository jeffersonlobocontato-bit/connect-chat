// Núcleo do disparo de campanha — usado por três entradas:
//   1. dispatchCampaign (server fn, disparo manual pelo painel)
//   2. a rota de cron que processa campanhas agendadas
//   3. reengageCampaign (recria uma campanha filha só para quem não leu)
//
// Sempre roda com o cliente admin (service role) — a checagem de permissão
// acontece antes de chamar esta função em cada uma das três entradas.

export type DispatchResult = { total: number; sent: number; failed: number; live: boolean };

export async function runCampaignDispatch(params: {
  campaignId: string;
  origin: string;
}): Promise<DispatchResult> {
  const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
  const { matchesRules } = await import("@/lib/segments");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*, message_templates(*)")
    .eq("id", params.campaignId)
    .single();
  if (campaignError || !campaign) throw new Error("Campanha não encontrada");
  if (campaign.status === "SENDING" || campaign.status === "SENT") {
    throw new Error("Esta campanha já foi disparada");
  }

  const channel = campaign.channel ?? "whatsapp";
  const audience = (campaign as { audience?: string }).audience ?? "press";
  const optInField = channel === "email" ? "opt_in_email" : "opt_in_whatsapp";

  type Recipient = {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    outlet: string | null;
  };
  type JournalistRow = Recipient & {
    active: boolean;
    audience: string | null;
    opt_in_whatsapp: boolean;
    opt_in_email: boolean;
  };
  let recipients: Recipient[] = [];

  if (campaign.list_id) {
    const { data: members } = await supabase
      .from("contact_list_members")
      .select(
        "journalists(id, name, phone, email, outlet, active, audience, opt_in_whatsapp, opt_in_email)",
      )
      .eq("list_id", campaign.list_id);
    recipients = (members ?? [])
      .map((row) => row.journalists as unknown as JournalistRow | null)
      .filter((j): j is JournalistRow => {
        if (!j || !j.active) return false;
        if (audience !== "all" && (j.audience ?? "press") !== audience) return false;
        return channel === "email" ? j.opt_in_email : j.opt_in_whatsapp;
      })
      .map((j) => ({ id: j.id, phone: j.phone, name: j.name, email: j.email, outlet: j.outlet }));
  } else if (campaign.segment_id) {
    const { data: segment } = await supabase
      .from("segments")
      .select("rules, audience")
      .eq("id", campaign.segment_id)
      .single();

    // O público do segmento manda: uma campanha "ambos" com segmento de leads
    // continua falando só com leads.
    const segmentAudience = (segment as { audience?: string } | null)?.audience ?? null;
    const effectiveAudience = segmentAudience ?? (audience === "all" ? null : audience);

    // PostgREST devolve no máximo 1.000 linhas por requisição — pagina até o fim.
    const pageSize = 1000;
    type SegmentRow = {
      id: string;
      name: string;
      phone: string;
      email: string | null;
      outlet: string | null;
      region: string | null;
      tags: string[] | null;
      company: string | null;
      source: string | null;
      stage: string | null;
    };
    const todos: SegmentRow[] = [];
    for (let page = 0; ; page += 1) {
      let query = supabase
        .from("journalists")
        .select("id, name, phone, email, outlet, region, tags, company, source, stage")
        .eq("active", true)
        .eq(optInField, true);
      if (effectiveAudience) query = query.eq("audience", effectiveAudience);
      const { data, error } = await query
        .order("id")
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error || !data || data.length === 0) break;
      todos.push(...(data as unknown as SegmentRow[]));
      if (data.length < pageSize) break;
    }

    const rules = ((segment?.rules ?? []) as unknown) as never;
    recipients = todos
      .filter((j) => matchesRules(j, rules))
      .map((j) => ({ id: j.id, phone: j.phone, name: j.name, email: j.email, outlet: j.outlet }));
  }

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

  // Trava de segurança pro plano do Resend: evita estourar o teto diário
  // no meio de um disparo (o Resend simplesmente bloqueia o resto sem aviso).
  if (channel === "email") {
    const { getEmailDailyLimit } = await import("@/lib/email.server");
    const limit = getEmailDailyLimit();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: sentToday } = await supabase
      .from("dispatch_logs")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null)
      .gte("sent_at", startOfDay.toISOString());

    const jaEnviados = sentToday ?? 0;
    if (jaEnviados + recipients.length > limit) {
      throw new Error(
        `Essa campanha enviaria ${recipients.length} e-mails, mas o plano atual do Resend permite só ${limit}/dia (${jaEnviados} já enviados hoje). Reduza o público ou aguarde o próximo dia — ou avise que o plano foi atualizado para elevar o limite.`,
      );
    }
  }

  await supabase.from("campaigns").update({ status: "SENDING" }).eq("id", campaign.id);

  const template = campaign.message_templates;

  // Encurta o link do material para medir cliques (comum aos dois canais).
  let linkParaEnvio = campaign.link_url;
  if (campaign.link_url) {
    const { makeShortCode } = await import("@/lib/whatsapp.server");
    const code = makeShortCode();
    const { error: linkError } = await supabase.from("short_links").insert({
      short_code: code,
      original_url: campaign.link_url,
      campaign_id: campaign.id,
    });
    if (!linkError) linkParaEnvio = `${params.origin}/api/public/r/${code}`;
  }

  let sent = 0;
  let failed = 0;
  let live = false;

  if (channel === "email") {
    const {
      sendEmail,
      renderEmailTemplate,
      appendUnsubscribeFooter,
      prependBrandHeader,
      isEmailLiveMode,
    } = await import("@/lib/email.server");
    const { generateUnsubscribeToken } = await import("@/lib/unsubscribe.server");
    live = isEmailLiveMode();

    for (const recipient of recipients) {
      const unsubscribeToken = await generateUnsubscribeToken(recipient.id);
      const unsubscribeUrl = `${params.origin}/api/public/unsubscribe/${unsubscribeToken}`;

      const vars = {
        nome: recipient.name,
        veiculo: recipient.outlet ?? "",
        link: linkParaEnvio ?? "",
        unsubscribe_link: unsubscribeUrl,
      };
      // Corpo montado pela IA (a partir da matéria publicada) tem prioridade
      // sobre o template — e o template só entra se tiver conteúdo de fato.
      const campanhaHtml = (campaign as { email_html?: string | null }).email_html ?? null;
      const campanhaSubject = (campaign as { email_subject?: string | null }).email_subject ?? null;
      const templateHtml = template?.html_body?.trim() ? template.html_body : null;
      const corpoBruto = campanhaHtml?.trim()
        ? campanhaHtml
        : (templateHtml ??
          `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <p style="font-size:15px;color:#334155">Olá, {{nome}},</p>
  <p style="font-size:15px;color:#334155">Segue material para pauta.</p>
  ${linkParaEnvio ? `<p><a href="{{link}}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0f2c5c;color:#ffffff;text-decoration:none;font-weight:600">Acessar o material</a></p>` : ""}
</div>`);
      const subject = renderEmailTemplate(
        campanhaSubject?.trim() || template?.subject || campaign.name || "Comunicado da Agência de Inteligência Vozes",
        vars,
      );
      const htmlBase = renderEmailTemplate(corpoBruto, vars);
      const html = appendUnsubscribeFooter(prependBrandHeader(htmlBase), unsubscribeUrl);

      const result = await sendEmail({ to: recipient.email!, subject, html, unsubscribeUrl });
      const now = new Date().toISOString();

      if (result.ok) {
        sent += 1;
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
}
