import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { dispatchCampaign } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatusBadge } from "../ui-bits";

type Campaign = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  link_url: string | null;
  template_id: string | null;
  segment_id: string | null;
  list_id: string | null;
};

export function CampanhasView() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; meta_template_name: string }>>([]);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    template_id: "",
    target: "",
    link_url: "",
    media_url: "",
    media_type: "none",
  });
  const disparar = useServerFn(dispatchCampaign);

  async function carregar() {
    const [c, t, s, l] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("message_templates").select("id, meta_template_name").order("meta_template_name"),
      supabase.from("segments").select("id, name").order("name"),
      supabase.from("contact_lists").select("id, name").order("name"),
    ]);
    setRows(c.data ?? []);
    setTemplates(t.data ?? []);
    setSegments(s.data ?? []);
    setLists(l.data ?? []);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvar() {
    if (!form.name.trim()) {
      toast.error("Dê um nome à campanha");
      return;
    }
    if (!form.template_id) {
      toast.error("Escolha um template");
      return;
    }
    if (!form.target) {
      toast.error("Escolha o público-alvo");
      return;
    }
    const [kind, id] = form.target.split(":");
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("campaigns").insert({
      name: form.name.trim(),
      template_id: form.template_id,
      segment_id: kind === "segment" ? id! : null,
      list_id: kind === "list" ? id! : null,
      link_url: form.link_url.trim() || null,
      media_url: form.media_url.trim() || null,
      media_type: form.media_type === "none" ? null : form.media_type,
      status: "DRAFT",
      created_by: userData.user?.id ?? null,
    });
    if (error) {
      toast.error("Erro ao criar campanha");
      return;
    }
    toast.success("Campanha criada como rascunho");
    setOpen(false);
    setForm({ name: "", template_id: "", target: "", link_url: "", media_url: "", media_type: "none" });
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 h-4 w-4" />
                Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova campanha</DialogTitle>
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
                  <Label>Template</Label>
                  <Select
                    value={form.template_id}
                    onValueChange={(v) => setForm({ ...form, template_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.meta_template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Público-alvo</Label>
                  <Select
                    value={form.target}
                    onValueChange={(v) => setForm({ ...form, target: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Segmento ou lista" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((s) => (
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="camp-midia">Mídia no cabeçalho (opcional)</Label>
                    <Input
                      id="camp-midia"
                      value={form.media_url}
                      onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Tipo de mídia</Label>
                    <Select
                      value={form.media_type}
                      onValueChange={(v) => setForm({ ...form, media_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem mídia</SelectItem>
                        <SelectItem value="image">Imagem</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvar}>Criar rascunho</Button>
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
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Alvo: {alvoLabel(c)} · criada em{" "}
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  {c.sent_at
                    ? ` · enviada em ${new Date(c.sent_at).toLocaleString("pt-BR")}`
                    : ""}
                </div>
              </div>
              <div className="flex gap-2">
                {c.status === "DRAFT" || c.status === "FAILED" ? (
                  <Button size="sm" onClick={() => enviar(c.id)} disabled={sendingId === c.id}>
                    <Send className="mr-1.5 h-4 w-4" />
                    {sendingId === c.id ? "Enviando..." : "Disparar"}
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
