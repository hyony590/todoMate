import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Home,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { categories, seedTasks, todayKey } from './data/seed'
import { LocalTaskRepository } from './data/taskRepository'
import type { Task } from './types'

const repository = new LocalTaskRepository(seedTasks)
const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function offsetDate(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function getWeek(date: Date) {
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay()
  const monday = offsetDate(date, mondayOffset)
  return Array.from({ length: 7 }, (_, index) => offsetDate(monday, index))
}

function App() {
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [categoryId, setCategoryId] = useState(categories[1].id)
  const [isAdding, setIsAdding] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    repository.list().then((data) => {
      setTasks(data)
      setIsLoaded(true)
    })
  }, [])

  const selected = fromDateKey(selectedDate)
  const week = getWeek(selected)
  const selectedTasks = tasks.filter((task) => task.date === selectedDate)
  const completedCount = selectedTasks.filter((task) => task.completed).length
  const progress = selectedTasks.length ? Math.round((completedCount / selectedTasks.length) * 100) : 0

  const taskCounts = useMemo(() => {
    return tasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.date] = (acc[task.date] ?? 0) + 1
      return acc
    }, {})
  }, [tasks])

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const title = newTask.trim()
    if (!title) return
    const created = await repository.create({ title, date: selectedDate, categoryId })
    setTasks((current) => [...current, created])
    setNewTask('')
    setIsAdding(false)
  }

  async function toggleTask(id: string) {
    const changed = await repository.toggle(id)
    setTasks((current) => current.map((task) => (task.id === id ? changed : task)))
  }

  async function removeTask(id: string) {
    await repository.remove(id)
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  const isToday = selectedDate === todayKey
  const title = isToday
    ? '오늘'
    : `${selected.getMonth() + 1}월 ${selected.getDate()}일 ${weekdays[selected.getDay()]}요일`

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-label="하루">
          <span className="brand-symbol">ㅎ</span>
          <span>하루</span>
        </div>

        <nav className="side-nav" aria-label="주요 메뉴">
          <button className="nav-item active"><Home size={19} />오늘</button>
          <button className="nav-item"><CalendarDays size={19} />캘린더</button>
          <button className="nav-item"><Clock3 size={19} />루틴</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="small-quote">
            <Sparkles size={17} />
            <p>작은 완료가<br />좋은 하루를 만들어요.</p>
          </div>
          <button className="nav-item"><Settings size={19} />설정</button>
          <button className="profile-button">
            <span className="avatar">나</span>
            <span><strong>나의 하루</strong><small>개인 공간</small></span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">DAILY PLANNER</p>
            <h1>{title}</h1>
          </div>
          <button className="profile-mobile" aria-label="프로필"><CircleUserRound size={25} /></button>
        </header>

        <section className="week-strip" aria-label="주간 날짜 선택">
          <button className="week-arrow" onClick={() => setSelectedDate(toDateKey(offsetDate(selected, -7)))} aria-label="이전 주"><ChevronLeft size={20} /></button>
          <div className="week-days">
            {week.map((date) => {
              const key = toDateKey(date)
              const active = key === selectedDate
              return (
                <button key={key} className={`day-button ${active ? 'active' : ''}`} onClick={() => setSelectedDate(key)}>
                  <span>{weekdays[date.getDay()]}</span>
                  <strong>{date.getDate()}</strong>
                  <i className={taskCounts[key] ? 'has-task' : ''} />
                </button>
              )
            })}
          </div>
          <button className="week-arrow" onClick={() => setSelectedDate(toDateKey(offsetDate(selected, 7)))} aria-label="다음 주"><ChevronRight size={20} /></button>
        </section>

        <section className="task-section">
          <div className="section-heading">
            <div>
              <h2>할 일</h2>
              <p>{selectedTasks.length ? `${completedCount}개 완료 · ${selectedTasks.length - completedCount}개 남음` : '가볍게 시작해볼까요?'}</p>
            </div>
            <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
              <span>{progress}%</span>
            </div>
          </div>

          <div className={`task-content ${isLoaded ? 'visible' : ''}`}>
            {categories.map((category) => {
              const categoryTasks = selectedTasks.filter((task) => task.categoryId === category.id)
              if (!categoryTasks.length) return null
              return (
                <div className="task-group" key={category.id}>
                  <div className="group-title">
                    <span className="color-dot" style={{ background: category.color }} />
                    <h3>{category.name}</h3>
                    <span>{categoryTasks.filter((task) => task.completed).length}/{categoryTasks.length}</span>
                  </div>
                  <div className="task-list">
                    {categoryTasks.map((task) => (
                      <div className={`task-row ${task.completed ? 'completed' : ''}`} key={task.id}>
                        <button className="check-button" style={{ '--task-color': category.color } as React.CSSProperties} onClick={() => toggleTask(task.id)} aria-label={task.completed ? '완료 취소' : '완료'}>
                          {task.completed && <Check size={15} strokeWidth={3} />}
                        </button>
                        <span className="task-title">{task.title}</span>
                        <button className="delete-button" onClick={() => removeTask(task.id)} aria-label="할 일 삭제"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {!selectedTasks.length && (
              <div className="empty-state">
                <span>☁️</span>
                <strong>아직 정해진 일이 없어요</strong>
                <p>오늘 마음에 두고 있는 일을 하나 적어보세요.</p>
              </div>
            )}

            {isAdding ? (
              <form className="add-form" onSubmit={addTask}>
                <input autoFocus value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="무엇을 할까요?" maxLength={80} />
                <div className="form-footer">
                  <div className="category-picks">
                    {categories.map((category) => (
                      <button type="button" key={category.id} className={categoryId === category.id ? 'selected' : ''} onClick={() => setCategoryId(category.id)}>
                        <span style={{ background: category.color }} />{category.name}
                      </button>
                    ))}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="text-button" onClick={() => setIsAdding(false)}>취소</button>
                    <button type="submit" className="submit-button">추가</button>
                  </div>
                </div>
              </form>
            ) : (
              <button className="add-task-button" onClick={() => setIsAdding(true)}><Plus size={20} />할 일 추가</button>
            )}
          </div>
        </section>
      </main>

      <aside className="context-panel">
        <div className="month-heading">
          <button onClick={() => setSelectedDate(toDateKey(new Date(selected.getFullYear(), selected.getMonth() - 1, 1)))} aria-label="이전 달"><ChevronLeft size={18} /></button>
          <strong>{selected.getFullYear()}년 {monthNames[selected.getMonth()]}</strong>
          <button onClick={() => setSelectedDate(toDateKey(new Date(selected.getFullYear(), selected.getMonth() + 1, 1)))} aria-label="다음 달"><ChevronRight size={18} /></button>
        </div>
        <MiniCalendar date={selected} selectedDate={selectedDate} tasks={tasks} onSelect={setSelectedDate} />
        <div className="day-note">
          <span className="note-label">오늘의 한마디</span>
          <blockquote>“모든 일을 끝내지 않아도<br />충분히 좋은 하루예요.”</blockquote>
          <div className="leaf-illustration"><i /><i /><i /></div>
        </div>
      </aside>

      <nav className="mobile-nav" aria-label="모바일 메뉴">
        <button className="active"><Home size={21} /><span>오늘</span></button>
        <button><CalendarDays size={21} /><span>캘린더</span></button>
        <button className="mobile-add" onClick={() => setIsAdding(true)} aria-label="할 일 추가"><Plus size={24} /></button>
        <button><Clock3 size={21} /><span>루틴</span></button>
        <button><CircleUserRound size={21} /><span>나</span></button>
      </nav>
    </div>
  )
}

function MiniCalendar({ date, selectedDate, tasks, onSelect }: { date: Date; selectedDate: string; tasks: Task[]; onSelect: (date: string) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() + lastDay }, (_, index) => index < first.getDay() ? null : index - first.getDay() + 1)
  while (cells.length % 7) cells.push(null)
  const taskDates = new Set(tasks.map((task) => task.date))

  return (
    <div className="mini-calendar">
      <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />
          const key = toDateKey(new Date(date.getFullYear(), date.getMonth(), day))
          return (
            <button key={key} className={`${key === selectedDate ? 'selected' : ''} ${key === todayKey ? 'today' : ''}`} onClick={() => onSelect(key)}>
              {day}<i className={taskDates.has(key) ? 'has-task' : ''} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default App
