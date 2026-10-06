-- Release: habit history, project workspace/sharing, and colors.
-- Existing rows are preserved. All migrations commit together.
begin;
-- Preserve existing habits/completions. Run once in the Supabase SQL editor.

alter table public.habits add column if not exists schedule_history jsonb not null default '[]'::jsonb;
alter table public.habits add column if not exists exclude_holidays boolean not null default false;
drop function if exists public.update_haru_habit(uuid,text,integer[],date);

create or replace function public.update_haru_habit(
  habit_id_to_update uuid, new_name text, new_weekdays integer[], effective_on date, new_exclude_holidays boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  existing public.habits%rowtype;
  updated public.habits%rowtype;
  history jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if effective_on is null or effective_on < (current_timestamp at time zone 'UTC')::date - 1
     or effective_on > (current_timestamp at time zone 'UTC')::date + 1 then
    raise exception 'Changes must take effect today';
  end if;
  if new_name is null or char_length(btrim(new_name)) not between 1 and 80
     or new_weekdays is null or cardinality(new_weekdays) not between 1 and 7
     or not (new_weekdays <@ array[0,1,2,3,4,5,6])
     or array_position(new_weekdays, null) is not null then
    raise exception 'Invalid habit name or weekdays';
  end if;
  select * into existing from public.habits
    where id = habit_id_to_update and user_id = auth.uid() for update;
  if not found then raise exception 'Habit not found'; end if;
  history := existing.schedule_history;
  if history = '[]'::jsonb then
    history := jsonb_build_array(jsonb_build_object('effectiveOn',
      to_char(existing.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD'), 'weekdays', existing.weekdays, 'excludeHolidays', existing.exclude_holidays));
  end if;
  if existing.weekdays is distinct from new_weekdays or existing.exclude_holidays is distinct from new_exclude_holidays then
    if exists (select 1 from jsonb_array_elements(history) entry where (entry->>'effectiveOn')::date > effective_on) then
      raise exception 'A newer schedule exists. Refresh and retry';
    end if;
    select coalesce(jsonb_agg(entry order by entry->>'effectiveOn'), '[]'::jsonb) into history
      from jsonb_array_elements(history) entry where (entry->>'effectiveOn')::date < effective_on;
    history := history || jsonb_build_array(jsonb_build_object('effectiveOn', to_char(effective_on, 'YYYY-MM-DD'), 'weekdays', new_weekdays, 'excludeHolidays', new_exclude_holidays));
  end if;
  update public.habits set name = btrim(new_name), weekdays = new_weekdays, schedule_history = history, exclude_holidays = new_exclude_holidays
    where id = habit_id_to_update and user_id = auth.uid() returning * into updated;
  return to_jsonb(updated);
end;
$$;
revoke all on function public.update_haru_habit(uuid,text,integer[],date,boolean) from public,anon;
grant execute on function public.update_haru_habit(uuid,text,integer[],date,boolean) to authenticated;
notify pgrst, 'reload schema';


-- New project workspace only; existing task/habit data is preserved.

create table if not exists public.project_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(), unique(id,user_id),
  foreign key(group_id,user_id) references public.project_groups(id,user_id) on delete cascade
);
create table if not exists public.project_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  kind text not null check (kind in ('todo','schedule','memo')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  content text not null default '' check (char_length(content) <= 10000),
  date date, end_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(project_id,user_id) references public.projects(id,user_id) on delete cascade,
  check (kind <> 'schedule' or date is not null),
  check (end_date is null or (date is not null and end_date >= date)),
  check (kind <> 'memo' or (date is null and end_date is null)),
  check (kind = 'schedule' or end_date is null),
  check (kind = 'todo' or not completed)
);
create index if not exists project_groups_user_idx on public.project_groups(user_id);
create index if not exists projects_group_user_idx on public.projects(group_id,user_id);
create index if not exists project_entries_project_user_idx on public.project_entries(project_id,user_id);
alter table public.project_groups enable row level security;
alter table public.projects enable row level security;
alter table public.project_entries enable row level security;
revoke all on public.project_groups,public.projects,public.project_entries from anon;
grant select,insert,update,delete on public.project_groups,public.projects,public.project_entries to authenticated;
drop policy if exists own_project_groups on public.project_groups;
create policy own_project_groups on public.project_groups for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_projects on public.projects;
create policy own_projects on public.projects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_project_entries on public.project_entries;
create policy own_project_entries on public.project_entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Keep the existing settings reset consistent with the new workspace.
create or replace function public.reset_haru_data() returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.project_groups where user_id = auth.uid();
  delete from public.habit_completions where user_id = auth.uid();
  delete from public.habits where user_id = auth.uid();
  delete from public.tasks where user_id = auth.uid();
  delete from public.categories where user_id = auth.uid();
  insert into public.categories(user_id,name,color) values
    (auth.uid(),'나를 돌보기','#3d8b67'),(auth.uid(),'집중할 일','#e06445'),(auth.uid(),'생활','#555b63');
end;
$$;
revoke all on function public.reset_haru_data() from public,anon;
grant execute on function public.reset_haru_data() to authenticated;
notify pgrst, 'reload schema';


-- Run AFTER projects.sql. Private, authenticated, owner-managed invitations.

create table if not exists public.project_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid, project_id uuid,
  invitee_email text not null check (invitee_email = lower(btrim(invitee_email)) and char_length(invitee_email) between 3 and 254),
  role text not null check (role in ('view','edit')),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz, created_at timestamptz not null default now(),
  check (num_nonnulls(group_id,project_id) = 1),
  foreign key(group_id,owner_id) references public.project_groups(id,user_id) on delete cascade,
  foreign key(project_id,owner_id) references public.projects(id,user_id) on delete cascade
);
create unique index if not exists project_share_group_email_idx on public.project_shares(group_id,invitee_email) where group_id is not null;
create unique index if not exists project_share_project_email_idx on public.project_shares(project_id,invitee_email) where project_id is not null;
create index if not exists project_share_member_idx on public.project_shares(accepted_by);
alter table public.project_shares enable row level security;
revoke all on public.project_shares from anon,authenticated;
grant select,delete on public.project_shares to authenticated;
grant update(role) on public.project_shares to authenticated;
drop policy if exists manage_own_shares on public.project_shares;
create policy manage_own_shares on public.project_shares for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function public.haru_can_project(target uuid, editing boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.projects p where p.id = target and (
    p.user_id = auth.uid() or exists(select 1 from public.project_shares s where s.accepted_by = auth.uid()
      and s.accepted_at is not null and (s.project_id = p.id or s.group_id = p.group_id)
      and (not editing or s.role = 'edit'))));
$$;
create or replace function public.haru_can_group(target uuid, editing boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.project_groups g where g.id = target and (
    g.user_id = auth.uid() or exists(select 1 from public.project_shares s where s.group_id = g.id
      and s.accepted_by = auth.uid() and s.accepted_at is not null and (not editing or s.role = 'edit'))
    or (not editing and exists(select 1 from public.projects p where p.group_id = g.id and public.haru_can_project(p.id,false)))));
$$;
revoke all on function public.haru_can_project(uuid,boolean),public.haru_can_group(uuid,boolean) from public,anon;
grant execute on function public.haru_can_project(uuid,boolean),public.haru_can_group(uuid,boolean) to authenticated;

drop policy if exists own_project_groups on public.project_groups;
drop policy if exists own_projects on public.projects;
drop policy if exists own_project_entries on public.project_entries;
drop policy if exists read_groups on public.project_groups;
drop policy if exists insert_groups on public.project_groups;
drop policy if exists edit_groups on public.project_groups;
drop policy if exists delete_groups on public.project_groups;
drop policy if exists read_projects on public.projects;
drop policy if exists insert_projects on public.projects;
drop policy if exists edit_projects on public.projects;
drop policy if exists delete_projects on public.projects;
drop policy if exists read_project_entries on public.project_entries;
drop policy if exists insert_project_entries on public.project_entries;
drop policy if exists edit_project_entries on public.project_entries;
drop policy if exists delete_project_entries on public.project_entries;
create policy read_groups on public.project_groups for select to authenticated using(user_id = (select auth.uid()) or public.haru_can_group(id,false));
create policy insert_groups on public.project_groups for insert to authenticated with check(user_id = (select auth.uid()));
create policy edit_groups on public.project_groups for update to authenticated using(public.haru_can_group(id,true)) with check(public.haru_can_group(id,true));
create policy delete_groups on public.project_groups for delete to authenticated using(user_id = (select auth.uid()));
create policy read_projects on public.projects for select to authenticated using(user_id = (select auth.uid()) or public.haru_can_project(id,false) or public.haru_can_group(group_id,true));
create policy insert_projects on public.projects for insert to authenticated with check(public.haru_can_group(group_id,true) and exists(select 1 from public.project_groups g where g.id = group_id and g.user_id = projects.user_id));
create policy edit_projects on public.projects for update to authenticated using(public.haru_can_project(id,true)) with check(public.haru_can_project(id,true));
create policy delete_projects on public.projects for delete to authenticated using(user_id = (select auth.uid()));
create policy read_project_entries on public.project_entries for select to authenticated using(public.haru_can_project(project_id,false));
create policy insert_project_entries on public.project_entries for insert to authenticated with check(public.haru_can_project(project_id,true) and exists(select 1 from public.projects p where p.id = project_id and p.user_id = project_entries.user_id));
create policy edit_project_entries on public.project_entries for update to authenticated using(public.haru_can_project(project_id,true)) with check(public.haru_can_project(project_id,true));
create policy delete_project_entries on public.project_entries for delete to authenticated using(public.haru_can_project(project_id,true));

-- Editors cannot move a row into another owner/scope to change its audience.
create or replace function public.guard_haru_project_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at then raise exception 'Identity fields are immutable'; end if;
  if tg_table_name = 'projects' then
    if new.group_id is distinct from old.group_id then raise exception 'Project group is immutable'; end if;
  elsif tg_table_name = 'project_entries' then
    if new.project_id is distinct from old.project_id then raise exception 'Entry project is immutable'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_project_group_identity on public.project_groups;
drop trigger if exists guard_project_identity on public.projects;
drop trigger if exists guard_project_entry_identity on public.project_entries;
create trigger guard_project_group_identity before update on public.project_groups for each row execute function public.guard_haru_project_identity();
create trigger guard_project_identity before update on public.projects for each row execute function public.guard_haru_project_identity();
create trigger guard_project_entry_identity before update on public.project_entries for each row execute function public.guard_haru_project_identity();

create or replace function public.invite_haru_project(target_kind text,target_id uuid,recipient_email text,access_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare share public.project_shares%rowtype; invitation_email text := lower(btrim(recipient_email));
begin
  if auth.uid() is null or access_role not in ('view','edit') or invitation_email is null or invitation_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(invitation_email) > 254 then raise exception 'Invalid invitation'; end if;
  if exists(select 1 from auth.users where id = auth.uid() and lower(auth.users.email) = invitation_email) then raise exception 'You already own this workspace'; end if;
  if target_kind = 'group' then
    perform 1 from public.project_groups where id = target_id and user_id = auth.uid() for update;
    if not found then raise exception 'Only the group owner can invite'; end if;
    insert into public.project_shares(owner_id,group_id,invitee_email,role) values(auth.uid(),target_id,invitation_email,access_role)
      on conflict(group_id,invitee_email) where group_id is not null do update set role = excluded.role returning * into share;
  elsif target_kind = 'project' then
    perform 1 from public.projects where id = target_id and user_id = auth.uid() for update;
    if not found then raise exception 'Only the project owner can invite'; end if;
    insert into public.project_shares(owner_id,project_id,invitee_email,role) values(auth.uid(),target_id,invitation_email,access_role)
      on conflict(project_id,invitee_email) where project_id is not null do update set role = excluded.role returning * into share;
  else raise exception 'Invalid target'; end if;
  return to_jsonb(share);
end;
$$;
create or replace function public.accept_haru_project_invite(invite_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare verified_email text;
begin
  select lower(u.email) into verified_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if verified_email is null then raise exception 'A verified email is required'; end if;
  update public.project_shares set accepted_by = auth.uid(), accepted_at = now()
    where id = invite_id and invitee_email = verified_email and (accepted_by is null or accepted_by = auth.uid());
  if not found then raise exception 'Invitation not found'; end if;
end;
$$;
create or replace function public.incoming_haru_project_invites() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('target_name',coalesce(g.name,p.name))), '[]'::jsonb)
    from public.project_shares s left join public.project_groups g on g.id = s.group_id left join public.projects p on p.id = s.project_id
    where s.accepted_by is null and s.invitee_email = (select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null);
$$;
create or replace function public.haru_project_access() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('groups',(select coalesce(jsonb_object_agg(id,case when public.haru_can_group(id,true) then 'edit' else 'view' end),'{}'::jsonb) from public.project_groups),
    'projects',(select coalesce(jsonb_object_agg(id,case when public.haru_can_project(id,true) then 'edit' else 'view' end),'{}'::jsonb) from public.projects));
$$;
revoke all on function public.invite_haru_project(text,uuid,text,text),public.accept_haru_project_invite(uuid),public.incoming_haru_project_invites(),public.haru_project_access() from public,anon;
grant execute on function public.invite_haru_project(text,uuid,text,text),public.accept_haru_project_invite(uuid),public.incoming_haru_project_invites(),public.haru_project_access() to authenticated;
notify pgrst, 'reload schema';


-- Run after projects.sql and habit-schedule-history.sql (sharing SQL may be applied).
-- Additive migration: preserves all entries, schedules, completions, and RLS policies.

alter table public.habits add column if not exists color text not null default '#3d8b67';
alter table public.projects add column if not exists color text;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.habits'::regclass and conname = 'habits_color_hex') then
    alter table public.habits add constraint habits_color_hex check (color ~* '^#[0-9a-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_color_hex') then
    alter table public.projects add constraint projects_color_hex check (color is null or color ~* '^#[0-9a-f]{6}$');
  end if;
end $$;

-- Schedule/name/color changes commit together; failure rolls back all changes.
-- Reuse the existing schedule-history function rather than bypassing its checks.
create or replace function public.update_haru_habit_with_color(
  habit_id_to_update uuid, new_name text, new_weekdays integer[], effective_on date,
  new_exclude_holidays boolean, new_color text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare updated public.habits%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if new_color is null or new_color !~* '^#[0-9a-f]{6}$' then raise exception 'Invalid color'; end if;
  perform public.update_haru_habit(habit_id_to_update, new_name, new_weekdays, effective_on, new_exclude_holidays);
  update public.habits set color = lower(new_color)
    where id = habit_id_to_update and user_id = auth.uid() returning * into updated;
  if not found then raise exception 'Habit not found'; end if;
  return to_jsonb(updated);
end;
$$;
revoke all on function public.update_haru_habit_with_color(uuid,text,integer[],date,boolean,text) from public,anon;
grant execute on function public.update_haru_habit_with_color(uuid,text,integer[],date,boolean,text) to authenticated;
notify pgrst, 'reload schema';


commit;

