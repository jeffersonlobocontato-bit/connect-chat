import { createFileRoute } from "@tanstack/react-router";

// Download da imagem de capa de um release, contabilizando o evento.
export const Route = createFileRoute("/api/public/release-image/$releaseId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // ?inline=1 → serve os bytes da imagem (usado como <img> no corpo do e-mail),
        // sem contar como download de mídia em alta.
        const inline = new URL(request.url).searchParams.get("inline") === "1";

        const { data: release } = await supabaseAdmin
          .from("releases")
          .select("id, cover_media_id, published")
          .eq("id", params.releaseId)
          .maybeSingle();

        if (!release || !release.published || !release.cover_media_id) {
          return new Response("Não encontrado", { status: 404 });
        }

        const { data: media } = await supabaseAdmin
          .from("media_library")
          .select("public_url, mime_type")
          .eq("id", release.cover_media_id)
          .maybeSingle();

        if (!media?.public_url) return new Response("Não encontrado", { status: 404 });

        if (inline) {
          const upstream = await fetch(media.public_url);
          if (!upstream.ok || !upstream.body) {
            return new Response("Não encontrado", { status: 404 });
          }
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type":
                media.mime_type || upstream.headers.get("content-type") || "image/jpeg",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }

        await supabaseAdmin
          .from("release_events")
          .insert({ release_id: release.id, event_type: "image_download" });

        return new Response(null, {
          status: 302,
          headers: { Location: media.public_url },
        });
      },

    },
  },
});
