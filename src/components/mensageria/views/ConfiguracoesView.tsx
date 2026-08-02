import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getSendingMode } from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "../ui-bits";

type Waba = {
  id: string;
  display_name: string;
  waba_id: string | null;
  phone_number_id: string | null;
  quality_rating: string;
  messaging_limit_tier: string | null;
};

export function ConfiguracoesView() {
  const [waba, setWaba] = useState<Waba | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    waba_id: "",
    phone_number_id: "",
    quality_rating: "UNKNOWN",
    messaging_limit_tier: "TIER_1K",
  });
  const [live, setLive] = useState<boolean | null>(null);
  const checkMode = useServerFn(getSendingMode);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("waba_config")
        .select("*")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (data) {
        setWaba(data);
        setForm({
          display_name: data.display_name,
          waba_id: data.waba_id ?? "",
          phone_number_id: data.phone_number_id ?? "",
          quality_rating: data.quality_rating,
          messaging_limit_tier: data.messaging_limit_tier ?? "TIER_1K",
        });
      }
    })();
    checkMode({})
      .then((r) => setLive(r.live))
      .catch(() => setLive(false));
  }, [checkMode]);

  async function salvar() {
    if (!form.display_name.trim()) {
      toast.error("Informe o número exibido");
      return;
    }
    const payload = {
      display_name: form.display_name.trim(),
      waba_id: form.waba_id.trim() || null,
      phone_number_id: form.phone_number_id.trim() || null,
      quality_rating: form.quality_rating,
      messaging_limit_tier: form.messaging_limit_tier,
      quality_checked_at: new Date().toISOString(),
      active: true,
    };
    const { error } = waba
      ? await supabase.from("waba_config").update(payload).eq("id", waba.id)
      : await supabase.from("waba_config").insert(payload);
    if (error) {
      toast.error("Erro ao salvar configuração");
      return;
    }
    toast.success("Configuração salva");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Configurações"
        subtitle="Dados do número de WhatsApp Business e status da integração."
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-sm font-medium">Status do envio</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {live === null
            ? "Verificando..."
            : live
              ? "Integração ativa: as campanhas enviam mensagens reais pela API da Meta."
              : "Modo de teste: as campanhas registram os disparos sem enviar mensagens reais. Para ativar o envio real, cadastre as credenciais META_WHATSAPP_TOKEN e META_PHONE_NUMBER_ID."}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <div className="text-sm font-medium">Número WhatsApp Business</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="wa-nome">Número exibido</Label>
            <Input
              id="wa-nome"
              placeholder="+55 11 99999-8888"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="wa-id">WABA ID</Label>
            <Input
              id="wa-id"
              value={form.waba_id}
              onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="wa-phone">Phone Number ID</Label>
            <Input
              id="wa-phone"
              value={form.phone_number_id}
              onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
            />
          </div>
          <div>
            <Label>Qualidade</Label>
            <Select
              value={form.quality_rating}
              onValueChange={(v) => setForm({ ...form, quality_rating: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GREEN">Alta</SelectItem>
                <SelectItem value="YELLOW">Média</SelectItem>
                <SelectItem value="RED">Baixa</SelectItem>
                <SelectItem value="UNKNOWN">Não avaliada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Limite de envio</Label>
            <Select
              value={form.messaging_limit_tier}
              onValueChange={(v) => setForm({ ...form, messaging_limit_tier: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TIER_250">250 / dia</SelectItem>
                <SelectItem value="TIER_1K">1.000 / dia</SelectItem>
                <SelectItem value="TIER_10K">10.000 / dia</SelectItem>
                <SelectItem value="TIER_100K">100.000 / dia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-4" onClick={salvar}>
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
