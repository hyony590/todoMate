-- Supabase SQL Editor에서 한 번 실행하세요. 기존 테이블이 있으면 먼저 구조를 확인하세요.
begin;
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  title text not null check (char_length(title) between 1 and 80),
  date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories(id, user_id) on delete restrict
);
create index tasks_user_date_idx on public.tasks(user_id,date);
create index categories_user_idx on public.categories(user_id);
alter table public.tasks enable row level security;
alter table public.categories enable row level security;
revoke all on public.tasks, public.categories from anon;
grant select, insert, update, delete on public.tasks, public.categories to authenticated;
create policy own_tasks on public.tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_categories on public.categories for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.seed_haru_categories() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.categories(user_id,name,color) values
    (new.id,'나를 돌보기','#3d8b67'), (new.id,'집중할 일','#e06445'), (new.id,'생활','#555b63');
  return new;
end;
$$;
revoke all on function public.seed_haru_categories() from public, anon, authenticated;
create trigger on_haru_user_created after insert on auth.users for each row execute function public.seed_haru_categories();
-- 이미 만든 계정에도 기본 카테고리를 생성합니다.
insert into public.categories(user_id,name,color)
select u.id, v.name, v.color from auth.users u cross join (values
  ('나를 돌보기','#3d8b67'),('집중할 일','#e06445'),('생활','#555b63')
) as v(name,color) where not exists (select 1 from public.categories c where c.user_id = u.id);

create function public.reset_haru_data() returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.tasks where user_id = auth.uid();
  delete from public.categories where user_id = auth.uid();
  insert into public.categories(user_id,name,color) values
    (auth.uid(),'나를 돌보기','#3d8b67'), (auth.uid(),'집중할 일','#e06445'), (auth.uid(),'생활','#555b63');
end;
$$;
revoke all on function public.reset_haru_data() from public, anon;
grant execute on function public.reset_haru_data() to authenticated;
commit;
