import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/r/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data } = await supabaseAdmin
          .from("short_links")
          .select("id, original_url, click_count")
          .eq("short_code", params.code)
          .maybeSingle();

        if (!data) {
          return new Response("Link não encontrado", { status: 404 });
        }

        await supabaseAdmin
          .from("short_links")
          .update({ click_count: (data.click_count ?? 0) + 1 })
          .eq("id", data.id);
        await supabaseAdmin.from("short_link_clicks").insert({ short_link_id: data.id });

        return new Response(null, { status: 302, headers: { Location: data.original_url } });
      },
    },
  },
});
