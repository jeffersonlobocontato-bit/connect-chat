# Plataforma de Mensageria AIV — Disparador de Imprensa (WhatsApp)

Construção da plataforma completa, adaptada do material enviado (`DisparadorImprensaV2.tsx` + `schema_v2_additions.sql`), com login, papel de admin e envio em **modo simulado** até as credenciais da Meta existirem.

## O que muda em relação ao arquivo enviado

O zip traz apenas o front v2 e a migração v2 — o `schema.sql` base e as Edge Functions citadas no README não vieram. Além disso, este projeto roda em TanStack Start, onde a lógica de servidor fica em funções de servidor, não em Edge Functions. Então o schema base será escrito do zero e o envio será uma função de servidor interna.

## Backend (Lovable Cloud)

Banco com RLS e papel de admin em tabela separada:

- `user_roles` + função `has_role` (admin)
- `profiles` (nome do usuário)
- `journalists` — nome, telefone E.164, veículo, cargo, cidade/região, tags, opt_in, ativo
- `contact_lists` / `contact_list_members` — listas fixas
- `segments` — segmentação dinâmica por regras JSON (veículo, região, tags)
- `message_templates` — biblioteca com categoria, status de aprovação, corpo, tags, contagem de uso
- `campaigns` — lista OU segmento, template, agendamento, status, reengajamento
- `dispatch_logs` — 1 linha por destinatário: enviado / entregue / lido / falhou
- `short_links` + `short_link_clicks` — encurtador com rastreio
- `waba_config` — número, quality_rating, messaging_limit_tier

Todas as tabelas: acesso somente para admin autenticado, com os GRANTs necessários.

## Módulos da interface

Sidebar navy #0A2540 com destaque #0066CC, seguindo o layout do arquivo enviado:

1. **Dashboard** — KPIs (base total, opt-in, campanhas do mês, taxa de leitura) e cartão de saúde do número.
2. **Jornalistas** — tabela, busca, filtro por veículo/região/opt-in, importação CSV no formato do README (`name,phone,outlet,role,city,opt_in`) com validação de E.164 e criação de lista a partir do import.
3. **Segmentação** — criar segmentos por regras, com prévia da contagem de destinatários elegíveis.
4. **Templates** — biblioteca com prévia em balão de conversa, tags, ordenação por uso.
5. **Campanhas** — escolher template, alvo (lista ou segmento), anexo/link, encurtador, envio imediato ou agendado.
6. **Relatórios** — desempenho por campanha, exportação CSV, botão de reengajamento que recria a campanha só para quem não leu.
7. **Configurações** — dados do WABA, qualidade do número e limite de envio.

## Envio (modo simulado agora, real depois)

Uma função de servidor `sendCampaign` monta a lista de destinatários, grava os `dispatch_logs` e chama um adaptador de envio. Enquanto não houver credenciais, o adaptador roda em modo simulado (marca enviado/entregue e sorteia leituras) e a interface mostra um aviso claro de "modo de teste". Quando você tiver o token permanente e o `phone_number_id`, basta preencher os segredos que o mesmo adaptador passa a chamar a WhatsApp Cloud API — nenhuma tela precisa ser refeita.

Também ficam prontos, para quando o envio real for ligado:
- rota pública `/api/public/whatsapp-webhook` para receber status de entrega/leitura da Meta;
- rota pública de redirecionamento do link curto, que conta o clique.

## Acesso

- Tela `/auth` com e-mail e senha (confirmação de e-mail desativada para facilitar o teste).
- Todo o painel fica atrás de rota autenticada; quem não for admin vê aviso de acesso restrito.
- O primeiro usuário cadastrado vira admin automaticamente.

## Detalhes técnicos

- Funções de servidor TanStack (`createServerFn`) com middleware de autenticação; nada de Edge Functions.
- Agendamento: campanhas ficam em `SCHEDULED`; o processamento pode ser disparado por rota pública protegida por segredo (cron), a ligar depois.
- Uploads de foto/vídeo do disparo via storage do Cloud.
- Sem chaves da Meta no front — tudo lido no servidor.
