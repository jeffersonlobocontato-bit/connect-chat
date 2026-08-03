// Adaptador de envio de e-mail via Resend.
// Enquanto RESEND_API_KEY não existir, roda em modo simulado — mesmo
// padrão do whatsapp.server.ts.

export type EmailSendResult = {
  ok: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
};

export function isEmailLiveMode(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]);
}

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  fromName?: string | undefined;
};

const DEFAULT_FROM_ADDRESS = "releases@news.aivozes.com.br";

export async function sendEmail(message: OutboundEmail): Promise<EmailSendResult> {
  if (!isEmailLiveMode()) {
    // Modo simulado: não chama o Resend, apenas devolve um id fictício.
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true, messageId: `sim_email_${crypto.randomUUID()}` };
  }

  const apiKey = process.env["RESEND_API_KEY"]!;
  const fromAddress = process.env["RESEND_FROM_ADDRESS"] || DEFAULT_FROM_ADDRESS;
  const fromName = message.fromName || "AIV — Assessoria de Imprensa";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`[email] envio falhou [${response.status}]: ${text}`);
      return { ok: false, error: `[${response.status}] ${text}` };
    }

    const payload = JSON.parse(text) as { id?: string };
    if (!payload.id) return { ok: false, error: "Resend não retornou um id de mensagem" };
    return { ok: true, messageId: payload.id };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error(`[email] erro de rede no envio: ${messageText}`);
    return { ok: false, error: messageText };
  }
}

/**
 * Troca variáveis simples {{nome}}, {{veiculo}}, {{link}} no corpo/assunto
 * do template — equivalente ao bodyParams do WhatsApp, mas em HTML livre
 * (e-mail não passa por aprovação de template como o WhatsApp).
 */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
}
