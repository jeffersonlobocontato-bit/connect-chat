import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/segments";
import { EmptyState, PageHeader } from "../ui-bits";

export type Audience = "press" | "lead";

export type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  outlet: string | null;
  role_title: string | null;
  region: string | null;
  company: string | null;
  source: string | null;
  stage: string | null;
  owner_note: string | null;
  tags: string[];
  opt_in_whatsapp: boolean;
  opt_in_whatsapp_source: string | null;
  opt_in_email: boolean;
  opt_in_email_source: string | null;
  active: boolean;
  audience: string;
};

// Prova de consentimento (LGPD): o ônus da prova é de quem trata os dados,
// então todo opt-in ligado precisa dizer de onde veio.
const FONTES_CONSENTIMENTO = [
  "Formulário próprio",
  "Solicitação por e-mail",
  "Solicitação por WhatsApp",
  "Indicação/relacionamento prévio",
  "Evento presencial",
  "Cadastro em credenciamento de imprensa",
];

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  outlet: "",
  role_title: "",
  region: "",
  company: "",
  source: "",
  stage: "",
  owner_note: "",
  tags: "",
  opt_in_whatsapp: true,
  opt_in_whatsapp_source: FONTES_CONSENTIMENTO[0]!,
  opt_in_email: true,
  opt_in_email_source: FONTES_CONSENTIMENTO[0]!,
  active: true,
};

type Copy = {
  title: string;
  subtitle: string;
  newLabel: string;
  searchPlaceholder: string;
  empty: string;
  colOne: string;
  colTwo: string;
};

const COPY: Record<Audience, Copy> = {
  press: {
    title: "Jornalistas",
    subtitle: "Base de contatos de imprensa com controle de opt-in.",
    newLabel: "Novo jornalista",
    searchPlaceholder: "Buscar por nome, veículo, região ou etiqueta",
    empty: "Nenhum jornalista encontrado.",
    colOne: "Veículo",
    colTwo: "Região",
  },
  lead: {
    title: "Leads gerais",
    subtitle: "Clientes, apoiadores e contatos de relacionamento, segmentados por etiquetas.",
    newLabel: "Novo lead",
    searchPlaceholder: "Buscar por nome, empresa, origem, estágio ou etiqueta",
    empty: "Nenhum lead cadastrado ainda.",
    colOne: "Empresa",
    colTwo: "Estágio",
  },
};

