-- Preserve existing habits/completions. Run once in the Supabase SQL editor.
begin;
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
commit;
