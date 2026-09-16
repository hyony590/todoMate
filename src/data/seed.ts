import type { Category, Task } from '../types'

const toDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const todayKey = toDateKey(new Date())

export const categories: Category[] = [
  { id: 'routine', name: '나를 돌보기', color: '#8fae89' },
  { id: 'work', name: '집중할 일', color: '#dd8d72' },
  { id: 'life', name: '생활', color: '#8ca5c9' },
]

export const seedTasks: Task[] = [
  {
    id: 'seed-1',
    title: '물 한 잔 마시고 가볍게 스트레칭',
    date: todayKey,
    categoryId: 'routine',
    completed: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-2',
    title: '이번 주 우선순위 세 가지 정리하기',
    date: todayKey,
    categoryId: 'work',
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-3',
    title: '30분 산책',
    date: todayKey,
    categoryId: 'routine',
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-4',
    title: '장보기 목록 확인',
    date: todayKey,
    categoryId: 'life',
    completed: false,
    createdAt: new Date().toISOString(),
  },
]
