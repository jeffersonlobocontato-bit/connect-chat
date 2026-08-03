import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { reengageCampaign } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "../ui-bits";

type Log = {
  id: string;
  phone: string | null;
  email: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  journalists: { name: string; outlet: string | null } | null;
};

type CampaignOption = { id: string; name: string; channel: string; status: string };

export function RelatoriosView() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [reengaging, setReengaging] = useState(false);
  const reengajar = useServerFn(reengageCampaign);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, channel, status")
        .order("created_at", { ascending: false });
      setCampaigns((data ?? []) as CampaignOption[]);
      if (data && data[0]) setSelected(data[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    void (async () => {
      const { data } = await supabase
        .from("dispatch_logs")
        .select("id, phone, email, status, sent_at, error_message, journalists(name, outlet)")
        .eq("campaign_id", selected)
        .order("created_at", { ascending: false });
      setLogs((data ?? []) as unknown as Log[]);
    })();
  }, [selected]);

  const campanhaAtual = campaigns.find((c) => c.id === selected);
  const total = logs.length;
  const entregues = logs.filter((l) => l.status === "DELIVERED" || l.status === "READ").length;
  const lidas = logs.filter((l) => l.status === "READ").length;
  const falhas = logs.filter((l) => l.status === "FAILED").length;
  const naoLidos = logs.filter((l) => l.status !== "READ" && l.status !== "FAILED").length;

  function exportarCsv() {
    const header = "nome,veiculo,destino,status,enviado_em,erro\n";
    const linhas = logs
      .map((l) =>
        [
          l.journalists?.name ?? "",
          l.journalists?.outlet ?? "",
          l.phone ?? l.email ?? "",
          l.status,
          l.sent_at ?? "",
          l.error_message ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([header + linhas], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${campanhaAtual?.name ?? selected}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function reengajarAgora() {
    if (!selected) return;
    setReengaging(true);
    try {
      const result = await reengajar({ data: { campaignId: selected } });
      toast.success(`Reengajamento disparado para ${result.targeted} contatos`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reengajar");
    } finally {
      setReengaging(false);
    }
  }

  const podeReengajar =
    campanhaAtual &&
    (campanhaAtual.status === "SENT" || campanhaAtual.status === "FAILED") &&
    naoLidos > 0;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Acompanhe entrega, leitura e falhas de cada campanha."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Escolha uma campanha" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportarCsv} disabled={logs.length === 0}>
              <Download className="mr-1.5 h-4 w-4" />
              Exportar CSV
            </Button>
            {podeReengajar && (
              <Button size="sm" onClick={reengajarAgora} disabled={reengaging}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                {reengaging ? "Reengajando..." : `Reengajar (${naoLidos})`}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Disparos" value={total} />
        <KpiCard
          label="Entregues"
          value={entregues}
          hint={total ? `${Math.round((entregues / total) * 100)}% da base` : undefined}
        />
        <KpiCard
          label="Lidas"
          value={lidas}
          hint={entregues ? `${Math.round((lidas / entregues) * 100)}% das entregues` : undefined}
        />
        <KpiCard label="Falhas" value={falhas} />
      </div>

      <div className="mt-6">
        {logs.length === 0 ? (
          <EmptyState message="Nenhum disparo registrado para esta campanha." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Jornalista</th>
                  <th className="px-4 py-3">Destino</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.journalists?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.journalists?.outlet ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{l.phone ?? l.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                      {l.error_message ? (
                        <div className="mt-1 max-w-xs truncate text-xs text-destructive">
                          {l.error_message}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.sent_at ? new Date(l.sent_at).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
