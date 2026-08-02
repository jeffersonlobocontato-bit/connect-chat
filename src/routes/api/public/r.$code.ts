import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/r/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
                headers.delete("Authorization");
              }
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { data } = await supabase
          .from("short_links")
          .select("id, original_url, click_count")
          .eq("short_code", params.code)
          .maybeSingle();

        if (!data) {
          return new Response("Link não encontrado", { status: 404 });
        }

        await supabase
          .from("short_links")
          .update({ click_count: (data.click_count ?? 0) + 1 })
          .eq("id", data.id);
        await supabase.from("short_link_clicks").insert({ short_link_id: data.id });

        return new Response(null, { status: 302, headers: { Location: data.original_url } });
      },
    },
  },
});
