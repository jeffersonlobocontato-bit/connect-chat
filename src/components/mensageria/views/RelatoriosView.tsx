import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "../ui-bits";

type Log = {
  id: string;
  phone: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  journalists: { name: string; outlet: string | null } | null;
};

export function RelatoriosView() {
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string>("");
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .order("created_at", { ascending: false });
      setCampaigns(data ?? []);
      if (data && data[0]) setSelected(data[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    void (async () => {
      const { data } = await supabase
        .from("dispatch_logs")
        .select("id, phone, status, sent_at, error_message, journalists(name, outlet)")
        .eq("campaign_id", selected)
        .order("created_at", { ascending: false });
      setLogs((data ?? []) as unknown as Log[]);
    })();
  }, [selected]);

  const total = logs.length;
  const entregues = logs.filter((l) => l.status === "DELIVERED" || l.status === "READ").length;
  const lidas = logs.filter((l) => l.status === "READ").length;
  const falhas = logs.filter((l) => l.status === "FAILED").length;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Acompanhe entrega, leitura e falhas de cada campanha."
        action={
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
                  <th className="px-4 py-3">Telefone</th>
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
                    <td className="px-4 py-3">{l.phone}</td>
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
