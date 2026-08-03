import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { dispatchCampaign } from "@/lib/campaigns.functions";
import { generateCampaignEmail } from "@/lib/campaign-ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatusBadge } from "../ui-bits";

type Campaign = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  scheduled_at: string | null;
  link_url: string | null;
  template_id: string | null;
  segment_id: string | null;
  list_id: string | null;
  media_id: string | null;
  channel: string;
  audience: string;
  release_id: string | null;
  email_subject: string | null;
  email_html: string | null;
};

type ReleaseOption = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  client_id: string;
};


type MediaAsset = {
  id: string;
  file_name: string;
  public_url: string;
  media_type: string;
};

type Template = {
  id: string;
  meta_template_name: string | null;
  name: string | null;
  channel: string;
};

const AUDIENCE_LABEL: Record<string, string> = {
  press: "Imprensa",
  lead: "Leads",
  all: "Imprensa + Leads",
};

export function CampanhasView() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [segments, setSegments] = useState<
    Array<{ id: string; name: string; audience: string }>
  >([]);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [releases, setReleases] = useState<ReleaseOption[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; slug: string }>>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [instrucoes, setInstrucoes] = useState("");
  const [imagemTopo, setImagemTopo] = useState("");
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const imagemInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    channel: "whatsapp",
    audience: "press",
    template_id: "",
    target: "",
    link_url: "",
    media_id: "",
    release_id: "",
    email_subject: "",
    email_html: "",
    scheduleMode: "now",
    scheduled_at: "",
  });
  const disparar = useServerFn(dispatchCampaign);
  const gerarEmail = useServerFn(generateCampaignEmail);
  const templatesDoCanal = templates.filter((t) => t.channel === form.channel);
  const segmentosDoPublico = segments.filter(
    (s) => form.audience === "all" || s.audience === form.audience,
  );

  async function carregar() {
    const [c, t, s, l, m, r, cl] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase
        .from("message_templates")
        .select("id, meta_template_name, name, channel")
        .order("name"),
      supabase.from("segments").select("id, name, audience").order("name"),
      supabase.from("contact_lists").select("id, name").order("name"),
      supabase
        .from("media_library")
        .select("id, file_name, public_url, media_type")
        .order("created_at", { ascending: false }),
      supabase
        .from("releases")
        .select("id, title, slug, published, client_id")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, slug"),
    ]);
    setRows((c.data ?? []) as Campaign[]);
    setTemplates((t.data ?? []) as Template[]);
    setSegments((s.data ?? []) as Array<{ id: string; name: string; audience: string }>);
    setLists(l.data ?? []);
    setMediaAssets((m.data ?? []) as MediaAsset[]);
    setReleases((r.data ?? []) as ReleaseOption[]);
    setClients((cl.data ?? []) as Array<{ id: string; slug: string }>);
  }

  useEffect(() => {
    void carregar();
  }, []);

  function resetForm() {
    setEditingId(null);
    setInstrucoes("");
    setImagemTopo("");
    setForm({
      name: "",
      channel: "whatsapp",
      audience: "press",
      template_id: "",
      target: "",
      link_url: "",
      media_id: "",
      release_id: "",
      email_subject: "",
      email_html: "",
      scheduleMode: "now",
      scheduled_at: "",
    });
  }

  function releaseUrl(releaseId: string): string {
    const release = releases.find((r) => r.id === releaseId);
    if (!release) return "";
    const client = clients.find((c) => c.id === release.client_id);
    return `${window.location.origin}/release/${client?.slug ?? ""}/${release.slug}`;
  }

  function escolherRelease(releaseId: string) {
    const id = releaseId === "none" ? "" : releaseId;
    const release = releases.find((r) => r.id === id);
    setForm((prev) => ({
      ...prev,
      release_id: id,
      link_url: id ? releaseUrl(id) : prev.link_url,
      name: prev.name.trim() ? prev.name : (release?.title ?? ""),
    }));
  }

  async function enviarImagemTopo(file: File) {
    setEnviandoImagem(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("campaign-media")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw new Error("Falha ao enviar a imagem");
      const { data: signed } = await supabase.storage
        .from("campaign-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (!signed?.signedUrl) throw new Error("Falha ao gerar o link da imagem");
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("media_library").insert({
        file_name: file.name,
        storage_path: path,
        public_url: signed.signedUrl,
        mime_type: file.type,
        media_type: "IMAGE",
        file_size_bytes: file.size,
        created_by: userData.user?.id ?? null,
      });
      setImagemTopo(signed.signedUrl);
      await carregar();
      toast.success("Imagem enviada — ela será usada no topo do e-mail");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload");
    } finally {
      setEnviandoImagem(false);
    }
  }

  async function montarComIA() {
    if (!form.release_id && !form.link_url.trim()) {
      toast.error("Escolha uma matéria publicada ou informe o link do material");
      return;
    }
    setGerando(true);
    try {
      const result = await gerarEmail({
        data: {
          releaseId: form.release_id || null,
          linkUrl: form.link_url.trim() || null,
          campaignName: form.name.trim() || null,
          instructions: instrucoes.trim() || null,
          imageUrl: imagemTopo || null,
        },
      });
      setForm((prev) => ({
        ...prev,
        email_subject: result.subject,
        email_html: result.html,
      }));
      toast.success("Corpo do e-mail montado pela IA — revise abaixo antes de salvar");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao montar o e-mail");
    } finally {
      setGerando(false);
    }
  }


  function editar(c: Campaign) {
    setEditingId(c.id);
    setInstrucoes("");
    setForm({
      name: c.name,
      channel: c.channel ?? "whatsapp",
      audience: c.audience ?? "press",
      template_id: c.template_id ?? "",
      target: c.segment_id
        ? `segment:${c.segment_id}`
        : c.list_id
          ? `list:${c.list_id}`
          : "",
      link_url: c.link_url ?? "",
      media_id: c.media_id ?? "",
      release_id: c.release_id ?? "",
      email_subject: c.email_subject ?? "",
      email_html: c.email_html ?? "",
      scheduleMode: c.scheduled_at ? "later" : "now",
      scheduled_at: c.scheduled_at
        ? new Date(new Date(c.scheduled_at).getTime() -
            new Date(c.scheduled_at).getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
    });
    setOpen(true);
  }

  async function salvar() {
    if (!form.name.trim()) {
      toast.error("Dê um nome à campanha");
      return;
    }
    const temCorpoProprio = form.channel === "email" && form.email_html.trim().length > 0;
    if (!form.template_id && !temCorpoProprio) {
      toast.error(
        form.channel === "email"
          ? "Escolha um template ou monte o corpo do e-mail com a IA"
          : "Escolha um template",
      );
      return;
    }
    if (!form.target) {
      toast.error("Escolha o público-alvo");
      return;
    }
    if (form.scheduleMode === "later" && !form.scheduled_at) {
      toast.error("Escolha a data e hora do agendamento");
      return;
    }
    const [kind, id] = form.target.split(":");
    const { data: userData } = await supabase.auth.getUser();

    const isScheduled = form.scheduleMode === "later";
    const payload = {
      name: form.name.trim(),
      channel: form.channel,
      audience: form.audience,
      template_id: form.template_id || null,
      segment_id: kind === "segment" ? id! : null,
      list_id: kind === "list" ? id! : null,
      link_url: form.link_url.trim() || null,
      media_id: form.channel === "whatsapp" ? form.media_id || null : null,
      release_id: form.channel === "email" ? form.release_id || null : null,
      email_subject: form.channel === "email" ? form.email_subject.trim() || null : null,
      email_html: form.channel === "email" ? form.email_html.trim() || null : null,
      status: isScheduled ? "SCHEDULED" : "DRAFT",
      scheduled_at: isScheduled ? new Date(form.scheduled_at).toISOString() : null,
    };

    const { error } = editingId
      ? await supabase.from("campaigns").update(payload).eq("id", editingId)
      : await supabase
          .from("campaigns")
          .insert({ ...payload, created_by: userData.user?.id ?? null });
    if (error) {
      toast.error(editingId ? "Erro ao salvar campanha" : "Erro ao criar campanha");
      return;
    }
    toast.success(
      editingId
        ? "Campanha atualizada"
        : isScheduled
          ? "Campanha agendada"
          : "Campanha criada como rascunho",
    );
    setOpen(false);
    resetForm();
    void carregar();
  }


  async function enviar(id: string) {
    setSendingId(id);
    try {
      const result = await disparar({ data: { campaignId: id } });
      toast.success(
        `${result.sent} de ${result.total} mensagens processadas${result.live ? "" : " (modo de teste)"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no disparo");
    } finally {
      setSendingId(null);
      void carregar();
    }
  }

  async function remover(id: string) {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover campanha");
      return;
    }
    void carregar();
  }

  function alvoLabel(c: Campaign) {
    if (c.segment_id) return segments.find((s) => s.id === c.segment_id)?.name ?? "Segmento";
    if (c.list_id) return lists.find((l) => l.id === c.list_id)?.name ?? "Lista";
    return "—";
  }

  return (
    <div>
      <PageHeader
        title="Campanhas"
        subtitle="Crie o disparo, escolha o público e envie o comunicado."
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar campanha" : "Nova campanha"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="camp-nome">Nome</Label>
                  <Input
                    id="camp-nome"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Release — balanço trimestral"
                  />
                </div>
                <div>
                  <Label>Canal</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) =>
                      setForm({ ...form, channel: v, template_id: "", media_id: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>
                    Template{form.channel === "email" ? " (opcional se usar a IA)" : ""}
                  </Label>
                  <Select
                    value={form.template_id}
                    onValueChange={(v) => setForm({ ...form, template_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesDoCanal.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name ?? t.meta_template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templatesDoCanal.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhum template para esse canal ainda — crie um na aba "Templates".
                    </p>
                  )}
                </div>
                {form.channel === "email" && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Label>Matéria publicada (release)</Label>
                    <Select
                      value={form.release_id || "none"}
                      onValueChange={escolherRelease}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Escolha a matéria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem matéria (usar só o link)</SelectItem>
                        {releases.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.title}
                            {r.published ? "" : " (rascunho)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Label className="mt-3 block">Imagem do topo do e-mail</Label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        ref={imagemInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void enviarImagemTopo(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={enviandoImagem}
                        onClick={() => imagemInputRef.current?.click()}
                      >
                        {enviandoImagem ? "Enviando..." : "Enviar imagem"}
                      </Button>
                      <Input
                        className="w-72"
                        placeholder="ou cole a URL da imagem"
                        value={imagemTopo}
                        onChange={(e) => setImagemTopo(e.target.value)}
                      />
                      {imagemTopo && (
                        <img
                          src={imagemTopo}
                          alt="Prévia da imagem do topo"
                          className="h-12 w-12 rounded object-cover"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Se ficar em branco, usamos a capa da matéria ou a primeira imagem do link.
                    </p>

                    <Label htmlFor="camp-instrucoes" className="mt-3 block">

                      Instruções para a IA (opcional)
                    </Label>
                    <Textarea
                      id="camp-instrucoes"
                      rows={2}
                      value={instrucoes}
                      onChange={(e) => setInstrucoes(e.target.value)}
                      placeholder="Ex.: tom mais direto, destacar o dado de crescimento e convidar para entrevista."
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-3"
                      onClick={montarComIA}
                      disabled={gerando}
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      {gerando ? "Montando..." : "Montar e-mail com IA"}
                    </Button>

                    {form.email_html && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <Label htmlFor="camp-assunto">Assunto</Label>
                          <Input
                            id="camp-assunto"
                            value={form.email_subject}
                            onChange={(e) =>
                              setForm({ ...form, email_subject: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Prévia do corpo</Label>
                          <div
                            className="mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-white p-3"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: form.email_html }}
                          />
                        </div>
                        <details>
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Editar HTML manualmente
                          </summary>
                          <Textarea
                            rows={8}
                            className="mt-2 font-mono text-xs"
                            value={form.email_html}
                            onChange={(e) => setForm({ ...form, email_html: e.target.value })}
                          />
                        </details>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setForm({ ...form, email_html: "", email_subject: "" })}
                        >
                          Descartar corpo gerado
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label>Público</Label>
                  <Select
                    value={form.audience}
                    onValueChange={(v) => setForm({ ...form, audience: v, target: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="press">Imprensa (jornalistas)</SelectItem>
                      <SelectItem value="lead">Leads gerais</SelectItem>
                      <SelectItem value="all">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alvo</Label>
                  <Select
                    value={form.target}
                    onValueChange={(v) => setForm({ ...form, target: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Segmento ou lista" />
                    </SelectTrigger>
                    <SelectContent>
                      {segmentosDoPublico.map((s) => (
                        <SelectItem key={s.id} value={`segment:${s.id}`}>
                          Segmento · {s.name}
                        </SelectItem>
                      ))}
                      {lists.map((l) => (
                        <SelectItem key={l.id} value={`list:${l.id}`}>
                          Lista · {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {segmentosDoPublico.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhum segmento desse público ainda — crie um na aba "Segmentação".
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="camp-link">Link do material (opcional)</Label>
                  <Input
                    id="camp-link"
                    value={form.link_url}
                    onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                {form.channel === "whatsapp" && (
                  <div>
                    <Label>Mídia no cabeçalho (opcional)</Label>
                    {mediaAssets.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Nenhum arquivo na biblioteca ainda — envie um na aba "Biblioteca de mídia".
                      </p>
                    ) : (
                      <div className="mt-1 grid max-h-40 grid-cols-4 gap-2 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, media_id: "" })}
                          className={`flex h-16 items-center justify-center rounded-md border text-[11px] text-muted-foreground ${
                            form.media_id === ""
                              ? "border-primary ring-1 ring-primary"
                              : "border-border"
                          }`}
                        >
                          Sem mídia
                        </button>
                        {mediaAssets.map((asset) => (
                          <button
                            type="button"
                            key={asset.id}
                            onClick={() => setForm({ ...form, media_id: asset.id })}
                            title={asset.file_name}
                            className={`h-16 overflow-hidden rounded-md border ${
                              form.media_id === asset.id
                                ? "border-primary ring-1 ring-primary"
                                : "border-border"
                            }`}
                          >
                            {asset.media_type === "IMAGE" ? (
                              <img
                                src={asset.public_url}
                                alt={asset.file_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                                {asset.file_name}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <Label>Envio</Label>
                  <Select
                    value={form.scheduleMode}
                    onValueChange={(v) => setForm({ ...form, scheduleMode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Disparar agora</SelectItem>
                      <SelectItem value="later">Agendar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.scheduleMode === "later" && (
                  <div>
                    <Label htmlFor="camp-agenda">Data e hora</Label>
                    <Input
                      id="camp-agenda"
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requer um cron externo configurado chamando /api/public/run-scheduled.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvar}>
                  {editingId
                    ? "Salvar alterações"
                    : form.scheduleMode === "later"
                      ? "Agendar campanha"
                      : "Criar rascunho"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma campanha criada ainda." />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <StatusBadge status={c.status} />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {c.channel === "email" ? "E-mail" : "WhatsApp"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {AUDIENCE_LABEL[c.audience ?? "press"]}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Alvo: {alvoLabel(c)} · criada em{" "}
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  {c.status === "SCHEDULED" && c.scheduled_at
                    ? ` · agendada para ${new Date(c.scheduled_at).toLocaleString("pt-BR")}`
                    : ""}
                  {c.sent_at ? ` · enviada em ${new Date(c.sent_at).toLocaleString("pt-BR")}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                {c.status === "DRAFT" || c.status === "FAILED" || c.status === "SCHEDULED" ? (
                  <Button size="sm" onClick={() => enviar(c.id)} disabled={sendingId === c.id}>
                    <Send className="mr-1.5 h-4 w-4" />
                    {sendingId === c.id
                      ? "Enviando..."
                      : c.status === "SCHEDULED"
                        ? "Disparar agora"
                        : "Disparar"}
                  </Button>
                ) : null}
                {c.status === "DRAFT" || c.status === "FAILED" || c.status === "SCHEDULED" ? (
                  <Button size="icon" variant="ghost" onClick={() => editar(c)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button size="icon" variant="ghost" onClick={() => remover(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
