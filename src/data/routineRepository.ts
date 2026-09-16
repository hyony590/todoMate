import type { NewRoutine, Routine } from '../types'
import { todayKey } from './seed'

export interface RoutineRepository {
  list(): Promise<Routine[]>
  create(routine: NewRoutine): Promise<Routine>
  toggle(id: string, date: string): Promise<Routine>
  remove(id: string): Promise<void>
}

const seedRoutines: Routine[] = [
  {
    id: 'routine-seed-1',
    title: '물 8잔 마시기',
    days: [0, 1, 2, 3, 4, 5, 6],
    color: '#3d8b67',
    completedDates: [todayKey],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'routine-seed-2',
    title: '영어 단어 20개',
    days: [1, 2, 3, 4, 5],
    color: '#5276b8',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'routine-seed-3',
    title: '한 주 돌아보기',
    days: [0],
    color: '#e06445',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
]

export class LocalRoutineRepository implements RoutineRepository {
  private readonly storageKey = 'haru.routines.v1'
  private fallback = seedRoutines

  async list() {
    const saved = localStorage.getItem(this.storageKey)
    return saved ? (JSON.parse(saved) as Routine[]) : this.fallback
  }

  async create(input: NewRoutine) {
    const routine: Routine = {
      ...input,
      id: crypto.randomUUID(),
      completedDates: [],
      createdAt: new Date().toISOString(),
    }
    this.persist([...(await this.list()), routine])
    return routine
  }

  async toggle(id: string, date: string) {
    const routines = await this.list()
    let changed = routines[0]
    const next = routines.map((routine) => {
      if (routine.id !== id) return routine
      const completedDates = routine.completedDates.includes(date)
        ? routine.completedDates.filter((key) => key !== date)
        : [...routine.completedDates, date]
      changed = { ...routine, completedDates }
      return changed
    })
    this.persist(next)
    return changed
  }

  async remove(id: string) {
    this.persist((await this.list()).filter((routine) => routine.id !== id))
  }

  private persist(routines: Routine[]) {
    this.fallback = routines
    localStorage.setItem(this.storageKey, JSON.stringify(routines))
  }
}
