import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Database,
  Home,
  Layers3,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Repeat2,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { LocalCategoryRepository } from './data/categoryRepository'
import { seedTasks, todayKey } from './data/seed'
import { LocalRoutineRepository } from './data/routineRepository'
import { LocalTaskRepository } from './data/taskRepository'
import type { Category, Routine, Task, ThemeId, ViewId } from './types'

const taskRepository = new LocalTaskRepository(seedTasks)
const routineRepository = new LocalRoutineRepository()
const categoryRepository = new LocalCategoryRepository()
const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const routineColors = ['#3d8b67', '#e06445', '#5276b8']
const categoryColors = ['#3d8b67', '#e06445', '#5276b8', '#b48738', '#8a63a8', '#555b63']

const themes: { id: ThemeId; name: string; description: string; icon: typeof Sun }[] = [
  { id: 'sharp', name: 'Sharp', description: '선명한 대비와 단단한 모서리', icon: Layers3 },
  { id: 'soft', name: 'Soft', description: '따뜻한 색감과 부드러운 표면', icon: Sun },
  { id: 'midnight', name: 'Midnight', description: '눈이 편안한 어두운 작업 공간', icon: Moon },
]

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

function scheduleLabel(days: number[]) {
  if (days.length === 7) return '매일'
  if (days.join(',') === '1,2,3,4,5') return '평일'
  return days.map((day) => weekdays[day]).join(' · ')
}

