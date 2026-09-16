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

export type Routine = {
  id: string
  title: string
  days: number[]
  color: string
  completedDates: string[]
  createdAt: string
}

export type NewRoutine = Pick<Routine, 'title' | 'days' | 'color'>

export type ViewId = 'today' | 'calendar' | 'routines' | 'settings' | 'categories'
export type ThemeId = 'sharp' | 'soft' | 'midnight'
