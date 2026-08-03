import { createFileRoute } from "@tanstack/react-router";

// Download da imagem de capa de um release, contabilizando o evento.
export const Route = createFileRoute("/api/public/release-image/$releaseId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
          .select("public_url")
          .eq("id", release.cover_media_id)
          .maybeSingle();

        if (!media?.public_url) return new Response("Não encontrado", { status: 404 });

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
