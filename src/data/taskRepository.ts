import type { NewTask, Task } from '../types'

export interface TaskRepository {
  list(): Promise<Task[]>
  create(task: NewTask): Promise<Task>
  toggle(id: string): Promise<Task>
  remove(id: string): Promise<void>
}

// Supabase 연결 시 이 구현체만 SupabaseTaskRepository로 교체하면 됩니다.
export class LocalTaskRepository implements TaskRepository {
  private readonly storageKey = 'haru.tasks.v1'
  private fallback: Task[]

  constructor(seed: Task[]) {
    this.fallback = seed
  }

  async list() {
    const saved = localStorage.getItem(this.storageKey)
    return saved ? (JSON.parse(saved) as Task[]) : this.fallback
  }

  async create(input: NewTask) {
    const task: Task = {
      ...input,
      id: crypto.randomUUID(),
      completed: false,
      createdAt: new Date().toISOString(),
    }
    this.persist([...(await this.list()), task])
    return task
  }

  async toggle(id: string) {
    const tasks = await this.list()
    let changed = tasks[0]
    const next = tasks.map((task) => {
      if (task.id !== id) return task
      changed = { ...task, completed: !task.completed }
      return changed
    })
    this.persist(next)
    return changed
  }

  async remove(id: string) {
    this.persist((await this.list()).filter((task) => task.id !== id))
  }

  private persist(tasks: Task[]) {
    this.fallback = tasks
    localStorage.setItem(this.storageKey, JSON.stringify(tasks))
  }
}
