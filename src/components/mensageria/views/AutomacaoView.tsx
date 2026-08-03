import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "../ui-bits";

type CannedResponse = { id: string; title: string; body: string };
type AutoTagRule = { id: string; keyword: string; tag: string; active: boolean };

export function AutomacaoView() {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [rules, setRules] = useState<AutoTagRule[]>([]);
  const [respForm, setRespForm] = useState({ title: "", body: "" });
  const [ruleForm, setRuleForm] = useState({ keyword: "", tag: "" });

  async function carregar() {
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from("canned_responses").select("id, title, body").order("title"),
      supabase.from("auto_tag_rules").select("id, keyword, tag, active").order("keyword"),
    ]);
    setResponses((r ?? []) as CannedResponse[]);
    setRules((t ?? []) as AutoTagRule[]);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvarResposta() {
    if (!respForm.title.trim() || !respForm.body.trim()) {
      toast.error("Preencha título e texto da resposta");
      return;
    }
    const { error } = await supabase
      .from("canned_responses")
      .insert({ title: respForm.title.trim(), body: respForm.body.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRespForm({ title: "", body: "" });
    toast.success("Resposta rápida criada");
    void carregar();
  }

  async function salvarRegra() {
    if (!ruleForm.keyword.trim() || !ruleForm.tag.trim()) {
      toast.error("Preencha palavra-chave e etiqueta");
      return;
    }
    const { error } = await supabase
      .from("auto_tag_rules")
      .insert({ keyword: ruleForm.keyword.trim(), tag: ruleForm.tag.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRuleForm({ keyword: "", tag: "" });
    toast.success("Regra criada");
    void carregar();
  }

  async function excluirResposta(id: string) {
    await supabase.from("canned_responses").delete().eq("id", id);
    void carregar();
  }

  async function excluirRegra(id: string) {
    await supabase.from("auto_tag_rules").delete().eq("id", id);
    void carregar();
  }

  async function alternarRegra(rule: AutoTagRule) {
    await supabase.from("auto_tag_rules").update({ active: !rule.active }).eq("id", rule.id);
    void carregar();
  }

  return (
    <div>
      <PageHeader
        title="Automação"
        subtitle="Respostas rápidas para a Caixa de Entrada e etiquetagem automática por palavra-chave."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Respostas rápidas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aparecem como atalhos abaixo da conversa; um clique preenche o campo de resposta.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <Label>Título</Label>
              <Input
                value={respForm.title}
                placeholder="Ex.: Agradecimento"
                onChange={(e) => setRespForm({ ...respForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Texto</Label>
              <Textarea
                rows={3}
                value={respForm.body}
                placeholder="Obrigado pelo retorno! Qualquer material extra, é só pedir."
                onChange={(e) => setRespForm({ ...respForm, body: e.target.value })}
              />
            </div>
            <Button onClick={salvarResposta} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            {responses.length === 0 ? (
              <EmptyState message="Nenhuma resposta rápida cadastrada." />
            ) : (
              responses.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.body}</div>
                  </div>
                  <button
                    onClick={() => void excluirResposta(r.id)}
                    className="text-muted-foreground transition hover:text-destructive"
                    aria-label={`Excluir ${r.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Etiquetas automáticas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Quando a mensagem recebida contém a palavra-chave, o contato ganha a etiqueta —
            sem acento e sem diferenciar maiúsculas.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Palavra-chave</Label>
              <Input
                value={ruleForm.keyword}
                placeholder="Ex.: entrevista"
                onChange={(e) => setRuleForm({ ...ruleForm, keyword: e.target.value })}
              />
            </div>
            <div>
              <Label>Etiqueta</Label>
              <Input
                value={ruleForm.tag}
                placeholder="Ex.: Interessado"
                onChange={(e) => setRuleForm({ ...ruleForm, tag: e.target.value })}
              />
            </div>
          </div>
          <Button className="mt-3" size="sm" onClick={salvarRegra}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar
          </Button>

          <div className="mt-5 space-y-2">
            {rules.length === 0 ? (
              <EmptyState message="Nenhuma regra cadastrada." />
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">{rule.keyword}</span>
                    <span className="text-muted-foreground"> → {rule.tag}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.active}
                      onCheckedChange={() => void alternarRegra(rule)}
                      aria-label="Ativar regra"
                    />
                    <button
                      onClick={() => void excluirRegra(rule.id)}
                      className="text-muted-foreground transition hover:text-destructive"
                      aria-label={`Excluir regra ${rule.keyword}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
