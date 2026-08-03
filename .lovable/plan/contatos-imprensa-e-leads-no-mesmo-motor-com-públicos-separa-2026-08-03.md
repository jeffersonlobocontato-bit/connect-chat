# Contatos: imprensa e leads no mesmo motor, com públicos separados

## Recomendação

Manter **uma única base de contatos** com um campo de **tipo de público** (`imprensa` ou `lead`), e não uma tabela paralela de leads.

Por quê:
- O motor de disparo (WhatsApp, e-mail, opt-in por canal, links encurtados, agendamento, relatórios, conversas, supressão por bounce) já existe e é o mesmo para os dois. Duplicar a base significa duplicar tudo isso.
- O telefone é a chave única. Com duas tabelas, o mesmo número poderia entrar duas vezes e receber a mesma mensagem duas vezes.
- Você continua podendo tratar as ações como coisas diferentes — a separação acontece no nível de **público, etiqueta e template**, não no nível de banco.

O que muda na prática: o menu passa a ter **Jornalistas** e **Leads** como duas abas, cada uma mostrando só o seu público, com campos próprios. Por baixo é a mesma base, então segmentos e campanhas conseguem falar com um, com o outro, ou com os dois — mas nunca por acidente.

## Como a diferença entre assessoria e relacionamento aparece

| | Imprensa | Leads |
|---|---|---|
| Aba | Jornalistas | Leads |
| Campos próprios | veículo, cargo, editoria/região | empresa, origem, estágio, responsável |
| Segmentos | por veículo/região/etiqueta | por origem/estágio/etiqueta |
| Campanhas | comunicado, release, convite de pauta | relacionamento, novidade, convite |

Toda campanha passa a declarar o público-alvo (Imprensa, Leads ou Ambos). O seletor de segmento só mostra segmentos daquele público, e a prévia de destinatários nunca cruza os dois sem escolha explícita.

## Escopo

1. **Banco**: adicionar à base de contatos `audience` (`press` | `lead`, padrão `press` para os 1.036 já importados), `company`, `source`, `stage`, `owner_note`. Adicionar `audience` em segmentos e em campanhas.
2. **Aba Leads**: novo item de menu com lista, busca, cadastro/edição, opt-in por canal e etiquetas — mesma mecânica de Jornalistas, com os campos de lead.
3. **Aba Jornalistas**: passa a listar apenas contatos de imprensa (nada muda para você visualmente).
4. **Segmentação**: seletor de público no topo do segmento; as sugestões de veículo/região/origem/estágio se adaptam ao público escolhido.
5. **Campanhas**: seletor de público; segmentos filtrados por público; prévia de destinatários respeitando a escolha.
6. **Dashboard/Relatórios**: contagens separadas por público.
7. **Importação de leads por CSV**: fica de fora desta etapa; se precisar, faço em seguida.

## Detalhes técnicos

- Migração em `public.journalists` (a tabela permanece, só ganha o campo `audience` com índice); backfill `audience='press'` para todo o histórico. Índice em `(audience, active)`.
- `segments.audience` e `campaigns.audience` com default `press`; backfill igual.
- `src/lib/segments.ts`: rules ganham os campos `source` e `stage`; `matchesRules` segue igual, só amplia o union de `field`.
- `src/lib/campaigns.functions.ts`: a paginação da base passa a filtrar por `audience` da campanha (`ambos` = sem filtro).
- Nova view `src/components/mensageria/views/LeadsView.tsx`, reaproveitando o padrão de `JornalistasView.tsx`; `PainelMensageria.tsx` ganha o item de menu.
- `JornalistasView` e `LeadsView` compartilham um componente de tabela/formulário parametrizado por público, para não duplicar CRUD.
