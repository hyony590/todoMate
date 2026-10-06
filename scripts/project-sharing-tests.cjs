// In-memory PostgreSQL security integration checks. Never connects to Supabase.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
async function main() {
  const { PGlite } = require(process.argv[2] || '@electric-sql/pglite')
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const member = '00000000-0000-0000-0000-000000000002'
  const outsider = '00000000-0000-0000-0000-000000000003'
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    insert into auth.users values('${owner}','owner@example.test',now()),('${member}','member@example.test',now()),('${outsider}','outsider@example.test',now());`)
  const sql = name => fs.readFileSync(path.join(__dirname, '../supabase', name), 'utf8')
  await db.exec(sql('projects.sql'))
  await db.exec(sql('project-sharing.sql'))
  await db.exec(sql('project-sharing.sql')) // Repeat application must preserve data and policies.
  async function as(user) { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]) }
  async function rows(query, params = []) { return (await db.query(query, params)).rows }
  await as(owner)
  const group = (await rows('insert into public.project_groups(user_id,name) values($1,$2) returning id', [owner, 'Group']))[0].id
  const p1 = (await rows('insert into public.projects(user_id,group_id,name) values($1,$2,$3) returning id', [owner, group, 'Shared']))[0].id
  const p2 = (await rows('insert into public.projects(user_id,group_id,name) values($1,$2,$3) returning id', [owner, group, 'Sibling']))[0].id
  const entry = (await rows("insert into public.project_entries(user_id,project_id,kind,title) values($1,$2,'todo','Task') returning id", [owner, p1]))[0].id
  const invite = (await rows("select public.invite_haru_project('project',$1,'member@example.test','view') as value", [p1]))[0].value.id
  await as(member)
  assert.equal((await rows('select * from public.projects')).length, 0)
  assert.equal((await rows('select public.incoming_haru_project_invites() as value'))[0].value.length, 1)
  await db.exec('reset role')
  await rows('update auth.users set email_confirmed_at=null where id=$1', [member])
  await as(member)
  await assert.rejects(() => rows('select public.accept_haru_project_invite($1)', [invite]))
  await db.exec('reset role')
  await rows('update auth.users set email_confirmed_at=now() where id=$1', [member])
  await as(member)
  await rows('select public.accept_haru_project_invite($1)', [invite])
  assert.equal((await rows('select * from public.projects')).length, 1)
  assert.equal((await rows('select * from public.project_groups')).length, 1)
  assert.equal((await rows('select * from public.project_entries')).length, 1)
  assert.equal((await rows('update public.project_entries set completed=true where id=$1 returning id', [entry])).length, 0)
  await assert.rejects(() => rows("insert into public.project_entries(user_id,project_id,kind,title) values($1,$2,'todo','Forbidden')", [owner, p1]))
  await assert.rejects(() => rows("select public.invite_haru_project('project',$1,'outsider@example.test','edit')", [p1]))
  await as(outsider)
  await assert.rejects(() => rows('select public.accept_haru_project_invite($1)', [invite]))
  assert.equal((await rows('select * from public.projects')).length, 0)
  await as(owner)
  await rows("update public.project_shares set role='edit' where id=$1", [invite])
  await as(member)
  assert.equal((await rows('update public.project_entries set completed=true where id=$1 returning id', [entry])).length, 1)
  await rows("insert into public.project_entries(user_id,project_id,kind,title) values($1,$2,'memo','Editable')", [owner, p1])
  assert.equal((await rows('delete from public.projects where id=$1 returning id', [p1])).length, 0)
  await assert.rejects(() => rows('update public.projects set group_id=gen_random_uuid() where id=$1', [p1]))
  await assert.rejects(() => rows('update public.project_entries set user_id=$1 where id=$2', [member, entry]))
  await assert.rejects(() => rows('update public.project_shares set accepted_by=$1 where id=$2', [outsider, invite]))
  await as(owner)
  await rows('delete from public.project_shares where id=$1', [invite])
  await as(member)
  assert.equal((await rows('select * from public.projects')).length, 0)
  assert.equal((await rows('select * from public.project_entries')).length, 0)
  await as(owner)
  const groupInvite = (await rows("select public.invite_haru_project('group',$1,'member@example.test','edit') as value", [group]))[0].value.id
  await as(member)
  await rows('select public.accept_haru_project_invite($1)', [groupInvite])
  assert.equal((await rows('select * from public.projects')).length, 2)
  await rows('insert into public.projects(user_id,group_id,name) values($1,$2,$3)', [owner, group, 'New shared project'])
  assert.equal((await rows('select * from public.projects')).length, 3)
  assert.equal((await rows('select public.haru_project_access() as value'))[0].value.projects[p2], 'edit')
  await as(owner)
  await rows("update public.project_shares set role='view' where id=$1", [groupInvite])
  await as(member)
  assert.equal((await rows('update public.projects set name=$1 where id=$2 returning id', ['Denied', p2])).length, 0)
  await as(owner)
  const directInvite = (await rows("select public.invite_haru_project('project',$1,'member@example.test','edit') as value", [p1]))[0].value.id
  await as(member)
  await rows('select public.accept_haru_project_invite($1)', [directInvite])
  assert.equal((await rows('select public.haru_project_access() as value'))[0].value.projects[p1], 'edit')
  await as(owner)
  await rows('delete from public.project_shares where id=$1', [groupInvite])
  await as(member)
  assert.equal((await rows('select * from public.projects')).length, 1)
  assert.equal((await rows('select public.haru_project_access() as value'))[0].value.projects[p1], 'edit')
  await db.close()
  console.log('PASS: private invite acceptance; project-only/sibling isolation; view/edit restrictions; owner-only sharing/deletion; immutable scope; revocation; inherited group access; repeatable migration.')
}
main().catch(error => { console.error(error); process.exit(1) })
