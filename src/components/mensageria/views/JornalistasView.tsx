import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/segments";
import { EmptyState, PageHeader } from "../ui-bits";

type Journalist = {
  id: string;
  name: string;
  phone: string;
  outlet: string | null;
  role_title: string | null;
  region: string | null;
  tags: string[];
  opt_in: boolean;
  active: boolean;
};

const EMPTY = {
  name: "",
  phone: "",
  outlet: "",
  role_title: "",
  region: "",
  tags: "",
  opt_in: true,
  active: true,
};

export function JornalistasView() {
  const [rows, setRows] = useState<Journalist[]>([]);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function carregar() {
    const { data, error } = await supabase
      .from("journalists")
      .select("*")
      .order("name", { ascending: true });
    if (error) toast.error("Não foi possível carregar a base");
    setRows(data ?? []);
  }

  useEffect(() => {
    void carregar();
  }, []);

  function abrirNovo() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function abrirEdicao(j: Journalist) {
    setEditing(j.id);
    setForm({
      name: j.name,
      phone: j.phone,
      outlet: j.outlet ?? "",
      role_title: j.role_title ?? "",
      region: j.region ?? "",
      tags: j.tags.join(", "),
      opt_in: j.opt_in,
      active: j.active,
    });
    setOpen(true);
  }

  async function salvar() {
    const phone = normalizePhone(form.phone);
    if (!form.name.trim()) return toast.error("Informe o nome do jornalista");
    if (!phone) return toast.error("Telefone inválido — use DDI + DDD + número");

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone,
      outlet: form.outlet.trim() || null,
      role_title: form.role_title.trim() || null,
      region: form.region.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      opt_in: form.opt_in,
      active: form.active,
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
    toast.success(editing ? "Cadastro atualizado" : "Jornalista adicionado");
    setOpen(false);
    void carregar();
  }

  async function remover(id: string) {
    const { error } = await supabase.from("journalists").delete().eq("id", id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Cadastro removido");
    void carregar();
  }

  const filtradas = rows.filter((j) =>
    [j.name, j.outlet, j.region, j.tags.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(busca.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Jornalistas"
        subtitle="Base de contatos de imprensa com controle de opt-in."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={abrirNovo}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo jornalista
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar jornalista" : "Novo jornalista"}</DialogTitle>
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
                <div className="sm:col-span-2">
                  <Label htmlFor="tags">Etiquetas (separadas por vírgula)</Label>
                  <Input
                    id="tags"
                    placeholder="política, economia"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">Opt-in</span>
                  <Switch
                    checked={form.opt_in}
                    onCheckedChange={(v) => setForm({ ...form, opt_in: v })}
                  />
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
          placeholder="Buscar por nome, veículo, região ou etiqueta"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtradas.length === 0 ? (
        <EmptyState message="Nenhum jornalista encontrado." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Região</th>
                <th className="px-4 py-3">Etiquetas</th>
                <th className="px-4 py-3">Opt-in</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{j.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.role_title ? `${j.role_title} · ` : ""}
                      {j.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">{j.outlet ?? "—"}</td>
                  <td className="px-4 py-3">{j.region ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {j.tags.map((t) => (
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
                        j.opt_in ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {j.opt_in ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEdicao(j)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remover(j.id)}>
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
