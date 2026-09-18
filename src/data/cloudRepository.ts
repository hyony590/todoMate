import type { Category, NewCategory, NewTask, Task } from '../types'
import type { TaskRepository } from './taskRepository'
import type { CategoryRepository } from './categoryRepository'
import { supabase } from './supabase'

async function owner() {
  const { data, error } = await supabase!.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('로그인이 필요합니다.')
  return data.user.id
}
type TaskRow = { id: string; title: string; date: string; category_id: string; completed: boolean; created_at: string }
const taskFromRow = (row: TaskRow): Task => ({ id: row.id, title: row.title, date: row.date, categoryId: row.category_id, completed: row.completed, createdAt: row.created_at })

export class SupabaseTaskRepository implements TaskRepository {
  async list() {
    const { data, error } = await supabase!.from('tasks').select('*').order('created_at')
    if (error) throw error
    return (data as TaskRow[]).map(taskFromRow)
  }
  async create(input: NewTask) {
    const { data, error } = await supabase!.from('tasks').insert({ user_id: await owner(), title: input.title, date: input.date, category_id: input.categoryId }).select().single()
    if (error) throw error
    return taskFromRow(data)
  }
  async toggle(id: string) {
    const { data: current, error: readError } = await supabase!.from('tasks').select('completed').eq('id', id).single()
    if (readError) throw readError
    const { data, error } = await supabase!.from('tasks').update({ completed: !current.completed }).eq('id', id).select().single()
    if (error) throw error
    return taskFromRow(data)
  }
  async remove(id: string) {
    const { error } = await supabase!.from('tasks').delete().eq('id', id)
    if (error) throw error
  }
}
export class SupabaseCategoryRepository implements CategoryRepository {
  async list(): Promise<Category[]> {
    const { data, error } = await supabase!.from('categories').select('id,name,color').order('created_at')
    if (error) throw error
    return data
  }
  async create(input: NewCategory): Promise<Category> {
    const { data, error } = await supabase!.from('categories').insert({ ...input, user_id: await owner() }).select('id,name,color').single()
    if (error) throw error
    return data
  }
  async update(id: string, input: NewCategory): Promise<Category> {
    const { data, error } = await supabase!.from('categories').update(input).eq('id', id).select('id,name,color').single()
    if (error) throw error
    return data
  }
  async remove(id: string) {
    const { error } = await supabase!.from('categories').delete().eq('id', id)
    if (error) throw error
  }
}