function App() {
  const [view, setView] = useState<ViewId>('today')
  const [theme, setTheme] = useState<ThemeId>(() => (localStorage.getItem('haru.theme') as ThemeId | null) ?? 'sharp')
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [tasks, setTasks] = useState<Task[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [newTask, setNewTask] = useState('')
  const [categoryId, setCategoryId] = useState('work')
  const [isAdding, setIsAdding] = useState(false)
  const [newRoutine, setNewRoutine] = useState('')
  const [routineDays, setRoutineDays] = useState([1, 2, 3, 4, 5])
  const [routineColor, setRoutineColor] = useState(routineColors[0])
  const [isAddingRoutine, setIsAddingRoutine] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    Promise.all([taskRepository.list(), routineRepository.list(), categoryRepository.list()]).then(([taskData, routineData, categoryData]) => {
      setTasks(taskData)
      setRoutines(routineData)
      setCategories(categoryData)
      setIsLoaded(true)
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('haru.theme', theme)
  }, [theme])

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

  function switchView(nextView: ViewId) {
    setView(nextView)
    setIsAdding(false)
    setIsAddingRoutine(false)
  }

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const title = newTask.trim()
    if (!title) return
    const created = await taskRepository.create({ title, date: selectedDate, categoryId })
    setTasks((current) => [...current, created])
    setNewTask('')
    setIsAdding(false)
  }

  async function toggleTask(id: string) {
    const changed = await taskRepository.toggle(id)
    setTasks((current) => current.map((task) => (task.id === id ? changed : task)))
  }

  async function removeTask(id: string) {
    await taskRepository.remove(id)
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  async function addRoutine(event: FormEvent) {
    event.preventDefault()
    const title = newRoutine.trim()
    if (!title || !routineDays.length) return
    const created = await routineRepository.create({ title, days: [...routineDays].sort(), color: routineColor })
    setRoutines((current) => [...current, created])
    setNewRoutine('')
    setRoutineDays([1, 2, 3, 4, 5])
    setIsAddingRoutine(false)
  }

  async function toggleRoutine(id: string) {
    const changed = await routineRepository.toggle(id, todayKey)
    setRoutines((current) => current.map((routine) => (routine.id === id ? changed : routine)))
  }

  async function removeRoutine(id: string) {
    await routineRepository.remove(id)
    setRoutines((current) => current.filter((routine) => routine.id !== id))
  }

  async function createCategory(name: string, color: string) {
    const created = await categoryRepository.create({ name, color })
    setCategories((current) => [...current, created])
    return created
  }

  async function updateCategory(id: string, name: string, color: string) {
    const changed = await categoryRepository.update(id, { name, color })
    setCategories((current) => current.map((category) => category.id === id ? changed : category))
  }

  async function removeCategory(id: string) {
    if (tasks.some((task) => task.categoryId === id)) return
    await categoryRepository.remove(id)
    setCategories((current) => current.filter((category) => category.id !== id))
    if (categoryId === id) setCategoryId(categories.find((category) => category.id !== id)?.id ?? '')
  }

  function toggleRoutineDay(day: number) {
    setRoutineDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])
  }

  const isToday = selectedDate === todayKey
  const todayTitle = isToday ? '오늘' : `${selected.getMonth() + 1}월 ${selected.getDate()}일 ${weekdays[selected.getDay()]}요일`
  const pageMeta = {
    today: { eyebrow: 'DAILY PLANNER', title: todayTitle },
    calendar: { eyebrow: 'MONTHLY VIEW', title: '캘린더' },
    routines: { eyebrow: 'REPEAT & BUILD', title: '루틴' },
    settings: { eyebrow: 'PREFERENCES', title: '설정' },
    categories: { eyebrow: 'ORGANIZE TASKS', title: '카테고리' },
  }[view]

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand-mark" aria-label="하루"><span className="brand-symbol">ㅎ</span><span>하루</span></div>
        <nav className="side-nav" aria-label="주요 메뉴">
          <button className={`nav-item ${view === 'today' ? 'active' : ''}`} onClick={() => switchView('today')}><Home size={19} />오늘</button>
          <button className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => switchView('calendar')}><CalendarDays size={19} />캘린더</button>
          <button className={`nav-item ${view === 'routines' ? 'active' : ''}`} onClick={() => switchView('routines')}><Clock3 size={19} />루틴</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="small-quote"><Sparkles size={17} /><p>작은 완료가<br />좋은 하루를 만들어요.</p></div>
          <button className={`nav-item ${view === 'settings' || view === 'categories' ? 'active' : ''}`} onClick={() => switchView('settings')}><Settings size={19} />설정</button>
          <button className="profile-button" onClick={() => switchView('settings')}><span className="avatar">나</span><span><strong>나의 하루</strong><small>개인 공간</small></span><MoreHorizontal size={18} /></button>
        </div>
      </aside>

      <main className={`workspace view-${view}`}>
        <header className="topbar">
          <div><p className="eyebrow">{pageMeta.eyebrow}</p><h1>{pageMeta.title}</h1></div>
          <button className="profile-mobile" onClick={() => switchView('settings')} aria-label="설정 열기"><CircleUserRound size={25} /></button>
        </header>

        <div className="view-stage" key={view}>
          {view === 'today' && <TodayView categories={categories} selected={selected} selectedDate={selectedDate} selectedTasks={selectedTasks} progress={progress} completedCount={completedCount} week={week} taskCounts={taskCounts} isLoaded={isLoaded} isAdding={isAdding} newTask={newTask} categoryId={categoryId} onSelectDate={setSelectedDate} onAddOpen={() => setIsAdding(true)} onAddClose={() => setIsAdding(false)} onNewTask={setNewTask} onCategory={setCategoryId} onAddTask={addTask} onToggleTask={toggleTask} onRemoveTask={removeTask} />}
          {view === 'calendar' && <CalendarView categories={categories} date={selected} selectedDate={selectedDate} tasks={tasks} onSelect={setSelectedDate} onMonth={(amount) => setSelectedDate(toDateKey(new Date(selected.getFullYear(), selected.getMonth() + amount, 1)))} />}
          {view === 'routines' && <RoutinesView routines={routines} isAdding={isAddingRoutine} newRoutine={newRoutine} routineDays={routineDays} routineColor={routineColor} onAddOpen={() => setIsAddingRoutine(true)} onAddClose={() => setIsAddingRoutine(false)} onNewRoutine={setNewRoutine} onToggleDay={toggleRoutineDay} onColor={setRoutineColor} onAdd={addRoutine} onToggle={toggleRoutine} onRemove={removeRoutine} />}
          {view === 'settings' && <SettingsView theme={theme} categoryCount={categories.length} onTheme={setTheme} onCategories={() => switchView('categories')} />}
          {view === 'categories' && <CategoriesView categories={categories} tasks={tasks} onBack={() => switchView('settings')} onCreate={createCategory} onUpdate={updateCategory} onRemove={removeCategory} />}
        </div>
      </main>

      <ContextPanel categories={categories} view={view} selected={selected} selectedDate={selectedDate} selectedTasks={selectedTasks} tasks={tasks} routines={routines} theme={theme} week={week} onSelectDate={setSelectedDate} onOpenDate={() => switchView('today')} />

      <nav className="mobile-nav" aria-label="모바일 메뉴">
        <button className={view === 'today' ? 'active' : ''} onClick={() => switchView('today')}><Home size={21} /><span>오늘</span></button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => switchView('calendar')}><CalendarDays size={21} /><span>캘린더</span></button>
        <button className="mobile-add" onClick={() => { switchView('today'); setIsAdding(true) }} aria-label="할 일 추가"><Plus size={24} /></button>
        <button className={view === 'routines' ? 'active' : ''} onClick={() => switchView('routines')}><Clock3 size={21} /><span>루틴</span></button>
        <button className={view === 'settings' || view === 'categories' ? 'active' : ''} onClick={() => switchView('settings')}><Settings size={21} /><span>설정</span></button>
      </nav>
    </div>
  )
}

