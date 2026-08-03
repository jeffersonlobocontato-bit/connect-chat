/**
 * Etiquetagem automática: quando uma mensagem recebida contém a
 * palavra-chave de uma regra ativa, a etiqueta correspondente é
 * adicionada ao contato (sem duplicar).
 */
export async function applyAutoTags(params: {
  journalistId: string;
  text: string;
}): Promise<void> {
  if (!params.text?.trim()) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rules } = await supabaseAdmin
    .from("auto_tag_rules")
    .select("keyword, tag")
    .eq("active", true);
  if (!rules || rules.length === 0) return;

  const normalized = params.text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const matched = rules
    .filter((r) =>
      normalized.includes(
        r.keyword
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      ),
    )
    .map((r) => r.tag);
  if (matched.length === 0) return;

  const { data: contato } = await supabaseAdmin
    .from("journalists")
    .select("tags")
    .eq("id", params.journalistId)
    .maybeSingle();

  const atuais = (contato?.tags ?? []) as string[];
  const novas = matched.filter(
    (t) => !atuais.some((existente) => existente.trim().toLowerCase() === t.trim().toLowerCase()),
  );
  if (novas.length === 0) return;

  await supabaseAdmin
    .from("journalists")
    .update({ tags: [...atuais, ...novas] })
    .eq("id", params.journalistId);
}
