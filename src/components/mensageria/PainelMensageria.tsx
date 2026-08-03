import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Filter,
  FileText,
  Send,
  BarChart3,
  Settings,
  ImageIcon,
  LogOut,
  MessageCircle,
  Zap,
  Newspaper,
  ShieldCheck,
} from "lucide-react";
import logoNegativo from "@/assets/zapvozes-negativo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { DashboardView } from "./views/DashboardView";
import { JornalistasView } from "./views/JornalistasView";
import { LeadsView } from "./views/LeadsView";
import { SegmentacaoView } from "./views/SegmentacaoView";
import { TemplatesView } from "./views/TemplatesView";
import { MediaLibraryView } from "./views/MediaLibraryView";
import { CampanhasView } from "./views/CampanhasView";
import { ConversasView } from "./views/ConversasView";
import { AutomacaoView } from "./views/AutomacaoView";
import { ReleasesView } from "./views/ReleasesView";
import { UsuariosView } from "./views/UsuariosView";
import { RelatoriosView } from "./views/RelatoriosView";
import { ConfiguracoesView } from "./views/ConfiguracoesView";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, agent: true },
  { key: "jornalistas", label: "Jornalistas", icon: Users, agent: false },
  { key: "leads", label: "Leads gerais", icon: UserPlus, agent: false },
  { key: "segmentacao", label: "Segmentação", icon: Filter, agent: false },
  { key: "templates", label: "Templates", icon: FileText, agent: false },
  { key: "midia", label: "Biblioteca de mídia", icon: ImageIcon, agent: false },
  { key: "campanhas", label: "Campanhas", icon: Send, agent: false },
  { key: "conversas", label: "Conversas", icon: MessageCircle, agent: true },
  { key: "automacao", label: "Automação", icon: Zap, agent: false },
  { key: "releases", label: "Releases", icon: Newspaper, agent: false },
  { key: "usuarios", label: "Usuários", icon: ShieldCheck, agent: false },
  { key: "relatorios", label: "Relatórios", icon: BarChart3, agent: false },
  { key: "configuracoes", label: "Configurações", icon: Settings, agent: false },
] as const;

type NavKey = (typeof NAV)[number]["key"];

export function PainelMensageria() {
  const navigate = useNavigate();
  const [active, setActive] = useState<NavKey>("dashboard");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isAgent, setIsAgent] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      setEmail(userData.user?.email ?? "");
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user?.id ?? "");
      if (cancelled) return;
      const roles = (data ?? []).map((r) => r.role as string);
      setIsAdmin(roles.includes("admin"));
      setIsAgent(roles.includes("user"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const navItems = NAV.filter((item) => isAdmin || item.agent);

  if (isAdmin === false && !isAgent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A conta {email} ainda não tem permissão para usar a plataforma. Peça a um administrador
            para liberar o acesso.
          </p>
          <Button className="mt-6" variant="outline" onClick={sair}>
            Sair
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <img
            src={logoNegativo.url}
            alt="ZapVozes — Plataforma de Disparo de Mensagens"
            className="h-16 w-auto"
          />
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="truncate px-2 pb-2 text-xs text-sidebar-foreground/70">{email}</div>
          <button
            onClick={sair}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar px-3 py-2 md:hidden">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition ${
                active === item.key
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {active === "dashboard" && <DashboardView />}
          {active === "jornalistas" && <JornalistasView />}
          {active === "leads" && <LeadsView />}
          {active === "segmentacao" && <SegmentacaoView />}
          {active === "templates" && <TemplatesView />}
          {active === "midia" && <MediaLibraryView />}
          {active === "campanhas" && <CampanhasView />}
          {active === "conversas" && <ConversasView />}
          {active === "automacao" && <AutomacaoView />}
          {active === "releases" && <ReleasesView />}
          {active === "usuarios" && <UsuariosView />}
          {active === "relatorios" && <RelatoriosView />}
          {active === "configuracoes" && <ConfiguracoesView />}
        </main>
      </div>
    </div>
  );
}