export function ContatosView({ audience }: { audience: Audience }) {
  const copy = COPY[audience];
  const isLead = audience === "lead";

  const [rows, setRows] = useState<Contact[]>([]);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState<{ whatsapp: boolean; email: boolean }>({
    whatsapp: false,
    email: false,
  });
  const [saving, setSaving] = useState(false);

  async function carregar() {
    const { data, error } = await supabase
      .from("journalists")
      .select("*")
      .eq("audience", audience)
      .order("name", { ascending: true });
    if (error) toast.error("Não foi possível carregar a base");
    setRows((data ?? []) as unknown as Contact[]);
  }

  useEffect(() => {
    setBusca("");
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  function abrirNovo() {
    setEditing(null);
    setForm(EMPTY);
    setOriginal({ whatsapp: false, email: false });
    setOpen(true);
  }

  function abrirEdicao(c: Contact) {
    setEditing(c.id);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email ?? "",
      outlet: c.outlet ?? "",
      role_title: c.role_title ?? "",
      region: c.region ?? "",
      company: c.company ?? "",
      source: c.source ?? "",
      stage: c.stage ?? "",
      owner_note: c.owner_note ?? "",
      tags: (c.tags ?? []).join(", "),
      opt_in_whatsapp: c.opt_in_whatsapp,
      opt_in_whatsapp_source: c.opt_in_whatsapp_source ?? FONTES_CONSENTIMENTO[0]!,
      opt_in_email: c.opt_in_email,
      opt_in_email_source: c.opt_in_email_source ?? FONTES_CONSENTIMENTO[0]!,
      active: c.active,
    });
    setOriginal({ whatsapp: c.opt_in_whatsapp, email: c.opt_in_email });
    setOpen(true);
  }

  async function salvar() {
    const phone = normalizePhone(form.phone);
    if (!form.name.trim()) {
      toast.error("Informe o nome do contato");
      return;
    }
    if (!phone) {
      toast.error("Telefone inválido — use DDI + DDD + número");
      return;
    }
    if (form.email.trim() && !form.email.includes("@")) {
      toast.error("E-mail inválido");
      return;
    }
    if (form.opt_in_whatsapp && !form.opt_in_whatsapp_source) {
      toast.error("Informe a origem do consentimento de WhatsApp");
      return;
    }
    if (form.opt_in_email && !form.opt_in_email_source) {
      toast.error("Informe a origem do consentimento de e-mail");
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const ligouWhatsapp = form.opt_in_whatsapp && !original.whatsapp;
    const ligouEmail = form.opt_in_email && !original.email;

    const payload = {
      name: form.name.trim(),
      phone,
      email: form.email.trim() || null,
      outlet: form.outlet.trim() || null,
      role_title: form.role_title.trim() || null,
      region: form.region.trim() || null,
      company: form.company.trim() || null,
      source: form.source.trim() || null,
      stage: form.stage.trim() || null,
      owner_note: form.owner_note.trim() || null,
      audience,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      opt_in_whatsapp: form.opt_in_whatsapp,
      opt_in_email: form.opt_in_email,
      active: form.active,
      // Só grava data/origem no momento em que o opt-in liga — não sobrescreve
      // uma prova de consentimento existente só porque a tela foi salva de novo.
      ...(ligouWhatsapp || !editing
        ? {
            opt_in_whatsapp_at: form.opt_in_whatsapp ? now : null,
            opt_in_whatsapp_source: form.opt_in_whatsapp ? form.opt_in_whatsapp_source : null,
          }
        : {}),
      ...(ligouEmail || !editing
        ? {
            opt_in_email_at: form.opt_in_email ? now : null,
            opt_in_email_source: form.opt_in_email ? form.opt_in_email_source : null,
          }
        : {}),
    };

    const { error } = editing
      ? await supabase.from("journalists").update(payload).eq("id", editing)
      : await supabase.from("journalists").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(
        error.code === "23505" ? "Já existe um cadastro com esse telefone" : "Erro ao salvar",
      );
      return;
    }
    toast.success(editing ? "Cadastro atualizado" : "Contato adicionado");
    setOpen(false);
    void carregar();
  }

  async function remover(id: string) {
    const { error } = await supabase.from("journalists").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Cadastro removido");
    void carregar();
  }

  const filtradas = rows.filter((c) =>
    [
      c.name,
      c.outlet,
      c.company,
      c.region,
      c.source,
      c.stage,
      c.email,
      (c.tags ?? []).join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(busca.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={abrirNovo}>
              <Plus className="mr-1.5 h-4 w-4" />
              {copy.newLabel}
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar cadastro" : copy.newLabel}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="tel">Telefone (DDI+DDD)</Label>
                  <Input
                    id="tel"
                    placeholder="5511999998888"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={isLead ? "contato@empresa.com.br" : "jornalista@veiculo.com.br"}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                {isLead ? (
                  <>
                    <div>
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input
                        id="empresa"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="origem">Origem</Label>
                      <Input
                        id="origem"
                        placeholder="site, indicação, evento"
                        value={form.source}
                        onChange={(e) => setForm({ ...form, source: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="estagio">Estágio</Label>
                      <Input
                        id="estagio"
                        placeholder="novo, contatado, cliente"
                        value={form.stage}
                        onChange={(e) => setForm({ ...form, stage: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="regiao">Região</Label>
                      <Input
                        id="regiao"
                        placeholder="PR"
                        value={form.region}
                        onChange={(e) => setForm({ ...form, region: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="veiculo">Veículo</Label>
                      <Input
                        id="veiculo"
                        value={form.outlet}
                        onChange={(e) => setForm({ ...form, outlet: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cargo">Cargo</Label>
                      <Input
                        id="cargo"
                        value={form.role_title}
                        onChange={(e) => setForm({ ...form, role_title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="regiao">Região</Label>
                      <Input
                        id="regiao"
                        placeholder="SP"
                        value={form.region}
                        onChange={(e) => setForm({ ...form, region: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <Label htmlFor="tags">Etiquetas (separadas por vírgula)</Label>
                  <Input
                    id="tags"
                    placeholder={isLead ? "apoiador, curitiba" : "política, economia"}
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
                {isLead ? (
                  <div className="sm:col-span-2">
                    <Label htmlFor="obs">Observações</Label>
                    <Textarea
                      id="obs"
                      rows={2}
                      value={form.owner_note}
                      onChange={(e) => setForm({ ...form, owner_note: e.target.value })}
                    />
                  </div>
                ) : null}
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Opt-in WhatsApp</span>
                    <Switch
                      checked={form.opt_in_whatsapp}
                      onCheckedChange={(v) => setForm({ ...form, opt_in_whatsapp: v })}
                    />
                  </div>
                  {form.opt_in_whatsapp && (
                    <Select
                      value={form.opt_in_whatsapp_source}
                      onValueChange={(v) => setForm({ ...form, opt_in_whatsapp_source: v })}
                    >
                      <SelectTrigger className="mt-2 h-8 text-xs">
                        <SelectValue placeholder="Origem do consentimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTES_CONSENTIMENTO.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Opt-in E-mail</span>
                    <Switch
                      checked={form.opt_in_email}
                      onCheckedChange={(v) => setForm({ ...form, opt_in_email: v })}
                    />
                  </div>
                  {form.opt_in_email && (
                    <Select
                      value={form.opt_in_email_source}
                      onValueChange={(v) => setForm({ ...form, opt_in_email_source: v })}
                    >
                      <SelectTrigger className="mt-2 h-8 text-xs">
                        <SelectValue placeholder="Origem do consentimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTES_CONSENTIMENTO.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">Ativo</span>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvar} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={copy.searchPlaceholder}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtradas.length === 0 ? (
        <EmptyState message={copy.empty} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">{copy.colOne}</th>
                <th className="px-4 py-3">{copy.colTwo}</th>
                <th className="px-4 py-3">Etiquetas</th>
                <th className="px-4 py-3">Opt-in WhatsApp</th>
                <th className="px-4 py-3">Opt-in E-mail</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {isLead
                        ? c.source
                          ? `${c.source} · `
                          : ""
                        : c.role_title
                          ? `${c.role_title} · `
                          : ""}
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">{(isLead ? c.company : c.outlet) ?? "—"}</td>
                  <td className="px-4 py-3">{(isLead ? c.stage : c.region) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.opt_in_whatsapp
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.opt_in_whatsapp ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.opt_in_email
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.opt_in_email ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEdicao(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remover(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
