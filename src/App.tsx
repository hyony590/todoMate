import { useEffect, useState, type FormEvent, type CSSProperties } from 'react'
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Database, Layers3, Moon, Palette, Pencil, Plus, Settings, Sun, Tag, Trash2 } from 'lucide-react'
import { categories as defaults, seedTasks } from './data/seed'
import { LocalTaskRepository } from './data/taskRepository'
import { LocalCategoryRepository } from './data/categoryRepository'
import type { Category, Task, ThemeId } from './types'
import AuthGate from './AuthGate'
import { supabase } from './data/supabase'
import { SupabaseTaskRepository, SupabaseCategoryRepository } from './data/cloudRepository'

const taskRepository = supabase ? new SupabaseTaskRepository() : new LocalTaskRepository(seedTasks)
const categoryRepository = supabase ? new SupabaseCategoryRepository() : new LocalCategoryRepository()
const dayNames = ['일', '월', '화', '수', '목', '금', '토']
const colors = ['#3d8b67', '#e06445', '#5276b8', '#b48738', '#8a63a8', '#555b63']
const themes = [
  { id: 'sharp' as const, name: 'Sharp', description: '선명한 대비와 단단한 모서리', icon: Layers3 },
  { id: 'soft' as const, name: 'Soft', description: '따뜻한 색감과 부드러운 표면', icon: Sun },
  { id: 'midnight' as const, name: 'Midnight', description: '눈이 편안한 어두운 작업 공간', icon: Moon },
]
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function parseDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function App() {
  return <AuthGate><Planner /></AuthGate>
}

