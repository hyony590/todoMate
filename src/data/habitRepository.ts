import type { Habit, HabitCompletion } from '../types'
import { supabase } from './supabase'

type HabitRow = { id: string; name: string; weekdays: number[]; created_at: string }
const fromRow = (row: HabitRow): Habit => ({ id: row.id, name: row.name, weekdays: row.weekdays, createdAt: row.created_at })
export const habitRepository = {
  async list(): Promise<{ habits: Habit[]; completions: HabitCompletion[] }> {
    if (!supabase) return { habits: JSON.parse(localStorage.getItem('haru.habits.v1') ?? '[]'), completions: JSON.parse(localStorage.getItem('haru.habitCompletions.v1') ?? '[]') }
    const [habits, completions] = await Promise.all([
      supabase.from('habits').select('*').order('created_at'),
      supabase.from('habit_completions').select('habit_id,date'),
    ])
    if (habits.error) throw habits.error
    if (completions.error) throw completions.error
    return { habits: (habits.data as HabitRow[]).map(fromRow), completions: completions.data.map(row => ({ habitId: row.habit_id, date: row.date })) }
  },
  async create(name: string, weekdays: number[]): Promise<Habit> {
    if (!supabase) {
      const habit = { id: crypto.randomUUID(), name, weekdays, createdAt: new Date().toISOString() }
      const current = await this.list()
      localStorage.setItem('haru.habits.v1', JSON.stringify([...current.habits, habit]))
      return habit
    }
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!auth.user) throw new Error('로그인이 필요합니다.')
    const { data, error } = await supabase.from('habits').insert({ user_id: auth.user.id, name, weekdays }).select().single()
    if (error) throw error
    return fromRow(data)
  },
  async setCompleted(habitId: string, date: string, completed: boolean) {
    if (!supabase) {
      const current = await this.list()
      const next = current.completions.filter(item => item.habitId !== habitId || item.date !== date)
      if (completed) next.push({ habitId, date })
      localStorage.setItem('haru.habitCompletions.v1', JSON.stringify(next))
      return
    }
    if (!completed) {
      const { error } = await supabase.from('habit_completions').delete().eq('habit_id', habitId).eq('date', date)
      if (error) throw error
      return
    }
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!auth.user) throw new Error('로그인이 필요합니다.')
    const { error } = await supabase.from('habit_completions').upsert({ user_id: auth.user.id, habit_id: habitId, date }, { onConflict: 'habit_id,date' })
    if (error) throw error
  },
}
