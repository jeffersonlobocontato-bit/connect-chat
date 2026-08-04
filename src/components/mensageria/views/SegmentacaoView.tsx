import { useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { describeRules, matchesRules, type SegmentRule } from "@/lib/segments";
import { EmptyState, PageHeader } from "../ui-bits";

type Contact = {
  id: string;
  audience: string;
  outlet: string | null;
  region: string | null;
  company: string | null;
  source: string | null;
  stage: string | null;
  tags: string[];
  email: string | null;
  phone: string | null;
};

type Segment = {
  id: string;
  name: string;
  description: string | null;
  audience: string;
  rules: SegmentRule[];
};

const PRESS_FIELDS: Array<{ value: SegmentRule["field"]; label: string }> = [
  { value: "tags", label: "Etiqueta" },
  { value: "outlet", label: "Veículo" },
  { value: "region", label: "Região" },
];

const LEAD_FIELDS: Array<{ value: SegmentRule["field"]; label: string }> = [
  { value: "tags", label: "Etiqueta" },
  { value: "company", label: "Empresa" },
  { value: "source", label: "Origem" },
  { value: "stage", label: "Estágio" },
  { value: "region", label: "Região" },
];

export function SegmentacaoView() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [base, setBase] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<"press" | "lead">("press");
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [field, setField] = useState<SegmentRule["field"]>("tags");
  const [value, setValue] = useState("");

  const camposDisponiveis = audience === "lead" ? LEAD_FIELDS : PRESS_FIELDS;

  async function carregarBase(): Promise<Contact[]> {
    // PostgREST devolve no máximo 1.000 linhas por requisição — pagina até o fim.
    const pageSize = 1000;
    const all: Contact[] = [];
    for (let page = 0; ; page += 1) {
      const { data, error } = await supabase
        .from("journalists")
        .select("id, audience, outlet, region, company, source, stage, tags, email, phone")
        .eq("active", true)
        .order("id")
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as unknown as Contact[]));
      if (data.length < pageSize) break;
    }
    return all;
  }

  async function carregar() {
    const [segRes, baseAll] = await Promise.all([
      supabase.from("segments").select("*").order("created_at", { ascending: false }),
      carregarBase(),
    ]);
    setSegments(
      (segRes.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        audience: (s as { audience?: string }).audience ?? "press",
        rules: (s.rules ?? []) as unknown as SegmentRule[],
      })),
    );
    setBase(baseAll);
  }

  useEffect(() => {
    void carregar();
  }, []);

  const basePublico = useMemo(
    () => base.filter((c) => c.audience === audience),
    [base, audience],
  );

  const previewCount = useMemo(
    () => basePublico.filter((c) => matchesRules(c, rules)).length,
    [basePublico, rules],
  );

  const sugestoes = useMemo(() => {
    const todos =
      field === "tags"
        ? basePublico.flatMap((c) => c.tags ?? [])
        : (basePublico
            .map((c) => c[field as "outlet" | "region" | "company" | "source" | "stage"])
            .filter(Boolean) as string[]);
    const unicos = Array.from(new Set(todos)).sort((a, b) => a.localeCompare(b, "pt-BR"));
    // Filtra pelo que está sendo digitado (último valor da lista separada por vírgula).
    const termo = (value.split(",").pop() ?? "").trim().toLowerCase();
    const filtrados = termo ? unicos.filter((s) => s.toLowerCase().includes(termo)) : unicos;
    return filtrados.slice(0, 12);
  }, [basePublico, field, value]);

  function adicionarRegra() {
    const valores = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (valores.length === 0) {
      toast.error("Informe ao menos um valor");
      return;
    }
    setRules([...rules, { field, op: field === "tags" ? "contains" : "in", value: valores }]);
    setValue("");
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setAudience("press");
    setRules([]);
    setValue("");
    setField("tags");
  }

  function abrirNovo() {
    resetForm();
    setOpen(true);
  }

  function abrirEdicao(s: Segment) {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description ?? "");
    setAudience(s.audience === "lead" ? "lead" : "press");
    setRules(s.rules ?? []);
    setValue("");
    setField("tags");
    setOpen(true);
  }

  function trocarPublico(v: string) {
    const novo = v === "lead" ? "lead" : "press";
    setAudience(novo);
    // As regras dependem dos campos do público — recomeça para não misturar.
    setRules([]);
    setField("tags");
    setValue("");
  }

  async function salvar() {
    if (!name.trim()) {
      toast.error("Dê um nome ao segmento");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      audience,
      rules: rules as unknown as never,
    };
    const { error } = editingId
      ? await supabase.from("segments").update(payload).eq("id", editingId)
      : await supabase.from("segments").insert(payload);
    if (error) {
      toast.error("Erro ao salvar segmento");
      return;
    }
    toast.success(editingId ? "Segmento atualizado" : "Segmento criado");
    setOpen(false);
    resetForm();
    void carregar();
  }

  async function remover(id: string) {
    const { error } = await supabase.from("segments").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover — verifique se há campanhas usando este segmento");
      return;
    }
    void carregar();
  }

  function contarSegmento(s: Segment) {
    const alvo = base.filter((c) => c.audience === s.audience && matchesRules(c, s.rules));
    return {
      total: alvo.length,
      email: alvo.filter((c) => (c.email ?? "").trim().length > 0).length,
      whatsapp: alvo.filter((c) => (c.phone ?? "").trim().length > 0).length,
    };
  }


  return (
    <div>
      <PageHeader
        title="Segmentação"
        subtitle="Agrupe a base de imprensa ou de leads para disparos direcionados."
        action={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) resetForm();
            }}
          >
            <Button onClick={abrirNovo}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo segmento
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar segmento" : "Novo segmento"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="seg-nome">Nome</Label>
                  <Input
                    id="seg-nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Editorias de política — SP"
                  />
                </div>
                <div>
                  <Label>Público</Label>
                  <Select value={audience} onValueChange={trocarPublico}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="press">Imprensa (jornalistas)</SelectItem>
                      <SelectItem value="lead">Leads gerais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="seg-desc">Descrição</Label>
                  <Textarea
                    id="seg-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="rounded-lg border border-border p-3">
                  <Label className="text-xs uppercase text-muted-foreground">Regras</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Select
                      value={field}
                      onValueChange={(v) => setField(v as SegmentRule["field"])}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {camposDisponiveis.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="flex-1"
                      placeholder="valores separados por vírgula"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={adicionarRegra}>
                      Adicionar
                    </Button>
                  </div>

                  {sugestoes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sugestoes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            const partes = value.split(",");
                            partes[partes.length - 1] = ` ${s}`;
                            setValue(partes.join(",").trim().replace(/^,\s*/, ""));
                          }}
                          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-1">
                    {rules.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        <span>{describeRules([r])}</span>
                        <button
                          type="button"
                          onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-sm">
                    Alcance estimado: <strong>{previewCount}</strong>{" "}
                    {audience === "lead" ? "leads ativos" : "jornalistas ativos"}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvar}>Salvar segmento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {segments.length === 0 ? (
        <EmptyState message="Nenhum segmento criado ainda." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {segments.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {s.audience === "lead" ? "Leads" : "Imprensa"}
                    </span>
                  </div>
                  {s.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button size="icon" variant="ghost" onClick={() => abrirEdicao(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remover(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{describeRules(s.rules)}</p>
              {(() => {
                const c = contarSegmento(s);
                return (
                  <div className="mt-3 space-y-1 text-sm">
                    <div>
                      <strong>{c.total}</strong> {s.audience === "lead" ? "leads" : "jornalistas"}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground">{c.email}</strong> com e-mail
                      </span>
                      <span>
                        <strong className="text-foreground">{c.whatsapp}</strong> com WhatsApp
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
