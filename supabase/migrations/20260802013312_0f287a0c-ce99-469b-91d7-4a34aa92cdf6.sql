-- ============ Papéis ============
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "usuarios veem os proprios papeis" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ============ Perfis ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "ver proprio perfil" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "editar proprio perfil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "criar proprio perfil" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- primeiro usuario vira admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    case when (select count(*) from public.user_roles where role = 'admin') = 0
      then 'admin'::public.app_role else 'user'::public.app_role end
  )
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Jornalistas ============
create table public.journalists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  outlet text,
  role_title text,
  region text,
  tags text[] not null default '{}',
  opt_in boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.journalists to authenticated;
grant all on public.journalists to service_role;
alter table public.journalists enable row level security;
create policy "admin gerencia jornalistas" on public.journalists for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ Listas ============
create table public.contact_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contact_lists to authenticated;
grant all on public.contact_lists to service_role;
alter table public.contact_lists enable row level security;
create policy "admin gerencia listas" on public.contact_lists for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.contact_list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.contact_lists(id) on delete cascade,
  journalist_id uuid not null references public.journalists(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (list_id, journalist_id)
);
grant select, insert, update, delete on public.contact_list_members to authenticated;
grant all on public.contact_list_members to service_role;
alter table public.contact_list_members enable row level security;
create policy "admin gerencia membros" on public.contact_list_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ Segmentos ============
create table public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.segments to authenticated;
grant all on public.segments to service_role;
alter table public.segments enable row level security;
create policy "admin gerencia segmentos" on public.segments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ Templates ============
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  meta_template_name text not null,
  language text not null default 'pt_BR',
  category text not null default 'UTILITY',
  status text not null default 'PENDING',
  body_text text not null,
  tags text[] not null default '{}',
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.message_templates to authenticated;
grant all on public.message_templates to service_role;
alter table public.message_templates enable row level security;
create policy "admin gerencia templates" on public.message_templates for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ Campanhas ============
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references public.message_templates(id),
  list_id uuid references public.contact_lists(id),
  segment_id uuid references public.segments(id),
  status text not null default 'DRAFT',
  link_url text,
  media_url text,
  media_type text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  reengagement_of uuid references public.campaigns(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint campaigns_target_check check (list_id is not null or segment_id is not null)
);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "admin gerencia campanhas" on public.campaigns for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ Disparos ============
create table public.dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  journalist_id uuid references public.journalists(id) on delete set null,
  phone text not null,
  status text not null default 'QUEUED',
  wa_message_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index dispatch_logs_campaign_idx on public.dispatch_logs (campaign_id);
grant select, insert, update, delete on public.dispatch_logs to authenticated;
grant all on public.dispatch_logs to service_role;
alter table public.dispatch_logs enable row level security;
create policy "admin gerencia disparos" on public.dispatch_logs for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ Links curtos ============
create table public.short_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  original_url text not null,
  short_code text not null unique,
  click_count integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.short_links to authenticated;
grant all on public.short_links to service_role;
alter table public.short_links enable row level security;
create policy "admin gerencia links" on public.short_links for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.short_link_clicks (
  id uuid primary key default gen_random_uuid(),
  short_link_id uuid not null references public.short_links(id) on delete cascade,
  journalist_id uuid references public.journalists(id) on delete set null,
  clicked_at timestamptz not null default now()
);
grant select, insert on public.short_link_clicks to authenticated;
grant all on public.short_link_clicks to service_role;
alter table public.short_link_clicks enable row level security;
create policy "admin ve cliques" on public.short_link_clicks for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ============ Configuração WABA ============
create table public.waba_config (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default 'Número não configurado',
  phone_number_id text,
  waba_id text,
  quality_rating text not null default 'UNKNOWN' check (quality_rating in ('GREEN','YELLOW','RED','UNKNOWN')),
  messaging_limit_tier text,
  quality_checked_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.waba_config to authenticated;
grant all on public.waba_config to service_role;
alter table public.waba_config enable row level security;
create policy "admin gerencia waba" on public.waba_config for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.waba_config (display_name, quality_rating, messaging_limit_tier)
values ('AIV Imprensa (modo de teste)', 'UNKNOWN', 'TIER_1K');