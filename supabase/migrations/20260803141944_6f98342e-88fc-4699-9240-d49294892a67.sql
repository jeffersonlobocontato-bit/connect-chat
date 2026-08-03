UPDATE public.journalists AS j
SET email = s.email,
    opt_in_email = true,
    opt_in_email_at = COALESCE(j.opt_in_email_at, now()),
    opt_in_email_source = COALESCE(j.opt_in_email_source, 'Mailing de imprensa')
FROM public.email_import_staging s
WHERE j.phone = s.phone AND j.email IS NULL;

UPDATE public.journalists
SET opt_in_whatsapp = true,
    opt_in_whatsapp_at = COALESCE(opt_in_whatsapp_at, now()),
    opt_in_whatsapp_source = COALESCE(opt_in_whatsapp_source, 'Mailing de imprensa')
WHERE audience = 'press' AND opt_in_whatsapp IS DISTINCT FROM true;

UPDATE public.journalists SET tags = array_append(COALESCE(tags, '{}'), t.label)
FROM (VALUES
  ('41','DDD 41 - Curitiba e RMC'),
  ('42','DDD 42 - Campos Gerais e Centro-Sul'),
  ('43','DDD 43 - Norte'),
  ('44','DDD 44 - Noroeste'),
  ('45','DDD 45 - Oeste'),
  ('46','DDD 46 - Sudoeste')
) AS t(ddd, label)
WHERE audience = 'press'
  AND substring(phone from 3 for 2) = t.ddd
  AND NOT (t.label = ANY(COALESCE(tags, '{}')));

UPDATE public.journalists SET tags = array_append(COALESCE(tags, '{}'), 'Outros - fora do Parana')
WHERE audience = 'press'
  AND substring(phone from 3 for 2) NOT IN ('41','42','43','44','45','46')
  AND NOT ('Outros - fora do Parana' = ANY(COALESCE(tags, '{}')));

INSERT INTO public.segments (name, description, audience, rules)
SELECT s.name, s.description, 'press',
       jsonb_build_array(jsonb_build_object('field','tags','op','in','value', jsonb_build_array(s.tag)))
FROM (VALUES
  ('Imprensa - DDD 41 (Curitiba e RMC)','Jornalistas com telefone de DDD 41','DDD 41 - Curitiba e RMC'),
  ('Imprensa - DDD 42 (Campos Gerais e Centro-Sul)','Jornalistas com telefone de DDD 42','DDD 42 - Campos Gerais e Centro-Sul'),
  ('Imprensa - DDD 43 (Norte)','Jornalistas com telefone de DDD 43','DDD 43 - Norte'),
  ('Imprensa - DDD 44 (Noroeste)','Jornalistas com telefone de DDD 44','DDD 44 - Noroeste'),
  ('Imprensa - DDD 45 (Oeste)','Jornalistas com telefone de DDD 45','DDD 45 - Oeste'),
  ('Imprensa - DDD 46 (Sudoeste)','Jornalistas com telefone de DDD 46','DDD 46 - Sudoeste'),
  ('Imprensa - Outros (fora do Parana)','Jornalistas com DDD fora do Parana','Outros - fora do Parana')
) AS s(name, description, tag)
WHERE NOT EXISTS (SELECT 1 FROM public.segments x WHERE x.name = s.name);

DROP TABLE public.email_import_staging;