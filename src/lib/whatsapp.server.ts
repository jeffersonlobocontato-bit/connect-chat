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

  if (message.mediaUrl && message.mediaType) {
    components.push({
      type: "header",
      parameters: [
        message.mediaType === "video"
          ? { type: "video", video: { link: message.mediaUrl } }
          : { type: "image", image: { link: message.mediaUrl } },
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
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
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
    });

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
