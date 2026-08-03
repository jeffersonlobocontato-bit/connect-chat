// Token de descadastro assinado (HMAC-SHA256) — não precisa de tabela
// própria: o próprio token carrega o journalist_id e uma assinatura que
// só o servidor (com o secret) consegue validar.
//
// Formato do token: base64url(journalistId) + "." + base64url(assinatura)

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getSecret(): string {
  // Cai de volta para a RESEND_API_KEY apenas para nunca deixar o link
  // de descadastro totalmente sem assinatura — o ideal é configurar
  // UNSUBSCRIBE_SECRET dedicado.
  return (
    process.env["UNSUBSCRIBE_SECRET"] || process.env["RESEND_API_KEY"] || "aiv-unsubscribe-fallback"
  );
}

async function hmac(data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
}

export async function generateUnsubscribeToken(journalistId: string): Promise<string> {
  const idPart = toBase64Url(new TextEncoder().encode(journalistId));
  const signature = await hmac(idPart);
  return `${idPart}.${toBase64Url(signature)}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  const [idPart, sigPart] = token.split(".");
  if (!idPart || !sigPart) return null;

  const expectedSignature = toBase64Url(await hmac(idPart));
  if (expectedSignature !== sigPart) return null;

  try {
    return new TextDecoder().decode(fromBase64Url(idPart));
  } catch {
    return null;
  }
}
