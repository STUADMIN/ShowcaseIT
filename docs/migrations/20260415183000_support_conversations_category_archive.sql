-- Copy for Cursor workspace (showcaseit). Canonical copy: ForeverGiving-work/supabase/migrations/
-- Categories, archived status, org-member updates, and message lock when thread is not open.

alter table public.support_conversations
  add column if not exists category text,
  add column if not exists archived_at timestamptz;

alter table public.support_conversations
  drop constraint if exists support_conversations_status_check;

alter table public.support_conversations
  add constraint support_conversations_status_check
  check (status in ('open', 'closed', 'archived'));

alter table public.support_conversations
  drop constraint if exists support_conversations_category_check;

alter table public.support_conversations
  add constraint support_conversations_category_check
  check (
    category is null
    or category in ('general', 'billing', 'technical', 'collections', 'kyb', 'account', 'other')
  );

-- Only one open thread per organisation (unchanged semantics).
drop index if exists support_conversations_one_open_per_org_idx;
create unique index if not exists support_conversations_one_open_per_org_idx
  on public.support_conversations (org_id)
  where (status = 'open');

-- Block new messages unless the conversation is open.
create or replace function public.support_messages_require_open_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  select c.status into st from public.support_conversations c where c.id = new.conversation_id;
  if st is null then
    raise exception 'Conversation not found';
  end if;
  if st <> 'open' then
    raise exception 'This conversation is not open for new messages';
  end if;
  return new;
end;
$$;

drop trigger if exists support_messages_require_open_thread on public.support_messages;
create trigger support_messages_require_open_thread
before insert on public.support_messages
for each row execute function public.support_messages_require_open_thread();

-- Immutability + charity-side rules (FG admins bypass extra rules).
create or replace function public.support_conversations_row_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.org_id is distinct from old.org_id then
    raise exception 'Cannot change organisation on a support thread';
  end if;

  if exists (select 1 from public.fg_admins f where f.user_id = auth.uid()) then
    if new.status = 'archived' and new.archived_at is null then
      new.archived_at := now();
    end if;
    return new;
  end if;

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Cannot change immutable fields on a support thread';
  end if;

  if old.status = 'archived' then
    raise exception 'Archived threads cannot be edited';
  end if;

  if old.status is distinct from 'open' and new.status = 'open' then
    raise exception 'Cannot reopen a conversation from the app';
  end if;

  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists support_conversations_row_guard on public.support_conversations;
create trigger support_conversations_row_guard
before update on public.support_conversations
for each row execute function public.support_conversations_row_guard();

-- Organisation members may update their own threads (category / close / archive). FG admin policy already exists.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'support_conversations'
      and policyname = 'support_conversations_update_member'
  ) then
    create policy "support_conversations_update_member"
    on public.support_conversations
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.org_id = support_conversations.org_id
      )
      and not exists (select 1 from public.fg_admins f where f.user_id = auth.uid())
    )
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
