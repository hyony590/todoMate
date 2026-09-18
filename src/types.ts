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

export type ViewId = 'calendar' | 'settings' | 'categories'
export type ThemeId = 'sharp' | 'soft' | 'midnight'
