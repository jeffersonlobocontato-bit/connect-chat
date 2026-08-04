create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

do $$
declare r record; q text; w text; stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where (coalesce(qual,'') like '%has_role%' or coalesce(with_check,'') like '%has_role%')
  loop
    q := replace(coalesce(r.qual,''), 'has_role(', 'private.has_role(');
    w := replace(coalesce(r.with_check,''), 'has_role(', 'private.has_role(');
    q := replace(q, 'private.private.has_role(', 'private.has_role(');
    w := replace(w, 'private.private.has_role(', 'private.has_role(');
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then stmt := stmt || format(' using (%s)', q); end if;
    if r.with_check is not null then stmt := stmt || format(' with check (%s)', w); end if;
    execute stmt;
  end loop;
end $$;

drop function if exists public.has_role(uuid, public.app_role);