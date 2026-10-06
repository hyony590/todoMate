-- New project workspace only; existing task/habit data is preserved.
begin;
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
commit;
