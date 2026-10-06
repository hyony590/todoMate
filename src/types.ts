export type Category = {
  id: string
  name: string
  color: string
}

export type NewCategory = Pick<Category, 'name' | 'color'>

export type Task = {
  id: string
  title: string
  date: string
  categoryId: string
  completed: boolean
  createdAt: string
}

export type NewTask = Pick<Task, 'title' | 'date' | 'categoryId'>

export type HabitSchedule = { effectiveOn: string; weekdays: number[]; excludeHolidays?: boolean }
export type Habit = { id: string; name: string; weekdays: number[]; createdAt: string; scheduleHistory?: HabitSchedule[]; excludeHolidays?: boolean; color?: string }
export type HabitCompletion = { habitId: string; date: string }
export type ViewId = 'calendar' | 'habits' | 'projects' | 'settings' | 'categories'
export type ThemeId = 'sharp' | 'soft' | 'midnight'
