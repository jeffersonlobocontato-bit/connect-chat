# O que falta do agendamento automático

## Situação verificada

- `CRON_SECRET` **não existe** no cofre de segredos (hoje só há `RESEND_API_KEY` e a chave interna da Lovable). Sem ele, as rotas `/api/public/run-scheduled` e `/api/public/data-retention` respondem erro e **nada roda**.
- Nenhum agendador está configurado no banco (extensões `pg_cron`/`pg_net` não habilitadas). Ou seja: **as duas partes da sua lista estão pendentes**.
- Consequência prática hoje: campanha marcada como "Agendada" fica parada até você disparar na mão, e os logs antigos nunca são expurgados.

Também estão pendentes, do mesmo pacote anterior: `RESEND_WEBHOOK_SECRET` (rastreio de abertura/clique/bounce por e-mail) e `UNSUBSCRIBE_SECRET` (link de descadastro assinado).

## Recomendação: não precisa do cron-job.org

Dá para agendar **dentro da própria plataforma**, pelo banco, sem criar conta em serviço externo, sem depender de terceiro para a sua campanha sair na hora. Você não precisa fazer nada manualmente.

## Escopo

1. Gerar e cadastrar o `CRON_SECRET` (string aleatória forte, criada automaticamente — você não precisa inventar nem colar nada).
2. Habilitar o agendador no banco.
3. Criar dois agendamentos:
   - **Campanhas agendadas** — a cada 5 minutos, chama `/api/public/run-scheduled`.
   - **Expurgo de logs** — 1x por dia às 3h, chama `/api/public/data-retention`.
4. Conferir o histórico de execução para confirmar que rodou com sucesso (HTTP 200), e não só que foi agendado.

Opcional, se quiser: cadastro de `RESEND_WEBHOOK_SECRET` e `UNSUBSCRIBE_SECRET` no mesmo passo — esses dois vêm de você/do Resend, então abriria o formulário seguro.

## Detalhes técnicos

- `secrets--generate_secret` para o `CRON_SECRET`; as rotas já leem `process.env["CRON_SECRET"]` e comparam com o header `x-cron-secret`.
- `CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;`
- `cron.schedule` com `net.http_post` para a URL estável de produção, header `{"Content-Type":"application/json","x-cron-secret":"<valor>"}` e body `{}` (nenhuma das duas rotas lê o corpo). Isso vai por `supabase--insert`, não por migração, já que carrega segredo.
- Jobs: `run-scheduled-campaigns` (`*/5 * * * *`) e `purge-old-logs` (`0 3 * * *`).
- Verificação: `select * from cron.job_run_details order by start_time desc limit 10;`
- Nenhuma mudança de código de aplicação — as duas rotas já existem e estão prontas.
