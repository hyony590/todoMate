import type { Category, Task } from '../types'

export function summarizeCategories(tasks: Task[], categories: Category[]) {
  const totals = new Map<string, { total: number; remaining: number }>()
  for (const task of tasks) {
    const tally = totals.get(task.categoryId) ?? { total: 0, remaining: 0 }
    tally.total += 1
    if (!task.completed) tally.remaining += 1
    totals.set(task.categoryId, tally)
  }
  return categories.flatMap(category => {
    const tally = totals.get(category.id)
    return tally ? [{ ...category, ...tally }] : []
  })
}

export function readableText(color: string) {
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255)
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  return luminance > 0.179 ? '#151719' : '#ffffff'
}
