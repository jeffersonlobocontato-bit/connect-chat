alter table public.journalists
  add column opt_in_whatsapp boolean not null default true,
  add column opt_in_email boolean not null default true,
  add column bounced_at timestamptz,
  add column bounce_reason text;

update public.journalists set opt_in_whatsapp = opt_in, opt_in_email = opt_in;

comment on column public.journalists.opt_in is
  'Legado — substituído por opt_in_whatsapp/opt_in_email.';

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  dispatch_log_id uuid references public.dispatch_logs (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert on public.email_events to authenticated;
grant all on public.email_events to service_role;
alter table public.email_events enable row level security;
create policy "admin le email_events" on public.email_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index idx_email_events_dispatch_log on public.email_events (dispatch_log_id);