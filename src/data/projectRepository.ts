import { supabase } from './supabase'
import { checkedColor } from './itemColors'

export type ProjectGroup = { id: string; name: string; description?: string; createdAt: string; ownerId?: string; accessRole?: 'owner' | 'edit' | 'view' }
export type Project = { id: string; groupId: string; name: string; createdAt: string; ownerId?: string; accessRole?: 'owner' | 'edit' | 'view'; color?: string }
export type ProjectEntry = { id: string; projectId: string; kind: 'todo' | 'schedule' | 'memo'; title: string; content: string; date: string | null; endDate: string | null; completed: boolean; createdAt: string }
export type EntryDraft = Pick<ProjectEntry, 'kind' | 'title' | 'content' | 'date' | 'endDate'>
export type ProjectData = { groups: ProjectGroup[]; projects: Project[]; entries: ProjectEntry[] }
const storageKey = 'haru.projects.v1'
const groupFromRow = (row: any): ProjectGroup => ({ id: row.id, name: row.name, description: row.description ?? '', createdAt: row.created_at, ownerId: row.user_id })
const projectFromRow = (row: any): Project => ({ ...groupFromRow(row), groupId: row.group_id, color: row.color ?? undefined })
const entryFromRow = (row: any): ProjectEntry => ({ id: row.id, projectId: row.project_id, kind: row.kind, title: row.title, content: row.content, date: row.date, endDate: row.end_date, completed: row.completed, createdAt: row.created_at })
function read(): ProjectData { return JSON.parse(localStorage.getItem(storageKey) ?? '{"groups":[],"projects":[],"entries":[]}') }
function write(data: ProjectData) { localStorage.setItem(storageKey, JSON.stringify(data)) }
function nameValue(name: string) { const value = name.trim(); if (!value || value.length > 80) throw new Error('이름은 1~80자로 입력해주세요.'); return value }
function descriptionValue(description: string) { const value = description.trim(); if ([...value].length > 1000) throw new Error('그룹 설명은 1,000자 이내로 입력해주세요.'); return value }
function validDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(value + 'T00:00:00Z'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value }
function entryValue(draft: EntryDraft): EntryDraft {
  const title = nameValue(draft.title)
  if (!['todo', 'schedule', 'memo'].includes(draft.kind) || draft.content.length > 10000) throw new Error('항목 내용을 확인해주세요.')
  const date = draft.kind === 'memo' ? null : draft.date
  const endDate = draft.kind === 'schedule' ? draft.endDate : null
  if (draft.kind === 'schedule' && !date) throw new Error('일정의 시작 날짜를 선택해주세요.')
  if ((date && !validDate(date)) || (endDate && (!validDate(endDate) || !date || endDate < date))) throw new Error('날짜 범위를 확인해주세요.')
  return { kind: draft.kind, title, content: draft.content.trim(), date, endDate }
}
async function userId() { const { data, error } = await supabase!.auth.getUser(); if (error) throw error; if (!data.user) throw new Error('로그인이 필요합니다.'); return data.user.id }
function expect<T>(result: { data: T; error: any }): NonNullable<T> { if (result.error) throw result.error; if (result.data == null) throw new Error('저장 결과를 확인하지 못했습니다.'); return result.data }

