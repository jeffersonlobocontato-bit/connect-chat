import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Monta com IA o corpo do e-mail (texto, foto e CTAs) a partir de uma
 * matéria publicada ou de um link avulso. Devolve o HTML para pré-visualização
 * no painel; a gravação na campanha é feita pelo próprio formulário.
 */
export const generateCampaignEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      releaseId?: string | null;
      linkUrl?: string | null;
      campaignName?: string | null;
      instructions?: string | null;
      imageUrl?: string | null;
    }) => ({
      releaseId: input?.releaseId ?? null,
      linkUrl: input?.linkUrl ?? null,
      campaignName: input?.campaignName ?? null,
      instructions: input?.instructions ?? null,
      imageUrl: input?.imageUrl ?? null,
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    if (!data.releaseId && !data.linkUrl?.trim()) {
      throw new Error("Escolha uma matéria publicada ou informe o link do material");
    }

    const { generateEmailFromRelease } = await import("@/lib/campaign-email-ai.server");
    const origin = new URL(getRequest().url).origin;
    return generateEmailFromRelease({ ...data, origin });
  });