function Planner() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  async function attempt<T,>(operation: () => Promise<T>): Promise<T | undefined> {
    try { setError(''); return await operation() }
    catch (cause) { setError(cause instanceof Error ? cause.message : String((cause as { message?: string })?.message ?? '저장 요청에 실패했습니다.')); return undefined }
  }
  async function loadData() {
    setLoading(true)
    await attempt(async () => {
      const [t, c] = await Promise.all([taskRepository.list(), categoryRepository.list()])
      setTasks(t); setCategories(c)
    })
    setLoading(false)
  }
  const [view, setView] = useState<'calendar' | 'settings' | 'categories'>('calendar')
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('haru.theme')
    return themes.some(item => item.id === saved) ? saved as ThemeId : 'sharp'
  })
  const [weekStart, setWeekStart] = useState(() => localStorage.getItem('haru.weekStart') === '0' ? 0 : 1)
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showReset, setShowReset] = useState(false)
  useEffect(() => {
    void loadData()
  }, [])
  useEffect(() => { localStorage.setItem('haru.theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('haru.weekStart', String(weekStart)) }, [weekStart])

  async function addTask(title: string, categoryId: string) {
    const task = await attempt(() => taskRepository.create({ title, categoryId, date: selectedDate }))
    if (!task) throw new Error('할 일을 저장하지 못했습니다.')
    setTasks(current => [...current, task])
  }
  async function toggleTask(id: string) {
    const changed = await attempt(() => taskRepository.toggle(id))
    if (!changed) return
    setTasks(current => current.map(task => task.id === id ? changed : task))
  }
  async function removeTask(id: string) {
    const success = await attempt(async () => { await taskRepository.remove(id); return true })
    if (!success) return
    setTasks(current => current.filter(task => task.id !== id))
  }
  async function createCategory(name: string, color: string) {
    const category = await attempt(() => categoryRepository.create({ name, color }))
    if (!category) throw new Error('카테고리를 저장하지 못했습니다.')
    setCategories(current => [...current, category])
  }
  async function updateCategory(id: string, name: string, color: string) {
    const changed = await attempt(() => categoryRepository.update(id, { name, color }))
    if (!changed) throw new Error('카테고리를 저장하지 못했습니다.')
    setCategories(current => current.map(category => category.id === id ? changed : category))
  }
  async function removeCategory(id: string) {
    if (tasks.some(task => task.categoryId === id)) return
    const success = await attempt(async () => { await categoryRepository.remove(id); return true })
    if (!success) return
    setCategories(current => current.filter(category => category.id !== id))
  }
  async function resetData() {
    setResetting(true)
    if (supabase) {
      const success = await attempt(async () => {
        const { error: resetError } = await supabase!.rpc('reset_haru_data')
        if (resetError) throw resetError
        return true
      })
      setResetting(false)
      if (!success) { setShowReset(false); return }
      setTasks([]); await loadData(); setTheme('sharp'); setWeekStart(1); setShowReset(false)
      return
    }
    // 앱 소유 키만 초기화합니다. 다른 사이트/앱의 localStorage는 건드리지 않습니다.
    localStorage.setItem('haru.tasks.v1', '[]')
    localStorage.setItem('haru.categories.v1', JSON.stringify(defaults))
    localStorage.removeItem('haru.routines.v1')
    setTasks([]); setCategories(defaults); setTheme('sharp'); setWeekStart(1)
    setShowReset(false)
    setResetting(false)
  }
  const selected = parseDate(selectedDate)
  const title = view === 'calendar' ? '캘린더' : view === 'settings' ? '설정' : '카테고리'
  return <div className={`app-shell unified-shell ${view !== 'calendar' ? 'without-inspector' : ''}`} data-theme={theme}>
    <aside className="sidebar">
      <div className="brand-mark"><span className="brand-symbol">ㅎ</span><span>하루</span></div>
      <nav className="side-nav" aria-label="주요 메뉴"><button className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}><CalendarDays size={19} />캘린더</button></nav>
      <div className="sidebar-bottom"><div className="profile-button profile-row"><span className="avatar">나</span><span><strong>나의 하루</strong><small>개인 공간</small></span><button className="profile-settings" aria-label="설정 열기" onClick={() => setView('settings')}><Settings size={18} /></button></div></div>
    </aside>
    <main className={`workspace view-${view}`}>
      <header className="topbar"><div><p className="eyebrow">{view === 'calendar' ? 'MONTHLY PLANNER' : 'PREFERENCES'}</p><h1>{title}</h1></div><button className="profile-mobile" aria-label="설정 열기" onClick={() => setView('settings')}><Settings size={23} /></button></header>
      <div className="view-stage" key={view}>
        {loading && <p role="status">데이터 불러오는 중…</p>}
        {error && <div className="data-error" role="alert"><p>{error}</p><p>Supabase 테이블과 RLS 정책이 준비되어 있는지 확인해주세요.</p><button className="text-button" onClick={() => void loadData()}>다시 불러오기</button></div>}
        {view === 'calendar' && <Calendar date={selected} selectedDate={selectedDate} tasks={tasks} categories={categories} weekStart={weekStart} onSelect={setSelectedDate} />}
        {view === 'settings' && <section className="settings-view">
          <button className="back-button" onClick={() => setView('calendar')}><ArrowLeft size={17} />캘린더로</button>
          <div className="settings-section-heading settings-first"><Palette size={19} /><div><h2>테마 버전</h2><p>선택한 테마는 자동으로 저장됩니다.</p></div></div>
          <div className="theme-options">{themes.map(option => { const Icon = option.icon; return <button key={option.id} className={`theme-option ${theme === option.id ? 'selected' : ''}`} onClick={() => setTheme(option.id)}><div className={`theme-preview preview-${option.id}`}><span /><span /><span /></div><div className="theme-copy"><Icon size={18} /><span><strong>{option.name}</strong><small>{option.description}</small></span></div><i>{theme === option.id && <Check size={13} />}</i></button> })}</div>
          <div className="settings-divider" /><div className="settings-section-heading"><Tag size={19} /><div><h2>할 일 카테고리</h2><p>이름과 표시 색상을 관리합니다.</p></div></div><button className="settings-link" onClick={() => setView('categories')}><span><i>{categories.length}</i><strong>카테고리 관리</strong></span><ChevronRight size={18} /></button>
          <div className="settings-divider" /><div className="settings-section-heading"><CalendarDays size={19} /><div><h2>캘린더 기준</h2><p>달력의 첫 번째 요일을 선택하세요.</p></div></div><div className="setting-value"><span>주 시작 요일</span><select aria-label="주 시작 요일" value={weekStart} onChange={event => setWeekStart(Number(event.target.value))}><option value={1}>월요일</option><option value={0}>일요일</option></select></div>
          <div className="settings-divider" /><div className="settings-section-heading"><Database size={19} /><div><h2>데이터 저장</h2><p>{supabase ? '할 일과 카테고리는 Supabase에 저장됩니다. 테마·주 시작 요일은 이 브라우저에 저장됩니다.' : '이 브라우저에 저장된 데이터를 관리합니다.'}</p></div></div><div className="storage-status"><span><i />{supabase ? 'Supabase 저장 사용 중' : '로컬 저장 사용 중'}</span><button className="danger-button" onClick={() => setShowReset(true)}><Trash2 size={14} />저장 데이터 삭제</button></div>
          {supabase && <button className="back-button" onClick={() => void attempt(async () => { const { error } = await supabase!.auth.signOut(); if (error) throw error })}>로그아웃</button>}
        </section>}
        {view === 'categories' && <Categories categories={categories} tasks={tasks} onBack={() => setView('settings')} onCreate={createCategory} onUpdate={updateCategory} onRemove={removeCategory} />}
      </div>
    </main>
    {view === 'calendar' && <TaskPanel date={selected} tasks={tasks.filter(task => task.date === selectedDate)} categories={categories} onAdd={addTask} onToggle={toggleTask} onRemove={removeTask} onCategories={() => setView('categories')} />}
    {showReset && <div className="modal-backdrop"><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">저장 데이터를 삭제할까요?</h2><p>{supabase ? '현재 계정의 Supabase 할 일과 카테고리를 삭제하고 기본 카테고리를 생성합니다. 모든 기기에 반영되며 복구할 수 없습니다. 기존 로컬 데이터는 유지됩니다.' : '이 브라우저의 모든 할 일과 이전 루틴 기록을 삭제하고 카테고리를 기본값으로 되돌립니다. 복구할 수 없습니다.'} 테마·캘린더 설정도 기본값으로 되돌립니다.</p><div className="form-actions"><button disabled={resetting} className="text-button" onClick={() => setShowReset(false)}>취소</button><button disabled={resetting} className="danger-button solid" onClick={() => void resetData()}>{resetting ? '초기화 중…' : '삭제하고 초기화'}</button></div></section></div>}
  </div>
}

function Calendar({ date, selectedDate, tasks, categories, weekStart, onSelect }: { date: Date; selectedDate: string; tasks: Task[]; categories: Category[]; weekStart: number; onSelect: (key: string) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const offset = (first.getDay() - weekStart + 7) % 7
  const length = Math.ceil((offset + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7) * 7
  const cells = Array.from({ length }, (_, index) => new Date(date.getFullYear(), date.getMonth(), 1 - offset + index))
  const weekdays = Array.from({ length: 7 }, (_, index) => dayNames[(weekStart + index) % 7])
  const today = dateKey(new Date())
  return <section className="calendar-view"><div className="calendar-toolbar"><div><strong>{date.getFullYear()}년 {date.getMonth() + 1}월</strong><span>날짜를 선택해 할 일을 관리하세요.</span></div><div className="toolbar-actions"><button onClick={() => onSelect(today)}>오늘</button><button aria-label="이전 달" onClick={() => onSelect(dateKey(new Date(date.getFullYear(), date.getMonth() - 1, 1)))}><ChevronLeft size={18} /></button><button aria-label="다음 달" onClick={() => onSelect(dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)))}><ChevronRight size={18} /></button></div></div><div className="full-calendar"><div className="full-calendar-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div><div className="full-calendar-grid">{cells.map(cell => { const key = dateKey(cell); const items = tasks.filter(task => task.date === key); return <button key={key} aria-label={`${cell.getMonth() + 1}월 ${cell.getDate()}일`} className={`${cell.getMonth() !== date.getMonth() ? 'outside' : ''} ${key === selectedDate ? 'selected' : ''} ${key === today ? 'today' : ''}`} onClick={() => onSelect(key)}><span className="date-number">{cell.getDate()}</span><span className="calendar-task-stack">{items.slice(0, 3).map(task => <i className={task.completed ? 'event-completed' : ''} key={task.id} style={{ '--event-color': categories.find(category => category.id === task.categoryId)?.color ?? '#888' } as CSSProperties}>{task.title}</i>)}{items.length > 3 && <small>+{items.length - 3}</small>}</span></button> })}</div></div></section>
}

function TaskPanel({ date, tasks, categories, onAdd, onToggle, onRemove, onCategories }: { date: Date; tasks: Task[]; categories: Category[]; onAdd: (title: string, categoryId: string) => Promise<void>; onToggle: (id: string) => void; onRemove: (id: string) => void; onCategories: () => void }) {
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('work')
  const [adding, setAdding] = useState(false)
  const activeCategory = categories.some(category => category.id === categoryId) ? categoryId : categories[0]?.id ?? ''
  async function submit(event: FormEvent) { event.preventDefault(); if (!title.trim() || !activeCategory) return; try { await onAdd(title.trim(), activeCategory); setTitle(''); setAdding(false) } catch { /* 상위 오류 안내를 표시하고 입력을 유지합니다. */ } }
  return <aside className="context-panel task-inspector"><span className="context-label">선택한 날짜</span><h2>{date.getMonth() + 1}월 {date.getDate()}일</h2><p>{dayNames[date.getDay()]}요일 · {tasks.filter(task => task.completed).length}/{tasks.length} 완료</p><div className="inspector-groups">{categories.map(category => { const items = tasks.filter(task => task.categoryId === category.id); if (!items.length) return null; return <section className="task-group" key={category.id}><div className="group-title"><span className="color-dot" style={{ background: category.color }} /><h3>{category.name}</h3><span>{items.filter(task => task.completed).length}/{items.length}</span></div>{items.map(task => <div key={task.id} className={`task-row ${task.completed ? 'completed' : ''}`}><button className="check-button" aria-label={`${task.title} ${task.completed ? '완료 취소' : '완료'}`} aria-pressed={task.completed} style={{ '--task-color': category.color } as CSSProperties} onClick={() => onToggle(task.id)}>{task.completed && <Check size={14} strokeWidth={3} />}</button><span className="task-title">{task.title}</span><button className="delete-button" aria-label={`${task.title} 삭제`} onClick={() => onRemove(task.id)}><Trash2 size={14} /></button></div>)}</section> })}</div>{!tasks.length && <div className="empty-state"><strong>등록된 할 일이 없어요</strong><p>선택한 날짜에 할 일을 추가하세요.</p></div>}{!categories.length ? <button className="add-task-button" onClick={onCategories}>카테고리 먼저 만들기</button> : adding ? <form className="add-form" onSubmit={submit}><input autoFocus placeholder="무엇을 할까요?" value={title} onChange={event => setTitle(event.target.value)} maxLength={80} /><div className="category-picks">{categories.map(category => <button key={category.id} type="button" className={activeCategory === category.id ? 'selected' : ''} onClick={() => setCategoryId(category.id)}><span style={{ background: category.color }} />{category.name}</button>)}</div><div className="form-actions"><button type="button" className="text-button" onClick={() => setAdding(false)}>취소</button><button className="submit-button">추가</button></div></form> : <button className="add-task-button" onClick={() => setAdding(true)}><Plus size={18} />할 일 추가</button>}</aside>
}

function Categories({ categories, tasks, onBack, onCreate, onUpdate, onRemove }: { categories: Category[]; tasks: Task[]; onBack: () => void; onCreate: (name: string, color: string) => Promise<void>; onUpdate: (id: string, name: string, color: string) => Promise<void>; onRemove: (id: string) => void }) {
  const [name, setName] = useState(''); const [color, setColor] = useState(colors[0]); const [editing, setEditing] = useState<string | null>(null)
  async function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; try { if (editing) await onUpdate(editing, name.trim(), color); else await onCreate(name.trim(), color); setName(''); setEditing(null) } catch { /* 저장 실패 시 입력을 유지합니다. */ } }
  return <section className="categories-view"><button className="back-button" onClick={onBack}><ArrowLeft size={17} />설정으로</button><div className="category-intro"><p>카테고리 이름과 색상은 캘린더와 할 일 목록에 바로 반영됩니다.</p><span>{categories.length}개 사용 중</span></div><form className="category-create" onSubmit={submit}><input placeholder={editing ? '카테고리 이름 수정' : '새 카테고리 이름'} value={name} onChange={event => setName(event.target.value)} maxLength={30} /><div className="category-color-picks">{colors.map(item => <button type="button" key={item} aria-label={`${item} 선택`} className={color === item ? 'selected' : ''} style={{ background: item }} onClick={() => setColor(item)} />)}</div><button className="submit-button">{editing ? '저장' : '추가'}</button>{editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setName('') }}>취소</button>}</form><div className="category-manager-list">{categories.map(category => { const count = tasks.filter(task => task.categoryId === category.id).length; return <div className="category-manager-row" key={category.id}><span className="category-swatch" style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{count ? `할 일 ${count}개에서 사용 중` : '사용 중인 할 일 없음'}</small></div><div className="category-row-actions"><button aria-label={`${category.name} 수정`} onClick={() => { setEditing(category.id); setName(category.name); setColor(category.color) }}><Pencil size={15} /></button><button aria-label={`${category.name} 삭제`} disabled={count > 0} title={count ? '할 일이 연결되어 삭제할 수 없습니다.' : '삭제'} onClick={() => onRemove(category.id)}><Trash2 size={15} /></button></div></div> })}</div></section>
}
