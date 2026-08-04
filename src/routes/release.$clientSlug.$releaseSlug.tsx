import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicRelease } from "@/lib/releases-public.functions";

export const Route = createFileRoute("/release/$clientSlug/$releaseSlug")({
  loader: async ({ params }) => {
    const release = await getPublicRelease({
      data: { clientSlug: params.clientSlug, releaseSlug: params.releaseSlug },
    });
    if (!release) throw notFound();
    return release;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — ${loaderData.clientName}` : "Release";
    const description =
      loaderData?.summary ?? "Material de imprensa disponível para veículos e jornalistas.";
    const image = loaderData?.coverUrl;
    return {
      meta: [
        { title: title.slice(0, 60) },
        { name: "description", content: description.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  component: ReleasePage,
});

function ReleasePage() {
  const release = Route.useLoaderData();

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {release.clientName}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{release.title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {new Date(release.createdAt).toLocaleDateString("pt-BR")}
      </p>

      {release.summary && <p className="mt-5 text-lg text-muted-foreground">{release.summary}</p>}

      {release.coverUrl && (
        <figure className="mt-8">
          <img
            src={release.coverUrl}
            alt={release.title}
            loading="lazy"
            className="w-full rounded-xl border border-border"
          />
          <figcaption className="mt-2">
            <a
              href={`/api/public/release-image/${release.id}`}
              className="text-sm text-primary underline underline-offset-4"
            >
              Baixar imagem em alta
            </a>
          </figcaption>
        </figure>
      )}

      <article
        className="prose prose-neutral dark:prose-invert mt-8 max-w-none prose-p:leading-relaxed prose-p:my-4 prose-headings:mt-8 prose-headings:mb-3 prose-headings:font-semibold prose-h2:text-xl"
        // Conteúdo redigido pela própria equipe no painel administrativo.
        dangerouslySetInnerHTML={{ __html: release.bodyHtml }}
      />
    </main>
  );
}
