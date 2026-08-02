import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logoNegativo from "@/assets/zapvozes-negativo.png.asset.json";
import logoOriginal from "@/assets/zapvozes.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Disparador de Imprensa AIV" },
      {
        name: "description",
        content:
          "Acesso restrito à equipe da Agência de Imprensa Vozes para gerenciar disparos de WhatsApp à imprensa.",
      },
      { property: "og:title", content: "Entrar · Disparador de Imprensa AIV" },
      {
        property: "og:description",
        content: "Área de acesso da plataforma de mensageria da Agência de Imprensa Vozes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const action =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    const { error } = await action;
    setLoading(false);

    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "E-mail ou senha incorretos"
          : error.message.includes("already registered")
            ? "Este e-mail já tem conta — faça login"
            : error.message.toLowerCase().includes("weak")
              ? "Senha muito fraca — combine letras, números e símbolos"
              : error.message,
      );
      return;
    }
    navigate({ to: "/painel" });
  }

  async function entrarComGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/painel" });
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <img
          src={logoNegativo.url}
          alt="ZapVozes — Plataforma de Disparo de Mensagens"
          className="h-24 w-auto self-start"
        />
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold text-sidebar-accent-foreground">
            Comunicados de imprensa que chegam onde importa.
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/80">
            Base segmentada de jornalistas, templates aprovados e relatórios de leitura em um só
            painel.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Acesso restrito à equipe autorizada.</p>
      </div>


      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <img
            src={logoOriginal.url}
            alt="ZapVozes — Plataforma de Disparo de Mensagens"
            className="mb-8 h-20 w-auto lg:hidden"
          />
          <h1 className="font-display text-2xl font-semibold">

            {mode === "login" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Acesse o disparador de imprensa."
              : "A primeira conta criada recebe acesso de administrador."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={entrarComGoogle}>
            Continuar com Google
          </Button>

          <button
            type="button"
            className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
