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

/**
 * Teto de envios de e-mail por dia — trava de segurança pro plano Free do
 * Resend (100/dia). Configurável via RESEND_DAILY_LIMIT quando o plano for
 * outro; sem a env, assume o teto mais conservador.
 */
export function getEmailDailyLimit(): number {
  const raw = process.env["RESEND_DAILY_LIMIT"];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  fromName?: string | undefined;
  unsubscribeUrl?: string | undefined;
};

const DEFAULT_FROM_ADDRESS = "releases@news.aivozes.com.br";

export const BRAND_NAME = "Agência de Inteligência Vozes";
export const BRAND_LOGO_URL = "https://mensageria.aivozes.com.br/avatar-vozes.png";

/**
 * Cabeçalho de marca (avatar V + nome por extenso) anexado a todo e-mail —
 * é o que os clientes de e-mail mostram quando não há BIMI configurado.
 */
export function prependBrandHeader(html: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto 8px;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td style="padding:8px 0" width="44">
      <img src="${BRAND_LOGO_URL}" width="36" height="36" alt="${BRAND_NAME}" style="display:block;border-radius:8px" />
    </td>
    <td style="padding:8px 0;font-size:13px;font-weight:700;color:#0f2c5c">${BRAND_NAME}</td>
  </tr>
</table>
${html}`;
}

/**
 * Rodapé de descadastro anexado a TODO e-mail, independente do template —
 * compliance não pode depender de o autor do template lembrar de incluir
 * a variável {{unsubscribe_link}}.
 */
export function appendUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  return `${html}
<hr style="margin-top:24px;border:none;border-top:1px solid #e2e8f0" />
<p style="font-size:12px;color:#94a3b8;margin-top:12px">
  Você recebeu este e-mail porque faz parte da base de imprensa da Agência de Inteligência Vozes.
  <a href="${unsubscribeUrl}" style="color:#94a3b8">Não quero mais receber</a>.
</p>`;
}

export async function sendEmail(message: OutboundEmail): Promise<EmailSendResult> {
  if (!isEmailLiveMode()) {
    // Modo simulado: não chama o Resend, apenas devolve um id fictício.
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true, messageId: `sim_email_${crypto.randomUUID()}` };
  }

  const apiKey = process.env["RESEND_API_KEY"]!;
  const fromAddress = process.env["RESEND_FROM_ADDRESS"] || DEFAULT_FROM_ADDRESS;
  const fromName = message.fromName || "Agência de Inteligência Vozes";

  const headers: Record<string, string> = {};
  if (message.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${message.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

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
        headers: Object.keys(headers).length > 0 ? headers : undefined,
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
