-- Run after projects.sql and habit-schedule-history.sql (sharing SQL may be applied).
-- Additive migration: preserves all entries, schedules, completions, and RLS policies.
begin;
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
