// Isolated PostgreSQL checks; never connects to the user's database.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
async function main() {
  const { PGlite } = require(process.argv[2] || '@electric-sql/pglite')
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const other = '00000000-0000-0000-0000-000000000002'
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    insert into auth.users values('${owner}','owner@example.test',now()),('${other}','other@example.test',now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated,anon;
    create table public.habits(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), name text, weekdays integer[], created_at timestamptz default now());
    alter table public.habits enable row level security;
    create policy own_habits on public.habits for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
    grant select,insert,update,delete on public.habits to authenticated;`)
  const sql = name => fs.readFileSync(path.join(__dirname, '../supabase', name), 'utf8')
  await db.exec(sql('projects.sql'))
  await db.exec(sql('project-sharing.sql'))
  await db.exec(sql('habit-schedule-history.sql'))
  await db.exec(sql('item-colors.sql'))
  await db.exec(sql('item-colors.sql'))
  async function as(user) { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]) }
  async function rows(query, params = []) { return (await db.query(query, params)).rows }
  await as(owner)
  const habit = (await rows('insert into public.habits(user_id,name,weekdays) values($1,$2,$3) returning *', [owner,'Habit',[1,3,5]]))[0]
  const changed = (await rows("select public.update_haru_habit_with_color($1,'Habit',array[1,3,5],current_date,false,'#5276B8') as value", [habit.id]))[0].value
  assert.equal(changed.color, '#5276b8')
  const history = JSON.stringify(changed.schedule_history)
  const recolored = (await rows("select public.update_haru_habit_with_color($1,'Habit',array[1,3,5],current_date,false,'#8a63a8') as value", [habit.id]))[0].value
  assert.equal(JSON.stringify(recolored.schedule_history), history)
  await assert.rejects(() => rows("select public.update_haru_habit_with_color($1,'Do not save',array[1],current_date,false,'invalid')", [habit.id]))
  assert.equal((await rows('select name from public.habits where id=$1',[habit.id]))[0].name,'Habit')
  await assert.rejects(() => rows("select public.update_haru_habit_with_color($1,'Do not save',array[9],current_date,false,'#e06445')", [habit.id]))
  assert.equal((await rows('select color from public.habits where id=$1',[habit.id]))[0].color,'#8a63a8')
  const group = (await rows("insert into public.project_groups(user_id,name) values($1,'Group') returning id",[owner]))[0].id
  const project = (await rows("insert into public.projects(user_id,group_id,name,color) values($1,$2,'Project','#5276b8') returning id",[owner,group]))[0].id
  const invite = (await rows("select public.invite_haru_project('project',$1,'other@example.test','view') as value",[project]))[0].value.id
  await as(other)
  await rows('select public.accept_haru_project_invite($1)',[invite])
  assert.equal((await rows("update public.projects set color='#8a63a8' where id=$1 returning id",[project])).length,0)
  await assert.rejects(() => rows("select public.update_haru_habit_with_color($1,'Forbidden',array[1],current_date,false,'#555b63')",[habit.id]))
  await as(owner)
  await rows("update public.project_shares set role='edit' where id=$1",[invite])
  await as(other)
  assert.equal((await rows("update public.projects set color='#8a63a8' where id=$1 returning color",[project]))[0].color,'#8a63a8')
  await assert.rejects(() => rows("update public.projects set color='bad' where id=$1",[project]))
  await db.close()
  console.log('PASS: additive/repeatable color SQL; atomic habit updates and preserved history; invalid values rejected; owner/view/editor RLS respected.')
}
main().catch(error => { console.error(error); process.exit(1) })
