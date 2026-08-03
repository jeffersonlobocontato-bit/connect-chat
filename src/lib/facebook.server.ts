// Adaptador de envio pra Messenger e Instagram Direct.
// Diferente do WhatsApp, isso é só pra RESPONDER conversas — a própria
// Meta restringe fortemente mensagem promocional em massa nesses canais
// (Messenger Platform Policy exige "tag" específica pra mensagens fora
// da janela de 24h, e a maioria não serve pra comunicado de imprensa).

export type SocialSendResult = {
  ok: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
};

export function isMessengerLiveMode(): boolean {
  return Boolean(process.env["META_PAGE_ACCESS_TOKEN"] && process.env["META_PAGE_ID"]);
}

export function isInstagramLiveMode(): boolean {
  return Boolean(process.env["META_PAGE_ACCESS_TOKEN"] && process.env["META_IG_ACCOUNT_ID"]);
}

async function sendViaGraphMessages(params: {
  recipientId: string;
  body: string;
  simulatedPrefix: string;
}): Promise<SocialSendResult> {
  const token = process.env["META_PAGE_ACCESS_TOKEN"];
  const version = process.env["META_API_VERSION"] || "v21.0";

  if (!token) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true, messageId: `sim_${params.simulatedPrefix}_${crypto.randomUUID()}` };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${version}/me/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: params.recipientId },
        message: { text: params.body },
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`[social] envio falhou [${response.status}]: ${text}`);
      return { ok: false, error: `[${response.status}] ${text}` };
    }

    const payload = JSON.parse(text) as { message_id?: string };
    return { ok: true, messageId: payload.message_id };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error(`[social] erro de rede: ${messageText}`);
    return { ok: false, error: messageText };
  }
}

export async function sendMessengerText(params: {
  psid: string;
  body: string;
}): Promise<SocialSendResult> {
  return sendViaGraphMessages({
    recipientId: params.psid,
    body: params.body,
    simulatedPrefix: "messenger",
  });
}

export async function sendInstagramText(params: {
  igsid: string;
  body: string;
}): Promise<SocialSendResult> {
  return sendViaGraphMessages({
    recipientId: params.igsid,
    body: params.body,
    simulatedPrefix: "instagram",
  });
}
