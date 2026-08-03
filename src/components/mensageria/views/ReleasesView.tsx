import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "../ui-bits";

type Client = { id: string; name: string; slug: string };
type Release = {
  id: string;
  client_id: string;
  title: string;
  slug: string;
  summary: string | null;
  body_html: string;
  cover_media_id: string | null;
  published: boolean;
  created_at: string;
};
type MediaAsset = { id: string; file_name: string; public_url: string };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ReleasesView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<Record<string, { view: number; image_download: number }>>({});
  const [clientName, setClientName] = useState("");
  const [form, setForm] = useState({
    id: "",
    client_id: "",
    title: "",
    summary: "",
    body_html: "",
    cover_media_id: "",
    published: true,
  });

  async function carregar() {
    const [{ data: c }, { data: r }, { data: m }, { data: e }] = await Promise.all([
      supabase.from("clients").select("id, name, slug").order("name"),
      supabase.from("releases").select("*").order("created_at", { ascending: false }),
      supabase
        .from("media_library")
        .select("id, file_name, public_url")
        .order("created_at", { ascending: false }),
      supabase.from("release_events").select("release_id, event_type"),
    ]);
    setClients((c ?? []) as Client[]);
    setReleases((r ?? []) as unknown as Release[]);
    setMedia((m ?? []) as unknown as MediaAsset[]);

    const agg: Record<string, { view: number; image_download: number }> = {};
    for (const ev of (e ?? []) as { release_id: string; event_type: string }[]) {
      agg[ev.release_id] ??= { view: 0, image_download: 0 };
      if (ev.event_type === "view") agg[ev.release_id]!.view += 1;
      else agg[ev.release_id]!.image_download += 1;
    }
    setStats(agg);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function criarCliente() {
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    const { error } = await supabase
      .from("clients")
      .insert({ name: clientName.trim(), slug: slugify(clientName) });
    if (error) {
      toast.error(error.message);
      return;
    }
    setClientName("");
    toast.success("Cliente criado");
    void carregar();
  }

  function limpar() {
    setForm({
      id: "",
      client_id: "",
      title: "",
      summary: "",
      body_html: "",
      cover_media_id: "",
      published: true,
    });
  }

  async function salvarRelease() {
    if (!form.client_id || !form.title.trim() || !form.body_html.trim()) {
      toast.error("Escolha o cliente e preencha título e conteúdo");
      return;
    }
    const payload = {
      client_id: form.client_id,
      title: form.title.trim(),
      slug: slugify(form.title),
      summary: form.summary.trim() || null,
      body_html: form.body_html,
      cover_media_id: form.cover_media_id || null,
      published: form.published,
    };
    const { error } = form.id
      ? await supabase.from("releases").update(payload).eq("id", form.id)
      : await supabase.from("releases").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "Release atualizado" : "Release publicado");
    limpar();
    void carregar();
  }

  async function excluir(id: string) {
    await supabase.from("releases").delete().eq("id", id);
    void carregar();
  }

  function urlPublica(release: Release): string {
    const client = clients.find((c) => c.id === release.client_id);
    return `${window.location.origin}/release/${client?.slug ?? ""}/${release.slug}`;
  }

  return (
    <div>
      <PageHeader
        title="Releases"
        subtitle="Publique o material de imprensa em uma página própria do cliente e acompanhe visualizações e downloads."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Clientes</h2>
            <div className="mt-3 flex gap-2">
              <Input
                value={clientName}
                placeholder="Nome do cliente"
                onChange={(e) => setClientName(e.target.value)}
              />
              <Button size="sm" onClick={criarCliente}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {clients.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {c.name}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">{form.id ? "Editar release" : "Novo release"}</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Cliente</Label>
                <Select
                  value={form.client_id}
                  onValueChange={(v) => setForm({ ...form, client_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Resumo</Label>
                <Textarea
                  rows={2}
                  value={form.summary}
                  placeholder="Usado na prévia dos links compartilhados."
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea
                  rows={8}
                  value={form.body_html}
                  placeholder="Texto do release. Aceita HTML simples (<p>, <strong>, <a>)."
                  onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                />
              </div>
              <div>
                <Label>Imagem de capa</Label>
                <Select
                  value={form.cover_media_id || "none"}
                  onValueChange={(v) => setForm({ ...form, cover_media_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem imagem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem imagem</SelectItem>
                    {media.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.file_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.published}
                  onCheckedChange={(v) => setForm({ ...form, published: v })}
                  id="release-publicado"
                />
                <Label htmlFor="release-publicado">Página pública ativa</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={salvarRelease}>{form.id ? "Salvar" : "Publicar"}</Button>
                {form.id && (
                  <Button variant="outline" onClick={limpar}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="space-y-2">
          {releases.length === 0 ? (
            <EmptyState message="Nenhum release publicado ainda." />
          ) : (
            releases.map((release) => {
              const s = stats[release.id] ?? { view: 0, image_download: 0 };
              return (
                <div key={release.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{release.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {clients.find((c) => c.id === release.client_id)?.name ?? "—"} · {s.view}{" "}
                        visualizações · {s.image_download} downloads
                        {release.published ? "" : " · rascunho"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(urlPublica(release));
                          toast.success("Link copiado");
                        }}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Copiar link"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={urlPublica(release)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Abrir página"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => void excluir(release.id)}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label="Excluir release"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      setForm({
                        id: release.id,
                        client_id: release.client_id,
                        title: release.title,
                        summary: release.summary ?? "",
                        body_html: release.body_html,
                        cover_media_id: release.cover_media_id ?? "",
                        published: release.published,
                      })
                    }
                  >
                    Editar
                  </Button>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
