create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid references public.journalists (id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  wa_message_id text,
  status text not null default 'received' check (
    status in ('received', 'sent', 'delivered', 'read', 'failed')
  ),
  read_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.conversation_messages to authenticated;
grant all on public.conversation_messages to service_role;
alter table public.conversation_messages enable row level security;
create policy "admin gerencia conversation_messages" on public.conversation_messages for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create index idx_conversation_messages_journalist on public.conversation_messages (journalist_id, created_at desc);
create index idx_conversation_messages_wa_message_id on public.conversation_messages (wa_message_id);
create index idx_conversation_messages_unread on public.conversation_messages (journalist_id)
  where direction = 'inbound' and read_by_admin = false;