import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getSendingMode } from "@/lib/campaigns.functions";
import { Activity, TriangleAlert } from "lucide-react";
import { KpiCard, PageHeader, StatusBadge } from "../ui-bits";

type Stats = {
  press: number;
  leads: number;
  optIn: number;
  campaignsMonth: number;
  readRate: number;
};

const QUALITY_LABEL: Record<string, string> = {
  GREEN: "Alta",
  YELLOW: "Média",
  RED: "Baixa",
  UNKNOWN: "Não avaliada",
};

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [waba, setWaba] = useState<{
    display_name: string;
    quality_rating: string;
    messaging_limit_tier: string | null;
  } | null>(null);
  const [recent, setRecent] = useState<
    Array<{ id: string; name: string; status: string; created_at: string }>
  >([]);
  const [live, setLive] = useState<boolean | null>(null);
  const checkMode = useServerFn(getSendingMode);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [pressRes, leadsRes, optInRes, campaignsRes, logsRes, wabaRes, recentRes] =
        await Promise.all([
          supabase
            .from("journalists")
            .select("id", { count: "exact", head: true })
            .eq("audience", "press"),
          supabase
            .from("journalists")
            .select("id", { count: "exact", head: true })
            .eq("audience", "lead"),
          supabase
            .from("journalists")
            .select("id", { count: "exact", head: true })
            .eq("opt_in_whatsapp", true)
            .eq("active", true),
          supabase
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .gte("created_at", monthStart.toISOString()),
          supabase.from("dispatch_logs").select("status"),
          supabase.from("waba_config").select("*").eq("active", true).limit(1).maybeSingle(),
          supabase
            .from("campaigns")
            .select("id, name, status, created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      if (cancelled) return;

      const logs = logsRes.data ?? [];
      const delivered = logs.filter((l) => l.status !== "FAILED").length;
      const read = logs.filter((l) => l.status === "READ").length;

      setStats({
        press: pressRes.count ?? 0,
        leads: leadsRes.count ?? 0,
        optIn: optInRes.count ?? 0,
        campaignsMonth: campaignsRes.count ?? 0,
        readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
      });
      setWaba(wabaRes.data ?? null);
      setRecent(recentRes.data ?? []);
    })();

    checkMode({})
      .then((r) => setLive(r.live))
      .catch(() => setLive(false));

    return () => {
      cancelled = true;
    };
  }, [checkMode]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da base de imprensa e da saúde do número de WhatsApp."
      />

      {live === false ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <div>
            <strong className="font-medium">Modo de teste ativo.</strong> Nenhuma mensagem real é
            enviada pelo WhatsApp. Assim que as credenciais da Meta forem cadastradas, os mesmos
            disparos passam a sair de verdade.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Jornalistas" value={stats?.press ?? "—"} hint="base de imprensa" />
        <KpiCard label="Leads gerais" value={stats?.leads ?? "—"} hint="relacionamento" />
        <KpiCard
          label="Opt-in WhatsApp"
          value={stats?.optIn ?? "—"}
          hint="autorizados a receber"
        />
        <KpiCard label="Campanhas no mês" value={stats?.campaignsMonth ?? "—"} />
        <KpiCard
          label="Taxa de leitura"
          value={stats ? `${stats.readRate}%` : "—"}
          hint="sobre mensagens entregues"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4 text-primary" />
            Saúde do número
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Número</div>
              <div className="font-medium">{waba?.display_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Qualidade</div>
              <div className="font-medium">
                {QUALITY_LABEL[waba?.quality_rating ?? "UNKNOWN"]}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Limite de envio</div>
              <div className="font-medium">{waba?.messaging_limit_tier ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="text-sm font-medium">Campanhas recentes</div>
          <div className="mt-4 space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
            ) : (
              recent.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
