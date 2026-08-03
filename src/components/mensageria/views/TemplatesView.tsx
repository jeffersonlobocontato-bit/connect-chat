import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatusBadge } from "../ui-bits";

type Template = {
  id: string;
  meta_template_name: string | null;
  name: string | null;
  category: string;
  language: string;
  body_text: string;
  status: string;
  tags: string[];
  usage_count: number;
  last_used_at: string | null;
  channel: string;
  subject: string | null;
  html_body: string | null;
};

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utilitário" },
  { value: "AUTHENTICATION", label: "Autenticação" },
];

const STATUSES = [
  { value: "APPROVED", label: "Aprovado" },
  { value: "PENDING", label: "Em análise" },
  { value: "REJECTED", label: "Rejeitado" },
];

export function TemplatesView() {
  const [rows, setRows] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    channel: "whatsapp",
    name: "",
    meta_template_name: "",
    category: "MARKETING",
    language: "pt_BR",
    body_text: "",
    status: "PENDING",
    subject: "",
    html_body: "",
    tags: "",
  });

  async function carregar() {
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvar() {
    if (form.channel === "whatsapp") {
      if (!/^[a-z0-9_]+$/.test(form.meta_template_name)) {
        toast.error("O nome do template deve usar apenas letras minúsculas, números e underline");
        return;
      }
      if (!form.body_text.trim()) {
        toast.error("Escreva o corpo da mensagem");
        return;
      }
    } else {
      if (!form.name.trim()) {
        toast.error("Dê um nome ao template");
        return;
      }
      if (!form.subject.trim() || !form.html_body.trim()) {
        toast.error("Preencha o assunto e o corpo do e-mail");
        return;
      }
    }

    const { error } = await supabase.from("message_templates").insert({
      channel: form.channel,
      name: form.channel === "email" ? form.name.trim() : form.meta_template_name,
      meta_template_name: form.channel === "whatsapp" ? form.meta_template_name : null,
      category: form.category,
      language: form.language,
      body_text: form.channel === "whatsapp" ? form.body_text.trim() : form.subject || form.name,
      subject: form.channel === "email" ? form.subject.trim() : null,
      html_body: form.channel === "email" ? form.html_body.trim() : null,
      status: form.channel === "whatsapp" ? form.status : "APPROVED",
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    if (error) {
      toast.error(
        error.code === "23505" ? "Já existe um template com esse nome" : "Erro ao salvar template",
      );
      return;
    }
    toast.success("Template cadastrado");
    setOpen(false);
    setForm({
      ...form,
      name: "",
      meta_template_name: "",
      body_text: "",
      subject: "",
      html_body: "",
      tags: "",
    });
    void carregar();
  }

  async function remover(id: string) {
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover — verifique se há campanhas usando este template");
      return;
    }
    void carregar();
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Modelos aprovados na Meta usados nos disparos. Use {{1}} para variáveis."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo template</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Canal</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) => setForm({ ...form, channel: v })}
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

                {form.channel === "whatsapp" ? (
                  <>
                    <div className="sm:col-span-2">
                      <Label htmlFor="tpl-nome">Nome na Meta</Label>
                      <Input
                        id="tpl-nome"
                        placeholder="release_imprensa_aiv"
                        value={form.meta_template_name}
                        onChange={(e) =>
                          setForm({ ...form, meta_template_name: e.target.value.toLowerCase() })
                        }
                      />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select
                        value={form.category}
                        onValueChange={(v) => setForm({ ...form, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status na Meta</Label>
                      <Select
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="tpl-corpo">Corpo da mensagem</Label>
                      <Textarea
                        id="tpl-corpo"
                        rows={5}
                        placeholder="Olá {{1}}, a Agência Vozes divulga hoje..."
                        value={form.body_text}
                        onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <Label htmlFor="tpl-email-nome">Nome do template</Label>
                      <Input
                        id="tpl-email-nome"
                        placeholder="Release de imprensa — padrão"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="tpl-assunto">Assunto</Label>
                      <Input
                        id="tpl-assunto"
                        placeholder="AIV divulga {{nome}} — confira o release"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="tpl-html">Corpo do e-mail (HTML)</Label>
                      <Textarea
                        id="tpl-html"
                        rows={8}
                        placeholder="<p>Olá {{nome}},</p><p>A AIV divulga hoje...</p><p><a href='{{link}}'>Acesse o material</a></p>"
                        value={form.html_body}
                        onChange={(e) => setForm({ ...form, html_body: e.target.value })}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Variáveis disponíveis: {"{{nome}}"}, {"{{veiculo}}"}, {"{{link}}"}
                      </p>
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <Label htmlFor="tpl-tags">Etiquetas</Label>
                  <Input
                    id="tpl-tags"
                    placeholder="release, convite"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvar}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum template cadastrado ainda." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-medium">
                    {t.channel === "email" ? t.name : t.meta_template_name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t.channel === "email"
                      ? "E-mail"
                      : `${CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category} · ${t.language}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={t.status === "APPROVED" ? "SENT" : t.status} />
                  <Button size="icon" variant="ghost" onClick={() => remover(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {t.channel === "email" ? (
                <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{t.subject}</div>
                  <div
                    className="prose-sm max-h-32 overflow-hidden text-xs text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: t.html_body ?? "" }}
                  />
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                  {t.body_text}
                </p>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                Usado {t.usage_count}x
                {t.last_used_at
                  ? ` · último uso em ${new Date(t.last_used_at).toLocaleDateString("pt-BR")}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
