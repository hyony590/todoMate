import type { ProjectData, ProjectEntry } from './projectRepository'
import type { Category, Task } from '../types'
import { projectColor } from './itemColors'

export type ProjectVisibility = { todo: boolean; schedule: boolean }
export const defaultProjectVisibility: ProjectVisibility = { todo: true, schedule: true }
export function visibleProjectEntries(data: ProjectData, visibility: ProjectVisibility) {
  const accessible = new Set(data.projects.map(project => project.id))
  return data.entries.filter(entry => accessible.has(entry.projectId) &&
    ((entry.kind === 'todo' && visibility.todo) || (entry.kind === 'schedule' && visibility.schedule)))
}

// Allocate non-overlapping week lanes; clip at week edges without expanding long ranges.
export function projectWeekBars(entries: ProjectEntry[], days: string[]) {
  const lanes: number[] = []
  return entries.filter(entry => entry.kind === 'schedule' && entry.date && entry.date <= days[6] && (entry.endDate || entry.date) >= days[0])
    .sort((a, b) => a.date!.localeCompare(b.date!) || (b.endDate || b.date!).localeCompare(a.endDate || a.date!) || a.id.localeCompare(b.id))
    .map(entry => {
      const start = days.findIndex(day => day >= entry.date!)
      const end = days.map(day => day <= (entry.endDate || entry.date!)).lastIndexOf(true)
      let lane = lanes.findIndex(lastEnd => lastEnd < start)
      if (lane < 0) lane = lanes.length
      lanes[lane] = end
      return { entry, start, end, lane, startsHere: entry.date! >= days[0], endsHere: (entry.endDate || entry.date!) <= days[6] }
    })
}

export function projectEntryOccursOn(entry: ProjectEntry, date: string) {
  if (!entry.date || entry.kind === 'memo') return false
  return entry.kind === 'todo' ? entry.date === date : entry.date <= date && date <= (entry.endDate || entry.date)
}

// Only expand the visible month and its adjacent calendar cells, even for long schedules.
export function projectCalendar(data: ProjectData, selectedDate: string) {
  const [year, month] = selectedDate.split('-').map(Number)
  const categories: Category[] = data.projects.map(project => {
    return { id: project.id, name: project.name, color: projectColor(project) }
  })
  const accessible = new Set(categories.map(item => item.id))
  const entries = data.entries.filter(item => accessible.has(item.projectId))
  const tasks: Task[] = []
  const last = new Date(year, month, 0).getDate()
  for (let day = -6; day <= last + 6; day++) {
    const cell = new Date(year, month - 1, day)
    const date = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`
    for (const entry of entries) {
      if (projectEntryOccursOn(entry, date)) tasks.push({ id: `${entry.id}:${date}`, title: entry.title, date, categoryId: entry.projectId, completed: entry.kind === 'todo' && entry.completed, createdAt: entry.createdAt })
    }
  }
  return { tasks, categories }
}
