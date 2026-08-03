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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { describeRules, matchesRules, type SegmentRule } from "@/lib/segments";
import { EmptyState, PageHeader } from "../ui-bits";

type Journalist = {
  id: string;
  outlet: string | null;
  region: string | null;
  tags: string[];
};

type Segment = {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRule[];
};

export function SegmentacaoView() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [base, setBase] = useState<Journalist[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [field, setField] = useState<SegmentRule["field"]>("tags");
  const [value, setValue] = useState("");

  async function carregar() {
    const [segRes, baseRes] = await Promise.all([
      supabase.from("segments").select("*").order("created_at", { ascending: false }),
      supabase
        .from("journalists")
        .select("id, outlet, region, tags")
        .eq("active", true)
        .eq("opt_in", true),
    ]);
    setSegments(
      (segRes.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        rules: (s.rules ?? []) as unknown as SegmentRule[],
      })),
    );
    setBase(baseRes.data ?? []);
  }

  useEffect(() => {
    void carregar();
  }, []);

  const previewCount = useMemo(
    () => base.filter((j) => matchesRules(j, rules)).length,
    [base, rules],
  );

  const sugestoes = useMemo(() => {
    if (field === "tags") return Array.from(new Set(base.flatMap((j) => j.tags))).slice(0, 12);
    return Array.from(
      new Set(base.map((j) => (field === "outlet" ? j.outlet : j.region)).filter(Boolean)),
    ).slice(0, 12) as string[];
  }, [base, field]);

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
    setRules(s.rules ?? []);
    setValue("");
    setOpen(true);
  }

  async function salvar() {
    if (!name.trim()) {
      toast.error("Dê um nome ao segmento");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
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

  return (
    <div>
      <PageHeader
        title="Segmentação"
        subtitle="Agrupe a base por etiqueta, veículo ou região para disparos direcionados."
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
                        <SelectItem value="tags">Etiqueta</SelectItem>
                        <SelectItem value="outlet">Veículo</SelectItem>
                        <SelectItem value="region">Região</SelectItem>
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
                          onClick={() => setValue(value ? `${value}, ${s}` : s)}
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
                    Alcance estimado: <strong>{previewCount}</strong> jornalistas com opt-in
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
                  <div className="font-medium">{s.name}</div>
                  {s.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  ) : null}
                </div>
                <Button size="icon" variant="ghost" onClick={() => remover(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{describeRules(s.rules)}</p>
              <div className="mt-3 text-sm">
                <strong>{base.filter((j) => matchesRules(j, s.rules)).length}</strong> jornalistas
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
