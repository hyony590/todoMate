import type { Habit, HabitCompletion } from '../types'
import { supabase } from './supabase'
import { changedHabitHistory, habitDateKey } from './habitSchedule'
import { checkedColor, defaultHabitColor } from './itemColors'

type HabitRow = { id: string; name: string; weekdays: number[]; created_at: string; schedule_history?: Habit['scheduleHistory']; exclude_holidays?: boolean; color?: string }
const fromRow = (row: HabitRow): Habit => ({ id: row.id, name: row.name, weekdays: row.weekdays, createdAt: row.created_at, scheduleHistory: row.schedule_history, excludeHolidays: !!row.exclude_holidays, color: row.color ?? defaultHabitColor })
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
  async create(name: string, weekdays: number[], excludeHolidays = false, color?: string): Promise<Habit> {
    if (color !== undefined) color = checkedColor(color)
    if (!supabase) {
      const habit = { id: crypto.randomUUID(), name, weekdays, excludeHolidays, color: color ?? defaultHabitColor, createdAt: new Date().toISOString() }
      const current = await this.list()
      localStorage.setItem('haru.habits.v1', JSON.stringify([...current.habits, habit]))
      return habit
    }
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!auth.user) throw new Error('로그인이 필요합니다.')
    const { data, error } = await supabase.from('habits').insert({ user_id: auth.user.id, name, weekdays, ...(color !== undefined ? { color } : {}), ...(excludeHolidays ? { exclude_holidays: true } : {}) }).select().single()
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
  async update(id: string, name: string, weekdays: number[], excludeHolidays = false, color?: string): Promise<Habit> {
    if (color !== undefined) color = checkedColor(color)
    const trimmed = name.trim()
    const repeatDays = [...new Set(weekdays)].sort((a, b) => a - b)
    if (!trimmed || trimmed.length > 80 || !repeatDays.length || repeatDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error('습관 이름과 반복 요일을 확인해주세요.')
    }
    if (!supabase) {
      const current = await this.list()
      const existing = current.habits.find(habit => habit.id === id)
      if (!existing) throw new Error('습관을 찾을 수 없습니다.')
      const updated = { ...existing, ...(color !== undefined ? { color } : {}), name: trimmed, weekdays: repeatDays, excludeHolidays, scheduleHistory: changedHabitHistory(existing, repeatDays, habitDateKey(new Date()), excludeHolidays) }
      localStorage.setItem('haru.habits.v1', JSON.stringify(current.habits.map(habit => habit.id === id ? updated : habit)))
      return updated
    }
    // Fail safely before changing anything if the history migration is not installed.
    const { error: schemaError } = await supabase.from('habits').select('id,schedule_history,exclude_holidays').eq('id', id).single()
    if (schemaError) throw new Error('습관 변경 이력 SQL을 먼저 적용해주세요. ' + schemaError.message)
    const { data, error } = await supabase.rpc(color === undefined ? 'update_haru_habit' : 'update_haru_habit_with_color', { habit_id_to_update: id, new_name: trimmed, new_weekdays: repeatDays, effective_on: habitDateKey(new Date()), new_exclude_holidays: excludeHolidays, ...(color !== undefined ? { new_color: color } : {}) })
    if (error) throw error
    return fromRow(data as HabitRow)
  },
  async remove(id: string): Promise<void> {
    if (!supabase) {
      const current = await this.list()
      if (!current.habits.some(habit => habit.id === id)) throw new Error('습관을 찾을 수 없습니다.')
      localStorage.setItem('haru.habits.v1', JSON.stringify(current.habits.filter(habit => habit.id !== id)))
      localStorage.setItem('haru.habitCompletions.v1', JSON.stringify(current.completions.filter(item => item.habitId !== id)))
      return
    }
    // The existing foreign key deletes only this habit's completion records atomically.
    const { error } = await supabase.from('habits').delete().eq('id', id).select('id').single()
    if (error) throw error
  },
}
