// Montagem do corpo do e-mail com IA a partir de uma matéria publicada
// (release) ou de um link avulso. Usa o Lovable AI Gateway.

export type GeneratedEmail = { subject: string; html: string };

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackHtml(input: {
  title: string;
  summary: string;
  bodyText: string;
  coverUrl: string | null;
  readUrl: string | null;
  downloadUrl: string | null;
}): string {
  const paragrafos = input.bodyText
    .split(/\n{2,}|(?<=\.)\s{2,}/)
    .filter(Boolean)
    .slice(0, 6)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${p}</p>`,
    )
    .join("");

  const cta = (href: string, label: string, primary: boolean) =>
    `<a href="${href}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;${
      primary
        ? "background:#0f2c5c;color:#ffffff"
        : "background:#ffffff;color:#0f2c5c;border:1px solid #0f2c5c"
    }">${label}</a>`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Comunicado à imprensa</p>
  <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f172a">${input.title}</h1>
  <p style="margin:0 0 18px;font-size:12px;color:#64748b">Olá, {{nome}}{{veiculo_sufixo}}</p>
  ${
    input.coverUrl
      ? `<img src="${input.coverUrl}" alt="${input.title}" style="width:100%;border-radius:10px;margin-bottom:18px" />`
      : ""
  }
  ${input.summary ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#0f172a"><strong>${input.summary}</strong></p>` : ""}
  ${paragrafos}
  <div style="margin-top:20px">
    ${input.readUrl ? cta(input.readUrl, "Ler a matéria completa", true) : ""}
    ${input.downloadUrl ? cta(input.downloadUrl, "Baixar a mídia em alta", false) : ""}
  </div>
</div>`;
}

export async function generateEmailFromRelease(params: {
  releaseId?: string | null;
  linkUrl?: string | null;
  campaignName?: string | null;
  instructions?: string | null;
  origin: string;
}): Promise<GeneratedEmail> {
  const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");

  let title = params.campaignName?.trim() || "Comunicado da Agência de Inteligência Vozes";
  let summary = "";
  let bodyText = "";
  let coverUrl: string | null = null;
  let readUrl: string | null = params.linkUrl?.trim() || null;
  let downloadUrl: string | null = null;
  let clientName = "";

  if (params.releaseId) {
    const { data: release } = await supabase
      .from("releases")
      .select("id, title, slug, summary, body_html, cover_media_id, clients(name, slug)")
      .eq("id", params.releaseId)
      .single();
    if (!release) throw new Error("Matéria não encontrada");

    const client = (release as unknown as { clients: { name: string; slug: string } | null })
      .clients;
    clientName = client?.name ?? "";
    title = release.title;
    summary = release.summary ?? "";
    bodyText = stripHtml(release.body_html ?? "");
    readUrl =
      readUrl ?? `${params.origin}/release/${client?.slug ?? ""}/${release.slug}`;

    if (release.cover_media_id) {
      const { data: media } = await supabase
        .from("media_library")
        .select("public_url")
        .eq("id", release.cover_media_id)
        .single();
      coverUrl = media?.public_url ?? null;
      if (coverUrl) downloadUrl = `${params.origin}/api/public/release-image/${release.id}`;
    }
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  const fallback = () => ({
    subject: summary ? `${title}` : title,
    html: fallbackHtml({ title, summary, bodyText, coverUrl, readUrl, downloadUrl }),
  });

  if (!apiKey || (!bodyText && !summary && !readUrl)) return fallback();

  const prompt = `Monte um e-mail de assessoria de imprensa em HTML.

Cliente: ${clientName || "Agência de Inteligência Vozes"}
Título da matéria: ${title}
Resumo: ${summary || "(sem resumo)"}
Texto da matéria: ${bodyText.slice(0, 6000) || "(sem texto)"}
Imagem de capa (URL): ${coverUrl ?? "(nenhuma)"}
Link para ler a matéria: ${readUrl ?? "(nenhum)"}
Link para baixar a mídia em alta: ${downloadUrl ?? "(nenhum)"}
Instruções extras do usuário: ${params.instructions?.trim() || "(nenhuma)"}

Regras obrigatórias:
- Responda SOMENTE com JSON válido: {"subject": "...", "html": "..."} sem cercas de código.
- O assunto deve ter no máximo 70 caracteres, direto, sem clickbait.
- O HTML deve ser um único <div> com estilos inline (compatível com Gmail/Outlook), largura máxima 600px, fundo branco, texto #334155, títulos #0f172a, cor de marca #0f2c5c.
- Comece com "Olá, {{nome}}" (mantenha essa variável literal) e um parágrafo curto de contexto para o jornalista.
- Se houver imagem de capa, inclua <img> com width:100% e border-radius:10px.
- Traga o release em 3 a 5 parágrafos jornalísticos, em português do Brasil, sem inventar dados que não estejam no texto.
- Finalize com botões CTA em <a> estilizado: "Ler a matéria completa" (link acima) e, se houver, "Baixar a mídia em alta".
- Não inclua rodapé de descadastro (é adicionado automaticamente).`;

  try {
    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é redator de assessoria de imprensa e produz e-mails HTML limpos e compatíveis com clientes de e-mail. Responda apenas com JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[campanha-ia] gateway falhou [${response.status}]: ${await response.text()}`);
      return fallback();
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as { subject?: string; html?: string };
    if (!parsed.html) return fallback();
    return {
      subject: (parsed.subject || title).slice(0, 120),
      html: parsed.html,
    };
  } catch (error) {
    console.error(
      `[campanha-ia] erro ao gerar e-mail: ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallback();
  }
}
