// Adaptador de envio de WhatsApp.
// Enquanto as credenciais da Meta não existirem, roda em modo simulado.

export type SendResult = {
  ok: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
};

export function isLiveMode(): boolean {
  return Boolean(process.env["META_WHATSAPP_TOKEN"] && process.env["META_PHONE_NUMBER_ID"]);
}

export type OutboundMessage = {
  to: string;
  templateName: string;
  language: string;
  bodyParams: string[];
  linkUrl?: string | null | undefined;
  mediaUrl?: string | null | undefined;
  mediaId?: string | null | undefined;
  mediaType?: string | null | undefined;
};

export async function sendWhatsAppMessage(message: OutboundMessage): Promise<SendResult> {
  if (!isLiveMode()) {
    // Modo simulado: não chama a Meta, apenas devolve um id fictício.
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true, messageId: `sim_${crypto.randomUUID()}` };
  }

  const token = process.env["META_WHATSAPP_TOKEN"]!;
  const phoneNumberId = process.env["META_PHONE_NUMBER_ID"]!;
  const version = process.env["META_API_VERSION"] || "v21.0";

  const components: Array<Record<string, unknown>> = [];

  // Preferimos media_id (arquivo já hospedado na Meta) a um link — mais
  // rápido e mais confiável em disparo de volume, é o padrão recomendado
  // pela própria Meta para notificações em massa.
  if (message.mediaType && (message.mediaId || message.mediaUrl)) {
    const mediaKey =
      message.mediaType === "video"
        ? "video"
        : message.mediaType === "document"
          ? "document"
          : "image";
    components.push({
      type: "header",
      parameters: [
        {
          type: mediaKey,
          [mediaKey]: message.mediaId ? { id: message.mediaId } : { link: message.mediaUrl },
        },
      ],
    });
  }

  const bodyParams = [...message.bodyParams];
  if (message.linkUrl) bodyParams.push(message.linkUrl);
  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to,
          type: "template",
          template: {
            name: message.templateName,
            language: { code: message.language },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      console.error(`[whatsapp] envio falhou [${response.status}]: ${text}`);
      return { ok: false, error: `[${response.status}] ${text}` };
    }

    const payload = JSON.parse(text) as { messages?: Array<{ id: string }> };
    return { ok: true, messageId: payload.messages?.[0]?.id };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error(`[whatsapp] erro de rede: ${messageText}`);
    return { ok: false, error: messageText };
  }
}

export function makeShortCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Envia texto livre (sem template) — só funciona dentro da janela de 24h
 * desde a última mensagem recebida daquele contato (regra da própria Meta
 * pra evitar spam fora de uma conversa em andamento). Usado pela caixa de
 * entrada, nunca por campanhas em massa.
 */
export async function sendFreeformText(params: { to: string; body: string }): Promise<SendResult> {
  if (!isLiveMode()) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true, messageId: `sim_reply_${crypto.randomUUID()}` };
  }

  const token = process.env["META_WHATSAPP_TOKEN"]!;
  const phoneNumberId = process.env["META_PHONE_NUMBER_ID"]!;
  const version = process.env["META_API_VERSION"] || "v21.0";

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.to,
          type: "text",
          text: { body: params.body },
        }),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      console.error(`[whatsapp] resposta falhou [${response.status}]: ${text}`);
      // Erro mais comum aqui: fora da janela de 24h — a Meta recusa texto
      // livre e exige um template pago nesse caso.
      return { ok: false, error: `[${response.status}] ${text}` };
    }

    const payload = JSON.parse(text) as { messages?: Array<{ id: string }> };
    return { ok: true, messageId: payload.messages?.[0]?.id };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error(`[whatsapp] erro de rede na resposta: ${messageText}`);
    return { ok: false, error: messageText };
  }
}

// Mídia uploadada na Meta fica disponível por cerca de 30 dias (política da
// própria Meta, sem garantia de prazo fixo). Reenviamos com folga antes disso.
const META_MEDIA_MAX_AGE_MS = 25 * 24 * 60 * 60 * 1000;

export function metaMediaIsFresh(uploadedAt: string | null): boolean {
  if (!uploadedAt) return false;
  return Date.now() - new Date(uploadedAt).getTime() < META_MEDIA_MAX_AGE_MS;
}

/**
 * Sobe um arquivo (a partir da URL pública no Storage) para o endpoint de
 * mídia da Meta e devolve o media_id. Esse ID pode ser reutilizado em
 * quantos envios forem necessários enquanto estiver "fresco" — é o jeito
 * recomendado pela Meta para disparo em volume, em vez de mandar o link
 * público em cada mensagem (que faz a Meta rebaixar o arquivo a cada envio).
 */
export async function uploadMediaToMeta(params: {
  publicUrl: string;
  mimeType: string;
}): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  if (!isLiveMode()) {
    return { ok: true, mediaId: `sim_media_${crypto.randomUUID()}` };
  }

  const token = process.env["META_WHATSAPP_TOKEN"]!;
  const phoneNumberId = process.env["META_PHONE_NUMBER_ID"]!;
  const version = process.env["META_API_VERSION"] || "v21.0";

  try {
    const fileResponse = await fetch(params.publicUrl);
    if (!fileResponse.ok) {
      return {
        ok: false,
        error: `Não foi possível baixar o arquivo do Storage (${fileResponse.status})`,
      };
    }
    const blob = await fileResponse.blob();

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", blob, params.publicUrl.split("/").pop() || "arquivo");
    form.append("type", params.mimeType);

    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`[whatsapp] upload de mídia falhou [${response.status}]: ${text}`);
      return { ok: false, error: `[${response.status}] ${text}` };
    }

    const payload = JSON.parse(text) as { id?: string };
    if (!payload.id) return { ok: false, error: "Meta não retornou um media_id" };
    return { ok: true, mediaId: payload.id };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error(`[whatsapp] erro de rede no upload de mídia: ${messageText}`);
    return { ok: false, error: messageText };
  }
}
