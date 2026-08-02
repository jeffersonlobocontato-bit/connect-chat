import { createFileRoute } from "@tanstack/react-router";
import { PainelMensageria } from "@/components/mensageria/PainelMensageria";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel · Disparador de Imprensa AIV" },
      {
        name: "description",
        content:
          "Painel de mensageria da AIV: base de jornalistas, segmentação, templates, campanhas de WhatsApp e relatórios de leitura.",
      },
      { property: "og:title", content: "Painel · Disparador de Imprensa AIV" },
      {
        property: "og:description",
        content: "Gerencie a base de jornalistas e dispare comunicados de imprensa por WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PainelMensageria,
});
