-- 1. Papel agente
create policy "agente le journalists" on public.journalists for select to authenticated
  using (public.has_role(auth.uid(), 'user'));
create policy "agente le conversation_messages" on public.conversation_messages for select to authenticated
  using (public.has_role(auth.uid(), 'user'));
create policy "agente marca conversation_messages como lida" on public.conversation_messages for update to authenticated
  using (public.has_role(auth.uid(), 'user'))
  with check (public.has_role(auth.uid(), 'user'));

-- 2. Canais sociais
alter table public.journalists alter column phone drop not null;
alter table public.journalists
  add column messenger_psid text unique,
  add column instagram_igsid text unique;
alter table public.conversation_messages drop constraint if exists conversation_messages_channel_check;
alter table public.conversation_messages
  add constraint conversation_messages_channel_check check (channel in ('whatsapp', 'messenger', 'instagram'));

-- 3. Automação
create table public.canned_responses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
grant select on public.canned_responses to authenticated;
grant all on public.canned_responses to service_role;
alter table public.canned_responses enable row level security;
create policy "admin gerencia canned_responses" on public.canned_responses for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "agente le canned_responses" on public.canned_responses for select to authenticated
  using (public.has_role(auth.uid(), 'user'));

create table public.auto_tag_rules (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  tag text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.auto_tag_rules to authenticated;
grant all on public.auto_tag_rules to service_role;
alter table public.auto_tag_rules enable row level security;
create policy "admin gerencia auto_tag_rules" on public.auto_tag_rules for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- 4. Releases por cliente
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "admin gerencia clients" on public.clients for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  slug text not null,
  summary text,
  body_html text not null,
  cover_media_id uuid references public.media_library (id),
  published boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (client_id, slug)
);
grant select, insert, update, delete on public.releases to authenticated;
grant all on public.releases to service_role;
alter table public.releases enable row level security;
create policy "admin gerencia releases" on public.releases for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.release_events (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  event_type text not null check (event_type in ('view', 'image_download')),
  created_at timestamptz not null default now()
);
grant select on public.release_events to authenticated;
grant all on public.release_events to service_role;
alter table public.release_events enable row level security;
create policy "admin le release_events" on public.release_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create index idx_release_events_release on public.release_events (release_id, event_type);