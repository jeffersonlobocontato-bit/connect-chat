# E-mails dos jornalistas + segmentos por DDD do Paraná

## O que eu verifiquei

- Sim: os 9 mailings originais **tinham coluna de e-mail** — 779 linhas com e-mail preenchido, 760 pares telefone→e-mail únicos.
- Na plataforma hoje: **1.037 contatos de imprensa, apenas 1 com e-mail**. O import anterior trouxe só telefone.
- Cruzando telefone (normalizado com DDI 55) com a base atual: **608 contatos recebem e-mail** agora. Os demais e-mails do CSV pertencem a linhas cujo telefone era inválido/duplicado e não entraram na base.
- Os DDDs presentes na base: 41 (154), 42 (160), 43 (220), 44 (227), 45 (147), 46 (97) e 22 contatos com DDD de fora do Paraná (47, 48, 49, 54, 21, 19, 53, 33, 67, 85, 14, 55, 65).

## Parte 1 — Popular os e-mails

- Preencher `email` nos 608 contatos que casarem por telefone. Nenhum telefone novo é criado, nenhum e-mail existente é sobrescrito.
- Se o mesmo e-mail aparecer em contatos diferentes (redação com e-mail único), mantém — a chave única continua sendo o telefone.
- **Opt-in de e-mail**: ligado para esses contatos, com data de consentimento e origem registrada como "Mailing de imprensa" (a prova de consentimento que já existe na tela de contatos). Se preferir deixar o opt-in desligado para revisar antes de disparar, é só dizer.

## Parte 2 — Segmentos por região de DDD

O motor de segmentos filtra por veículo, região, etiqueta, empresa, origem e estágio — não por telefone. Então a divisão por DDD vira **etiqueta**, que é o que o segmento lê.

Cada contato de imprensa ganha uma etiqueta de região (somada às que já tem):

| Etiqueta | DDD | Contatos |
|---|---|---|
| DDD 41 — Curitiba e RMC | 41 | 154 |
| DDD 42 — Campos Gerais e Centro-Sul | 42 | 160 |
| DDD 43 — Norte | 43 | 220 |
| DDD 44 — Noroeste | 44 | 227 |
| DDD 45 — Oeste | 45 | 147 |
| DDD 46 — Sudoeste | 46 | 97 |
| Outros — fora do Paraná | demais | 22 |

E crio **7 segmentos de público Imprensa**, um por etiqueta, prontos para uso em campanha de WhatsApp ou e-mail.

## Detalhes técnicos

- Script de leitura dos CSVs em `/tmp/user-uploads` (latin-1, separador `;`), extraindo e-mail e os campos TELEFONE/WHATSAPP; normalização igual à do import original.
- Migração única: `UPDATE public.journalists SET email = ... WHERE phone = ... AND email IS NULL`, mais `opt_in_email`, `opt_in_email_at`, `opt_in_email_source`.
- Etiquetas via `tags = array_append(tags, ...)` condicionado ao prefixo do telefone (`substring(phone from 3 for 2)`), com guarda para não duplicar a etiqueta.
- `INSERT INTO public.segments` com `audience = 'press'` e `rules = [{"field":"tags","op":"in","value":["<etiqueta>"]}]`, formato já usado por `matchesRules` em `src/lib/segments.ts`.
- Nenhuma mudança de schema e nenhuma alteração de código de aplicação — é migração de dados.