type TodayViewProps = {
  categories: Category[]; selected: Date; selectedDate: string; selectedTasks: Task[]; progress: number; completedCount: number; week: Date[]; taskCounts: Record<string, number>; isLoaded: boolean; isAdding: boolean; newTask: string; categoryId: string
  onSelectDate: (date: string) => void; onAddOpen: () => void; onAddClose: () => void; onNewTask: (title: string) => void; onCategory: (id: string) => void; onAddTask: (event: FormEvent) => void; onToggleTask: (id: string) => void; onRemoveTask: (id: string) => void
}

function TodayView(props: TodayViewProps) {
  return (
    <>
      <section className="week-strip" aria-label="주간 날짜 선택">
        <button className="week-arrow" onClick={() => props.onSelectDate(toDateKey(offsetDate(props.selected, -7)))} aria-label="이전 주"><ChevronLeft size={20} /></button>
        <div className="week-days">{props.week.map((date) => { const key = toDateKey(date); return <button key={key} className={`day-button ${key === props.selectedDate ? 'active' : ''}`} onClick={() => props.onSelectDate(key)}><span>{weekdays[date.getDay()]}</span><strong>{date.getDate()}</strong><i className={props.taskCounts[key] ? 'has-task' : ''} /></button> })}</div>
        <button className="week-arrow" onClick={() => props.onSelectDate(toDateKey(offsetDate(props.selected, 7)))} aria-label="다음 주"><ChevronRight size={20} /></button>
      </section>
      <section className="task-section">
        <div className="section-heading"><div><h2>할 일</h2><p>{props.selectedTasks.length ? `${props.completedCount}개 완료 · ${props.selectedTasks.length - props.completedCount}개 남음` : '가볍게 시작해볼까요?'}</p></div><div className="progress-ring" style={{ '--progress': `${props.progress * 3.6}deg` } as CSSProperties}><span>{props.progress}%</span></div></div>
        <div className={`task-content ${props.isLoaded ? 'visible' : ''}`}>
          {props.categories.map((category) => {
            const categoryTasks = props.selectedTasks.filter((task) => task.categoryId === category.id)
            if (!categoryTasks.length) return null
            return <div className="task-group" key={category.id}><div className="group-title"><span className="color-dot" style={{ background: category.color }} /><h3>{category.name}</h3><span>{categoryTasks.filter((task) => task.completed).length}/{categoryTasks.length}</span></div><div className="task-list">{categoryTasks.map((task) => <div className={`task-row ${task.completed ? 'completed' : ''}`} key={task.id}><button className="check-button" style={{ '--task-color': category.color } as CSSProperties} onClick={() => props.onToggleTask(task.id)} aria-label={task.completed ? '완료 취소' : '완료'}>{task.completed && <Check size={15} strokeWidth={3} />}</button><span className="task-title">{task.title}</span><button className="delete-button" onClick={() => props.onRemoveTask(task.id)} aria-label="할 일 삭제"><Trash2 size={16} /></button></div>)}</div></div>
          })}
          {!props.selectedTasks.length && <div className="empty-state"><span>—</span><strong>아직 정해진 일이 없어요</strong><p>오늘 마음에 두고 있는 일을 하나 적어보세요.</p></div>}
          {props.isAdding ? <form className="add-form" onSubmit={props.onAddTask}><input autoFocus value={props.newTask} onChange={(event) => props.onNewTask(event.target.value)} placeholder="무엇을 할까요?" maxLength={80} /><div className="form-footer"><div className="category-picks">{props.categories.map((category) => <button type="button" key={category.id} className={props.categoryId === category.id ? 'selected' : ''} onClick={() => props.onCategory(category.id)}><span style={{ background: category.color }} />{category.name}</button>)}</div><div className="form-actions"><button type="button" className="text-button" onClick={props.onAddClose}>취소</button><button type="submit" className="submit-button">추가</button></div></div></form> : <button className="add-task-button" onClick={props.onAddOpen}><Plus size={20} />할 일 추가</button>}
        </div>
      </section>
    </>
  )
}

