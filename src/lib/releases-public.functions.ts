import { createServerFn } from "@tanstack/react-start";

/** Página pública de release — leitura sem login, só o que é publicável. */
export const getPublicRelease = createServerFn({ method: "GET" })
  .inputValidator((input: { clientSlug: string; releaseSlug: string }) => {
    if (!input?.clientSlug || !input?.releaseSlug) throw new Error("Endereço inválido");
    return { clientSlug: input.clientSlug, releaseSlug: input.releaseSlug };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("slug", data.clientSlug)
      .maybeSingle();
    if (!client) return null;

    const { data: release } = await supabaseAdmin
      .from("releases")
      .select("id, title, summary, body_html, cover_media_id, created_at, published")
      .eq("client_id", client.id)
      .eq("slug", data.releaseSlug)
      .maybeSingle();
    if (!release || !release.published) return null;

    let coverUrl: string | null = null;
    if (release.cover_media_id) {
      const { data: media } = await supabaseAdmin
        .from("media_library")
        .select("public_url")
        .eq("id", release.cover_media_id)
        .maybeSingle();
      coverUrl = media?.public_url ?? null;
    }

    await supabaseAdmin
      .from("release_events")
      .insert({ release_id: release.id, event_type: "view" });

    return {
      id: release.id,
      clientName: client.name,
      title: release.title,
      summary: release.summary,
      bodyHtml: release.body_html,
      coverUrl,
      createdAt: release.created_at,
    };
  });
