-- Update #2: 기존 테이블과 데이터는 유지합니다.
begin;
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  weekdays integer[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]),
  created_at timestamptz not null default now(),
  unique(id, user_id)
);
create table if not exists public.habit_completions (
  habit_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  primary key(habit_id, date),
  foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade
);
create index if not exists habits_user_idx on public.habits(user_id);
create index if not exists habit_completions_user_date_idx on public.habit_completions(user_id,date);
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
revoke all on public.habits,public.habit_completions from anon;
grant select,insert,update,delete on public.habits,public.habit_completions to authenticated;
drop policy if exists own_habits on public.habits;
create policy own_habits on public.habits for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_habit_completions on public.habit_completions;
create policy own_habit_completions on public.habit_completions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.delete_haru_category(category_id_to_delete uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  -- 삭제 도중 다른 기기에서 이 카테고리에 할 일을 추가하지 못하도록 잠급니다.
  perform 1 from public.categories where id = category_id_to_delete and user_id = auth.uid() for update;
  if not found then raise exception 'Category not found'; end if;
  delete from public.tasks where category_id = category_id_to_delete and user_id = auth.uid();
  delete from public.categories where id = category_id_to_delete and user_id = auth.uid();
end;
$$;
revoke all on function public.delete_haru_category(uuid) from public,anon;
grant execute on function public.delete_haru_category(uuid) to authenticated;

create or replace function public.reset_haru_data() returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
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