function CalendarView({ categories, date, selectedDate, tasks, onSelect, onMonth }: { categories: Category[]; date: Date; selectedDate: string; tasks: Task[]; onSelect: (date: string) => void; onMonth: (amount: number) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = new Date(date.getFullYear(), date.getMonth(), 1 - first.getDay())
  const cells = Array.from({ length: 42 }, (_, index) => offsetDate(start, index))
  const monthPrefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  return <section className="calendar-view"><div className="calendar-toolbar"><div><strong>{date.getFullYear()}년 {monthNames[date.getMonth()]}</strong><span>{tasks.filter((task) => task.date.startsWith(monthPrefix)).length}개의 할 일</span></div><div className="toolbar-actions"><button onClick={() => onSelect(todayKey)}>오늘</button><button onClick={() => onMonth(-1)} aria-label="이전 달"><ChevronLeft size={18} /></button><button onClick={() => onMonth(1)} aria-label="다음 달"><ChevronRight size={18} /></button></div></div><div className="full-calendar"><div className="full-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="full-calendar-grid">{cells.map((cell) => { const key = toDateKey(cell); const dayTasks = tasks.filter((task) => task.date === key); const outside = cell.getMonth() !== date.getMonth(); return <button key={key} className={`${outside ? 'outside' : ''} ${key === selectedDate ? 'selected' : ''} ${key === todayKey ? 'today' : ''}`} onClick={() => onSelect(key)}><span className="date-number">{cell.getDate()}</span><span className="calendar-task-stack">{dayTasks.slice(0, 2).map((task) => { const category = categories.find((item) => item.id === task.categoryId); return <i key={task.id} style={{ '--event-color': category?.color ?? '#888' } as CSSProperties}>{task.title}</i> })}{dayTasks.length > 2 && <small>+{dayTasks.length - 2}</small>}</span></button> })}</div></div></section>
}

type RoutinesViewProps = { routines: Routine[]; isAdding: boolean; newRoutine: string; routineDays: number[]; routineColor: string; onAddOpen: () => void; onAddClose: () => void; onNewRoutine: (title: string) => void; onToggleDay: (day: number) => void; onColor: (color: string) => void; onAdd: (event: FormEvent) => void; onToggle: (id: string) => void; onRemove: (id: string) => void }

function RoutinesView(props: RoutinesViewProps) {
  const todayDay = new Date().getDay()
  const scheduled = props.routines.filter((routine) => routine.days.includes(todayDay))
  const completed = scheduled.filter((routine) => routine.completedDates.includes(todayKey)).length
  return <section className="routines-view"><div className="routine-summary"><div><span>오늘의 루틴</span><strong>{completed}<small> / {scheduled.length}</small></strong></div><div className="routine-progress"><i style={{ width: `${scheduled.length ? (completed / scheduled.length) * 100 : 0}%` }} /></div></div><div className="routine-list">{props.routines.map((routine) => { const done = routine.completedDates.includes(todayKey); const isScheduled = routine.days.includes(todayDay); return <div className={`routine-row ${done ? 'completed' : ''}`} key={routine.id}><button className="routine-check" disabled={!isScheduled} style={{ '--routine-color': routine.color } as CSSProperties} onClick={() => props.onToggle(routine.id)} aria-label={`${routine.title} ${done ? '완료 취소' : '완료'}`}>{done && <Check size={16} strokeWidth={3} />}</button><span className="routine-color" style={{ background: routine.color }} /><div><strong>{routine.title}</strong><small>{scheduleLabel(routine.days)}{!isScheduled && ' · 오늘은 쉬는 날'}</small></div><button className="delete-button" onClick={() => props.onRemove(routine.id)} aria-label="루틴 삭제"><Trash2 size={16} /></button></div> })}</div>{props.isAdding ? <form className="routine-form" onSubmit={props.onAdd}><div className="routine-form-title"><Repeat2 size={18} /><input autoFocus value={props.newRoutine} onChange={(event) => props.onNewRoutine(event.target.value)} placeholder="새 루틴 이름" maxLength={60} /></div><div className="routine-form-row"><span>반복 요일</span><div className="day-picks">{weekdays.map((day, index) => <button type="button" key={day} className={props.routineDays.includes(index) ? 'selected' : ''} onClick={() => props.onToggleDay(index)}>{day}</button>)}</div></div><div className="routine-form-row"><span>표시 색상</span><div className="color-picks">{routineColors.map((color) => <button type="button" key={color} className={props.routineColor === color ? 'selected' : ''} style={{ background: color }} onClick={() => props.onColor(color)} aria-label={`${color} 색상`} />)}</div></div><div className="form-actions"><button type="button" className="text-button" onClick={props.onAddClose}>취소</button><button type="submit" className="submit-button">루틴 추가</button></div></form> : <button className="add-task-button" onClick={props.onAddOpen}><Plus size={20} />새 루틴 만들기</button>}</section>
}

function SettingsView({ theme, categoryCount, onTheme, onCategories }: { theme: ThemeId; categoryCount: number; onTheme: (theme: ThemeId) => void; onCategories: () => void }) {
  return <section className="settings-view"><div className="settings-section-heading"><Palette size={19} /><div><h2>테마 버전</h2><p>선택한 테마는 이 브라우저에 자동으로 저장됩니다.</p></div></div><div className="theme-options">{themes.map((option) => { const Icon = option.icon; return <button key={option.id} className={`theme-option ${theme === option.id ? 'selected' : ''}`} onClick={() => onTheme(option.id)}><div className={`theme-preview preview-${option.id}`}><span /><span /><span /></div><div className="theme-copy"><Icon size={18} /><span><strong>{option.name}</strong><small>{option.description}</small></span></div><i>{theme === option.id && <Check size={13} strokeWidth={3} />}</i></button> })}</div><div className="settings-divider" /><div className="settings-section-heading"><Tag size={19} /><div><h2>할 일 카테고리</h2><p>목록의 이름과 표시 색상을 관리합니다.</p></div></div><button className="settings-link" onClick={onCategories}><span><i>{categoryCount}</i><strong>카테고리 관리</strong></span><ChevronRight size={18} /></button><div className="settings-divider" /><div className="settings-section-heading"><Database size={19} /><div><h2>데이터 저장</h2><p>현재는 이 기기의 브라우저에 안전하게 저장됩니다.</p></div></div><div className="storage-status"><span><i />로컬 저장 사용 중</span><small>Supabase 연결 준비 완료</small></div><div className="settings-divider" /><div className="settings-section-heading"><CalendarDays size={19} /><div><h2>캘린더 기준</h2><p>주간 화면은 월요일부터 시작합니다.</p></div></div><div className="setting-value"><span>주 시작 요일</span><strong>월요일</strong></div></section>
}

function CategoriesView({ categories, tasks, onBack, onCreate, onUpdate, onRemove }: { categories: Category[]; tasks: Task[]; onBack: () => void; onCreate: (name: string, color: string) => Promise<Category>; onUpdate: (id: string, name: string, color: string) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(categoryColors[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState(categoryColors[0])

  async function create(event: FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    await onCreate(name, newColor)
    setNewName('')
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setDraftName(category.name)
    setDraftColor(category.color)
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editingId || !draftName.trim()) return
    await onUpdate(editingId, draftName.trim(), draftColor)
    setEditingId(null)
  }

  return <section className="categories-view"><button className="back-button" onClick={onBack}><ArrowLeft size={17} />설정으로</button><div className="category-intro"><p>할 일을 목적에 맞게 나누고, 캘린더에서 한눈에 구분할 수 있습니다.</p><span>{categories.length}개 사용 중</span></div><form className="category-create" onSubmit={create}><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="새 카테고리 이름" maxLength={30} /><div className="category-color-picks">{categoryColors.map((color) => <button type="button" key={color} className={newColor === color ? 'selected' : ''} style={{ background: color }} onClick={() => setNewColor(color)} aria-label={`${color} 선택`} />)}</div><button type="submit" className="submit-button"><Plus size={15} />추가</button></form><div className="category-manager-list">{categories.map((category) => { const count = tasks.filter((task) => task.categoryId === category.id).length; if (editingId === category.id) return <form className="category-edit-row" key={category.id} onSubmit={saveEdit}><span className="category-swatch" style={{ background: draftColor }} /><input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={30} /><div className="category-color-picks compact">{categoryColors.map((color) => <button type="button" key={color} className={draftColor === color ? 'selected' : ''} style={{ background: color }} onClick={() => setDraftColor(color)} aria-label={`${color} 선택`} />)}</div><div className="category-row-actions"><button type="button" onClick={() => setEditingId(null)} aria-label="수정 취소"><X size={16} /></button><button type="submit" aria-label="수정 저장"><Check size={16} /></button></div></form>; return <div className="category-manager-row" key={category.id}><span className="category-swatch" style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{count ? `할 일 ${count}개에서 사용 중` : '사용 중인 할 일 없음'}</small></div><div className="category-row-actions"><button onClick={() => startEdit(category)} aria-label={`${category.name} 수정`}><Pencil size={15} /></button><button disabled={count > 0} title={count > 0 ? '사용 중인 카테고리는 삭제할 수 없습니다.' : '카테고리 삭제'} onClick={() => onRemove(category.id)} aria-label={`${category.name} 삭제`}><Trash2 size={15} /></button></div></div> })}</div></section>
}

function ContextPanel({ categories, view, selected, selectedDate, selectedTasks, tasks, routines, theme, week, onSelectDate, onOpenDate }: { categories: Category[]; view: ViewId; selected: Date; selectedDate: string; selectedTasks: Task[]; tasks: Task[]; routines: Routine[]; theme: ThemeId; week: Date[]; onSelectDate: (date: string) => void; onOpenDate: () => void }) {
  if (view === 'calendar') return <aside className="context-panel calendar-context"><span className="context-label">선택한 날짜</span><h2>{selected.getMonth() + 1}월 {selected.getDate()}일</h2><p>{weekdays[selected.getDay()]}요일 · {selectedTasks.length}개의 할 일</p><div className="context-task-list">{selectedTasks.map((task) => <div key={task.id}><i style={{ background: categories.find((item) => item.id === task.categoryId)?.color }} /><span className={task.completed ? 'done' : ''}>{task.title}</span></div>)}{!selectedTasks.length && <small>등록된 할 일이 없습니다.</small>}</div><button className="context-action" onClick={onOpenDate}>이 날짜 열기</button></aside>
  if (view === 'routines') return <aside className="context-panel routine-context"><span className="context-label">이번 주</span><h2>루틴 흐름</h2><p>요일마다 반복되는 습관을 확인하세요.</p><div className="week-routine-chart">{week.map((date) => { const key = toDateKey(date); const scheduled = routines.filter((routine) => routine.days.includes(date.getDay())); const done = scheduled.filter((routine) => routine.completedDates.includes(key)).length; const ratio = scheduled.length ? done / scheduled.length : 0; return <div key={key}><span><i style={{ height: `${18 + ratio * 62}px` }} /></span><small>{weekdays[date.getDay()]}</small><b>{done}/{scheduled.length}</b></div> })}</div><div className="routine-tip"><Repeat2 size={17} /><span>완벽한 연속 기록보다<br />다시 시작하는 힘이 중요해요.</span></div></aside>
  if (view === 'settings') { const current = themes.find((item) => item.id === theme) ?? themes[0]; return <aside className="context-panel settings-context"><span className="context-label">현재 테마</span><h2>{current.name}</h2><p>{current.description}</p><div className={`large-theme-preview preview-${theme}`}><span /><span /><span /><i /></div><small>테마는 화면 구성은 유지하면서 색상, 표면과 모서리의 인상을 바꿉니다.</small></aside> }
  if (view === 'categories') return <aside className="context-panel categories-context"><span className="context-label">카테고리 관리</span><h2>색으로 구분하기</h2><p>카테고리 변경사항은 오늘 화면과 캘린더에 즉시 반영됩니다.</p><div className="category-legend">{categories.map((category) => <div key={category.id}><i style={{ background: category.color }} /><span>{category.name}</span><small>{tasks.filter((task) => task.categoryId === category.id).length}</small></div>)}</div><div className="routine-tip"><Tag size={17} /><span>할 일이 연결된 카테고리는<br />이름과 색상만 수정할 수 있어요.</span></div></aside>
  return <aside className="context-panel"><div className="month-heading"><button onClick={() => onSelectDate(toDateKey(new Date(selected.getFullYear(), selected.getMonth() - 1, 1)))} aria-label="이전 달"><ChevronLeft size={18} /></button><strong>{selected.getFullYear()}년 {monthNames[selected.getMonth()]}</strong><button onClick={() => onSelectDate(toDateKey(new Date(selected.getFullYear(), selected.getMonth() + 1, 1)))} aria-label="다음 달"><ChevronRight size={18} /></button></div><MiniCalendar date={selected} selectedDate={selectedDate} tasks={tasks} onSelect={onSelectDate} /><div className="day-note"><span className="note-label">오늘의 한마디</span><blockquote>“모든 일을 끝내지 않아도<br />충분히 좋은 하루예요.”</blockquote></div></aside>
}

function MiniCalendar({ date, selectedDate, tasks, onSelect }: { date: Date; selectedDate: string; tasks: Task[]; onSelect: (date: string) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() + lastDay }, (_, index) => index < first.getDay() ? null : index - first.getDay() + 1)
  while (cells.length % 7) cells.push(null)
  const taskDates = new Set(tasks.map((task) => task.date))
  return <div className="mini-calendar"><div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => { if (!day) return <span key={`blank-${index}`} />; const key = toDateKey(new Date(date.getFullYear(), date.getMonth(), day)); return <button key={key} className={`${key === selectedDate ? 'selected' : ''} ${key === todayKey ? 'today' : ''}`} onClick={() => onSelect(key)}>{day}<i className={taskDates.has(key) ? 'has-task' : ''} /></button> })}</div></div>
}

export default App
