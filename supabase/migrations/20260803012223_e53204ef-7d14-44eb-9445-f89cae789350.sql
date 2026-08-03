create policy "admin le campaign-media"
on storage.objects for select to authenticated
using (bucket_id = 'campaign-media' and public.has_role(auth.uid(), 'admin'));

create policy "admin envia campaign-media"
on storage.objects for insert to authenticated
with check (bucket_id = 'campaign-media' and public.has_role(auth.uid(), 'admin'));

create policy "admin remove campaign-media"
on storage.objects for delete to authenticated
using (bucket_id = 'campaign-media' and public.has_role(auth.uid(), 'admin'));

create table public.media_library (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text not null,
  media_type text not null check (media_type in ('IMAGE', 'VIDEO', 'DOCUMENT')),
  file_size_bytes bigint,
  meta_media_id text,
  meta_media_uploaded_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.media_library to authenticated;
grant all on public.media_library to service_role;
alter table public.media_library enable row level security;
create policy "admin gerencia media_library" on public.media_library for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

alter table public.campaigns add column if not exists media_id uuid references public.media_library (id);

alter table public.journalists add column email text;

alter table public.message_templates alter column meta_template_name drop not null;
alter table public.message_templates
  add column channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email')),
  add column name text,
  add column subject text,
  add column html_body text;

update public.message_templates set name = meta_template_name where name is null;

alter table public.message_templates
  add constraint message_templates_whatsapp_fields_check check (
    channel <> 'whatsapp' or meta_template_name is not null
  ),
  add constraint message_templates_email_fields_check check (
    channel <> 'email' or (subject is not null and html_body is not null)
  );

alter table public.campaigns
  add column channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email'));

alter table public.dispatch_logs alter column phone drop not null;
alter table public.dispatch_logs
  add column email text,
  add column resend_message_id text,
  add constraint dispatch_logs_target_check check (phone is not null or email is not null);