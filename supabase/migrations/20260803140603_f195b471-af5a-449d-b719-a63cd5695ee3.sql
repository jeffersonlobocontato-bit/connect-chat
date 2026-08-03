alter table public.journalists
  add column if not exists opt_in_whatsapp_at timestamptz,
  add column if not exists opt_in_whatsapp_source text,
  add column if not exists opt_in_email_at timestamptz,
  add column if not exists opt_in_email_source text;

update public.journalists
set
  opt_in_whatsapp_at = case when opt_in_whatsapp then created_at else null end,
  opt_in_whatsapp_source = case when opt_in_whatsapp then 'Migração inicial — origem e data exata do consentimento anteriores a esta migração não registradas' else null end,
  opt_in_email_at = case when opt_in_email then created_at else null end,
  opt_in_email_source = case when opt_in_email then 'Migração inicial — origem e data exata do consentimento anteriores a esta migração não registradas' else null end
where opt_in_whatsapp_at is null and opt_in_email_at is null;