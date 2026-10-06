import type { Habit, HabitCompletion, HabitSchedule } from '../types'

export function habitDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function habitWeekdaysOn(habit: Habit, date: string): number[] {
  const history = [...(habit.scheduleHistory ?? [])].sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn))
  const active = history.filter(item => item.effectiveOn <= date).at(-1)
  return active?.weekdays ?? history[0]?.weekdays ?? habit.weekdays
}

export function habitExcludesHolidaysOn(habit: Habit, date: string): boolean {
  const history = [...(habit.scheduleHistory ?? [])].sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn))
  const active = history.filter(item => item.effectiveOn <= date).at(-1) ?? history[0]
  return active ? !!active.excludeHolidays : !!habit.excludeHolidays
}

export function habitIsScheduled(habit: Habit, date: string, holiday: boolean | null = false): boolean {
  const [y, m, d] = date.split('-').map(Number)
  return habitDateKey(new Date(habit.createdAt)) <= date && habitWeekdaysOn(habit, date).includes(new Date(y, m - 1, d).getDay()) && (!habitExcludesHolidaysOn(habit, date) || holiday === false)
}

export function habitIsVisible(habit: Habit, date: string, completions: HabitCompletion[], holiday: boolean | null = false): boolean {
  return habitIsScheduled(habit, date, holiday) || completions.some(item => item.habitId === habit.id && item.date === date)
}

export function changedHabitHistory(habit: Habit, weekdays: number[], today: string, excludeHolidays = !!habit.excludeHolidays): HabitSchedule[] {
  const history = habit.scheduleHistory?.length ? habit.scheduleHistory : [{ effectiveOn: habitDateKey(new Date(habit.createdAt)), weekdays: habit.weekdays, excludeHolidays: !!habit.excludeHolidays }]
  if ([...habit.weekdays].sort().join(',') === [...weekdays].sort().join(',') && !!habit.excludeHolidays === excludeHolidays) return history
  return [...history.filter(item => item.effectiveOn < today), { effectiveOn: today, weekdays: [...weekdays], excludeHolidays }]
}
