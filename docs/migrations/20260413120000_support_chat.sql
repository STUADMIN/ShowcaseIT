  -- Copy for Cursor workspace (showcaseit). Canonical copy: ForeverGiving-work/supabase/migrations/
  -- Real-time support chat between charity portal users and FG admins.
  -- Messages are persisted; clients subscribe via Supabase Realtime (postgres_changes).

  create table if not exists public.support_conversations (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organisations(id) on delete cascade,
    status text not null default 'open' check (status in ('open', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create unique index if not exists support_conversations_one_open_per_org_idx
    on public.support_conversations (org_id)
    where (status = 'open');

  create index if not exists support_conversations_org_id_idx on public.support_conversations (org_id);
  create index if not exists support_conversations_updated_at_idx on public.support_conversations (updated_at desc);

  create table if not exists public.support_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.support_conversations(id) on delete cascade,
    author_user_id uuid not null,
    author_kind text not null check (author_kind in ('charity', 'fg_admin')),
    body text not null,
    created_at timestamptz not null default now(),
    constraint support_messages_body_nonempty check (length(trim(body)) > 0)
  );

  create index if not exists support_messages_conversation_created_idx
    on public.support_messages (conversation_id, created_at asc);

  -- Realtime UPDATE payloads (e.g. status) include row keys reliably for filtered subscriptions.
  alter table public.support_conversations replica identity full;

  -- Keep conversation.updated_at in sync when new messages arrive.
  create or replace function public.support_messages_touch_conversation()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    update public.support_conversations
    set updated_at = now()
    where id = new.conversation_id;
    return new;
  end;
  $$;

  drop trigger if exists support_messages_touch_conversation on public.support_messages;
  create trigger support_messages_touch_conversation
  after insert on public.support_messages
  for each row execute function public.support_messages_touch_conversation();

  -- Stamp author from session (do not trust client-supplied author fields).
  create or replace function public.support_messages_set_author()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    new.author_user_id := auth.uid();
    if exists (select 1 from public.fg_admins f where f.user_id = auth.uid()) then
      new.author_kind := 'fg_admin';
    else
      new.author_kind := 'charity';
    end if;
    return new;
  end;
  $$;

  drop trigger if exists support_messages_set_author on public.support_messages;
  create trigger support_messages_set_author
  before insert on public.support_messages
  for each row execute function public.support_messages_set_author();

  do $$
  begin
    if not exists (
      select 1 from pg_trigger where tgname = 'support_conversations_set_updated_at'
    ) then
      create trigger support_conversations_set_updated_at
      before update on public.support_conversations
      for each row execute function public.set_updated_at();
    end if;
  end $$;

  alter table public.support_conversations enable row level security;
  alter table public.support_messages enable row level security;

  revoke all on table public.support_conversations from anon;
  revoke all on table public.support_messages from anon;
  grant select, insert on table public.support_conversations to authenticated;
  grant select, insert on table public.support_messages to authenticated;
  grant update on table public.support_conversations to authenticated;

  do $$
  begin
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'support_conversations' and policyname = 'support_conversations_select'
    ) then
      create policy "support_conversations_select"
      on public.support_conversations
      for select
      to authenticated
      using (
        exists (select 1 from public.fg_admins f where f.user_id = auth.uid())
        or exists (
          select 1
          from public.memberships m
          where m.user_id = auth.uid()
            and m.org_id = support_conversations.org_id
        )
      );
    end if;
  end $$;

  do $$
  begin
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'support_conversations' and policyname = 'support_conversations_insert_member'
    ) then
      create policy "support_conversations_insert_member"
      on public.support_conversations
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.memberships m
          where m.user_id = auth.uid()
            and m.org_id = support_conversations.org_id
        )
      );
    end if;
  end $$;

  do $$
  begin
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'support_conversations' and policyname = 'support_conversations_update_fg_admin'
    ) then
      create policy "support_conversations_update_fg_admin"
      on public.support_conversations
      for update
      to authenticated
      using (exists (select 1 from public.fg_admins f where f.user_id = auth.uid()))
      with check (exists (select 1 from public.fg_admins f where f.user_id = auth.uid()));
    end if;
  end $$;

  do $$
  begin
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'support_messages' and policyname = 'support_messages_select'
    ) then
      create policy "support_messages_select"
      on public.support_messages
      for select
      to authenticated
      using (
        exists (select 1 from public.fg_admins f where f.user_id = auth.uid())
        or exists (
          select 1
          from public.support_conversations c
          join public.memberships m
            on m.org_id = c.org_id and m.user_id = auth.uid()
          where c.id = support_messages.conversation_id
        )
      );
    end if;
  end $$;

  do $$
  begin
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'support_messages' and policyname = 'support_messages_insert'
    ) then
      create policy "support_messages_insert"
      on public.support_messages
      for insert
      to authenticated
      with check (
        exists (select 1 from public.fg_admins f where f.user_id = auth.uid())
        or exists (
          select 1
          from public.support_conversations c
          join public.memberships m
            on m.org_id = c.org_id and m.user_id = auth.uid()
          where c.id = support_messages.conversation_id
        )
      );
    end if;
  end $$;

  -- Broadcast inserts/updates to Realtime subscribers (RLS still applies per role).
  do $$
  begin
    begin
      alter publication supabase_realtime add table public.support_messages;
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.support_conversations;
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end $$;
