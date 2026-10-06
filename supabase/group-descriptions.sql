-- Optional group descriptions. Preserves existing data and sharing/RLS policies.
begin;
alter table public.project_groups
  add column if not exists description text not null default '';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.project_groups'::regclass and conname = 'project_groups_description_length') then
    alter table public.project_groups add constraint project_groups_description_length
      check (char_length(description) <= 1000);
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