export const projectRepository = {
  async list(): Promise<ProjectData> {
    if (!supabase) return read()
    const [groups, projects, entries] = await Promise.all(['project_groups', 'projects', 'project_entries'].map(table => supabase!.from(table).select('*').order('created_at')))
    const actor = await userId()
    const { data: access, error: accessError } = await supabase.rpc('haru_project_access')
    if (accessError && accessError.code !== 'PGRST202') throw accessError
    return { groups: expect(groups).map(row => ({ ...groupFromRow(row), accessRole: row.user_id === actor ? 'owner' : access?.groups?.[row.id] ?? 'view' })), projects: expect(projects).map(row => ({ ...projectFromRow(row), accessRole: row.user_id === actor ? 'owner' : access?.projects?.[row.id] ?? 'view' })), entries: expect(entries).map(entryFromRow) }
  },
  async createGroup(name: string, description = ''): Promise<ProjectGroup> {
    name = nameValue(name)
    description = descriptionValue(description)
    if (supabase) return groupFromRow(expect(await supabase.from('project_groups').insert({ name, description, user_id: await userId() }).select().single()))
    const data = read(), group = { id: crypto.randomUUID(), name, description, createdAt: new Date().toISOString() }
    write({ ...data, groups: [...data.groups, group] }); return group
  },
  async updateGroup(id: string, name: string, description?: string): Promise<ProjectGroup> {
    name = nameValue(name)
    const values = { name, ...(description !== undefined ? { description: descriptionValue(description) } : {}) }
    if (supabase) return groupFromRow(expect(await supabase.from('project_groups').update(values).eq('id', id).select().single()))
    const data = read(), group = data.groups.find(item => item.id === id)
    if (!group) throw new Error('그룹을 찾을 수 없습니다.')
    const changed = { ...group, ...values }; write({ ...data, groups: data.groups.map(item => item.id === id ? changed : item) }); return changed
  },
  async removeGroup(id: string): Promise<void> {
    if (supabase) { expect(await supabase.from('project_groups').delete().eq('id', id).select('id').single()); return }
    const data = read(); if (!data.groups.some(item => item.id === id)) throw new Error('그룹을 찾을 수 없습니다.')
    const ids = new Set(data.projects.filter(item => item.groupId === id).map(item => item.id))
    write({ groups: data.groups.filter(item => item.id !== id), projects: data.projects.filter(item => !ids.has(item.id)), entries: data.entries.filter(item => !ids.has(item.projectId)) })
  },
  async createProject(groupId: string, name: string, color?: string): Promise<Project> {
    if (color !== undefined) color = checkedColor(color)
    name = nameValue(name)
    if (supabase) {
      const parent = expect(await supabase.from('project_groups').select('user_id').eq('id', groupId).single())
      return projectFromRow(expect(await supabase.from('projects').insert({ name, group_id: groupId, user_id: parent.user_id, ...(color !== undefined ? { color } : {}) }).select().single()))
    }
    const data = read(); if (!data.groups.some(item => item.id === groupId)) throw new Error('그룹을 찾을 수 없습니다.')
    const project = { id: crypto.randomUUID(), name, groupId, color, createdAt: new Date().toISOString() }; write({ ...data, projects: [...data.projects, project] }); return project
  },
  async updateProject(id: string, name: string, color?: string): Promise<Project> {
    if (color !== undefined) color = checkedColor(color)
    name = nameValue(name)
    if (supabase) return projectFromRow(expect(await supabase.from('projects').update({ name, ...(color !== undefined ? { color } : {}) }).eq('id', id).select().single()))
    const data = read(), project = data.projects.find(item => item.id === id); if (!project) throw new Error('프로젝트를 찾을 수 없습니다.')
    const changed = { ...project, name, ...(color !== undefined ? { color } : {}) }; write({ ...data, projects: data.projects.map(item => item.id === id ? changed : item) }); return changed
  },
  async removeProject(id: string): Promise<void> {
    if (supabase) { expect(await supabase.from('projects').delete().eq('id', id).select('id').single()); return }
    const data = read(); if (!data.projects.some(item => item.id === id)) throw new Error('프로젝트를 찾을 수 없습니다.')
    write({ ...data, projects: data.projects.filter(item => item.id !== id), entries: data.entries.filter(item => item.projectId !== id) })
  },
  async saveEntry(projectId: string, draft: EntryDraft, id?: string): Promise<ProjectEntry> {
    const values = entryValue(draft)
    if (supabase) {
      const row = { kind: values.kind, title: values.title, content: values.content, date: values.date, end_date: values.endDate }
      const parent = id ? null : expect(await supabase.from('projects').select('user_id').eq('id', projectId).single())
      const result = id ? await supabase.from('project_entries').update(row).eq('id', id).eq('project_id', projectId).select().single() : await supabase.from('project_entries').insert({ ...row, project_id: projectId, user_id: parent!.user_id }).select().single()
      return entryFromRow(expect(result))
    }
    const data = read(); if (!data.projects.some(item => item.id === projectId)) throw new Error('프로젝트를 찾을 수 없습니다.')
    const existing = id ? data.entries.find(item => item.id === id && item.projectId === projectId) : undefined
    if (id && !existing) throw new Error('항목을 찾을 수 없습니다.')
    const entry = { ...(existing ?? { id: crypto.randomUUID(), projectId, completed: false, createdAt: new Date().toISOString() }), ...values }
    write({ ...data, entries: id ? data.entries.map(item => item.id === id ? entry : item) : [...data.entries, entry] }); return entry
  },
  async toggleEntry(id: string, completed: boolean): Promise<ProjectEntry> {
    if (supabase) return entryFromRow(expect(await supabase.from('project_entries').update({ completed }).eq('id', id).eq('kind', 'todo').select().single()))
    const data = read(), entry = data.entries.find(item => item.id === id && item.kind === 'todo'); if (!entry) throw new Error('할 일을 찾을 수 없습니다.')
    const changed = { ...entry, completed }; write({ ...data, entries: data.entries.map(item => item.id === id ? changed : item) }); return changed
  },
  async removeEntry(id: string): Promise<void> {
    if (supabase) { expect(await supabase.from('project_entries').delete().eq('id', id).select('id').single()); return }
    const data = read(); if (!data.entries.some(item => item.id === id)) throw new Error('항목을 찾을 수 없습니다.')
    write({ ...data, entries: data.entries.filter(item => item.id !== id) })
  },
}
