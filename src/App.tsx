import { useEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react'
import { Home, Repeat2, ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, UserRound, Layers3, Moon, Palette, Pencil, Plus, Settings, Sun, Tag, Trash2 } from 'lucide-react'
import { categories as defaults, seedTasks } from './data/seed'
import { LocalTaskRepository } from './data/taskRepository'
import { LocalCategoryRepository } from './data/categoryRepository'
import type { Category, Task, ThemeId } from './types'
import Habits from './Habits'
import AuthGate from './AuthGate'
import { supabase } from './data/supabase'
import { SupabaseTaskRepository, SupabaseCategoryRepository } from './data/cloudRepository'
import { summarizeCategories, readableText } from './data/categorySummary'

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
  const [view, setView] = useState<'calendar' | 'habits' | 'settings' | 'categories'>('calendar')
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('haru.theme')
    return themes.some(item => item.id === saved) ? saved as ThemeId : 'sharp'
  })
  const [weekStart, setWeekStart] = useState(() => localStorage.getItem('haru.weekStart') === '0' ? 0 : 1)
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editingTask, setEditingTask] = useState(false)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)
  const [deletingCategory, setDeletingCategory] = useState(false)
  function navigate(next: typeof view) { if (editingTask) { setError('수정 중인 할 일을 먼저 저장하거나 취소해주세요.'); return } setView(next); setShowProfile(false) }
  function selectDate(key: string) { if (editingTask) { setError('수정 중인 할 일을 먼저 저장하거나 취소해주세요.'); return } setSelectedDate(key) }
  async function updateTask(id: string, title: string) {
    const changed = await attempt(() => taskRepository.update(id, title))
    if (!changed) throw new Error('수정 내용을 저장하지 못했습니다.')
    setTasks(current => current.map(task => task.id === id ? changed : task))
  }
  const [showReset, setShowReset] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [profileEmail, setProfileEmail] = useState('')
  useEffect(() => { if (supabase) void supabase.auth.getUser().then(({ data }) => setProfileEmail(data.user?.email ?? '')) }, [])
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
    if (!success) throw new Error('삭제하지 못했습니다.')
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
    if (deletingCategory) return
    setDeletingCategory(true)
    const success = await attempt(async () => { await categoryRepository.remove(id); return true })
    setDeletingCategory(false)
    if (!success) return
    setTasks(current => current.filter(task => task.categoryId !== id))
    setCategories(current => current.filter(category => category.id !== id)); setPendingCategory(null)
  }
  function requestCategoryRemoval(id: string) {
    if (tasks.some(task => task.categoryId === id && !task.completed)) setPendingCategory(id)
    else void removeCategory(id)
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
    localStorage.removeItem('haru.habits.v1'); localStorage.removeItem('haru.habitCompletions.v1')
    setTasks([]); setCategories(defaults); setTheme('sharp'); setWeekStart(1)
    setShowReset(false)
    setResetting(false)
  }
  const selected = parseDate(selectedDate)
  const title = view === 'calendar' ? '캘린더' : view === 'habits' ? '습관' : view === 'settings' ? '설정' : '카테고리'
  return <div className={`app-shell unified-shell ${view !== 'calendar' ? 'without-inspector' : ''}`} data-theme={theme}>
    <nav className="workspace-nav" aria-label="사용자 메뉴">
      <button aria-pressed={view === 'calendar'} onClick={() => navigate('calendar')}><Home size={18} /><span>홈</span></button>
      <button aria-pressed={view === 'habits'} onClick={() => navigate('habits')}><Repeat2 size={18} /><span>습관</span></button>
      <button aria-label="설정 열기" aria-pressed={view === 'settings'} onClick={() => { navigate('settings') }}><Settings size={18} /><span>설정</span></button>
      <button aria-label="프로필 열기" aria-expanded={showProfile} onClick={() => setShowProfile(current => !current)}><UserRound size={18} /><span>프로필</span></button>
      {showProfile && <section className="profile-popover" aria-label="내 프로필"><strong>나의 하루</strong><p>{profileEmail || '개인 공간'}</p><button onClick={() => { navigate('calendar') }}>캘린더로</button></section>}
    </nav>
    <main className={`workspace view-${view}`}>
      <header className="topbar"><div><p className="eyebrow">{view === 'calendar' ? 'MONTHLY PLANNER' : 'PREFERENCES'}</p><h1>{title}</h1></div></header>
      <div className="view-stage" key={view}>
        {loading && <p role="status">데이터 불러오는 중…</p>}
        {error && <div className="data-error" role="alert"><p>{error}</p><p>Supabase 테이블과 RLS 정책이 준비되어 있는지 확인해주세요.</p><button className="text-button" onClick={() => void loadData()}>다시 불러오기</button></div>}
        {view === 'calendar' && <Calendar date={selected} selectedDate={selectedDate} tasks={tasks} categories={categories} weekStart={weekStart} onSelect={selectDate} />}
        {view === 'habits' && <Habits />}
        {view === 'settings' && <section className="settings-view">
          <button className="back-button" onClick={() => setView('calendar')}><ArrowLeft size={17} />캘린더로</button>
          <div className="settings-section-heading settings-first"><Palette size={19} /><div><h2>테마 버전</h2><p>선택한 테마는 자동으로 저장됩니다.</p></div></div>
          <div className="theme-options">{themes.map(option => { const Icon = option.icon; return <button key={option.id} className={`theme-option ${theme === option.id ? 'selected' : ''}`} onClick={() => setTheme(option.id)}><div className={`theme-preview preview-${option.id}`}><span /><span /><span /></div><div className="theme-copy"><Icon size={18} /><span><strong>{option.name}</strong><small>{option.description}</small></span></div><i>{theme === option.id && <Check size={13} />}</i></button> })}</div>
          <div className="settings-divider" /><div className="settings-section-heading"><Tag size={19} /><div><h2>할 일 카테고리</h2><p>이름과 표시 색상을 관리합니다.</p></div></div><button className="settings-link" onClick={() => setView('categories')}><span><i>{categories.length}</i><strong>카테고리 관리</strong></span><ChevronRight size={18} /></button>
          <div className="settings-divider" /><div className="settings-section-heading"><CalendarDays size={19} /><div><h2>캘린더 기준</h2><p>달력의 첫 번째 요일을 선택하세요.</p></div></div><div className="setting-value"><span>주 시작 요일</span><select aria-label="주 시작 요일" value={weekStart} onChange={event => setWeekStart(Number(event.target.value))}><option value={1}>월요일</option><option value={0}>일요일</option></select></div>
          <div className="settings-bottom-actions">
            {supabase && <button className="logout-button" onClick={() => void attempt(async () => { const { error } = await supabase!.auth.signOut(); if (error) throw error })}>로그아웃</button>}
            <button className="danger-button" onClick={() => setShowReset(true)}><Trash2 size={14} />저장 데이터 삭제</button>
          </div>
        </section>}
        {view === 'categories' && <Categories categories={categories} tasks={tasks} onBack={() => setView('settings')} onCreate={createCategory} onUpdate={updateCategory} onRemove={requestCategoryRemoval} />}
      </div>
    </main>
    {view === 'calendar' && <TaskPanel date={selected} tasks={tasks.filter(task => task.date === selectedDate)} categories={categories} onAdd={addTask} onToggle={toggleTask} onRemove={removeTask} onCategories={() => navigate('categories')} onUpdate={updateTask} onEditing={setEditingTask} />}
    {pendingCategory && <div className="modal-backdrop"><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="category-delete-title"><h2 id="category-delete-title">카테고리를 삭제할까요?</h2><p>이 카테고리에 미완료 할 일이 있습니다. 연결된 모든 할 일도 함께 삭제되며 복구할 수 없습니다.</p><div className="form-actions"><button className="text-button" disabled={deletingCategory} onClick={() => setPendingCategory(null)}>취소</button><button className="danger-button solid" disabled={deletingCategory} onClick={() => void removeCategory(pendingCategory)}>{deletingCategory ? '삭제 중…' : '삭제'}</button></div></section></div>}
    {showReset && <div className="modal-backdrop"><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">저장 데이터를 삭제할까요?</h2><p>{supabase ? '현재 계정의 Supabase 할 일, 습관 기록과 카테고리를 삭제하고 기본 카테고리를 생성합니다. 모든 기기에 반영되며 복구할 수 없습니다. 기존 로컬 데이터는 유지됩니다.' : '이 브라우저의 모든 할 일, 습관과 이전 루틴 기록을 삭제하고 카테고리를 기본값으로 되돌립니다. 복구할 수 없습니다.'} 테마·캘린더 설정도 기본값으로 되돌립니다.</p><div className="form-actions"><button disabled={resetting} className="text-button" onClick={() => setShowReset(false)}>취소</button><button disabled={resetting} className="danger-button solid" onClick={() => void resetData()}>{resetting ? '초기화 중…' : '삭제하고 초기화'}</button></div></section></div>}
  </div>
}

function Calendar({ date, selectedDate, tasks, categories, weekStart, onSelect }: { date: Date; selectedDate: string; tasks: Task[]; categories: Category[]; weekStart: number; onSelect: (key: string) => void }) {
  const calendarRef = useRef<HTMLDivElement>(null)
  const moveRef = useRef(onSelect); moveRef.current = onSelect
  const monthRef = useRef(date); monthRef.current = date
  useEffect(() => {
    const element = calendarRef.current
    if (!element) return
    let total = 0, last = 0, locked = false, changedAt = 0
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      const now = Date.now()
      if (now - last > 240 && now - changedAt > 550) { total = 0; locked = false }
      last = now
      if (locked) return
      total += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1)
      if (Math.abs(total) < 60) return
      locked = true; changedAt = now
      const current = monthRef.current
      moveRef.current(dateKey(new Date(current.getFullYear(), current.getMonth() + (total > 0 ? 1 : -1), 1)))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const offset = (first.getDay() - weekStart + 7) % 7
  const length = Math.ceil((offset + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7) * 7
  const cells = Array.from({ length }, (_, index) => new Date(date.getFullYear(), date.getMonth(), 1 - offset + index))
  const weekdays = Array.from({ length: 7 }, (_, index) => dayNames[(weekStart + index) % 7])
  const today = dateKey(new Date())
  return <section className="calendar-view"><div className="calendar-toolbar"><div><strong>{date.getFullYear()}년 {date.getMonth() + 1}월</strong><span>날짜를 선택해 할 일을 관리하세요.</span></div><div className="toolbar-actions"><button onClick={() => onSelect(today)}>오늘</button><button aria-label="이전 달" onClick={() => onSelect(dateKey(new Date(date.getFullYear(), date.getMonth() - 1, 1)))}><ChevronLeft size={18} /></button><button aria-label="다음 달" onClick={() => onSelect(dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)))}><ChevronRight size={18} /></button></div></div><div className="full-calendar" ref={calendarRef}><div className="full-calendar-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div><div className="full-calendar-grid">{cells.map(cell => { const key = dateKey(cell); const items = tasks.filter(task => task.date === key); const summaries = summarizeCategories(items, categories); return <button key={key} aria-label={`${cell.getMonth() + 1}월 ${cell.getDate()}일`} className={`${cell.getMonth() !== date.getMonth() ? 'outside' : ''} ${key === selectedDate ? 'selected' : ''} ${key === today ? 'today' : ''}`} onClick={() => onSelect(key)}><span className="date-number">{cell.getDate()}</span><span className="calendar-category-stack">{summaries.slice(0, 3).map(summary => <span key={summary.id} className={`calendar-category ${summary.remaining === 0 ? 'all-completed' : ''}`} style={{ backgroundColor: summary.color, color: readableText(summary.color) }} title={`${summary.name} · ${summary.remaining ? summary.remaining + '개 미완료' : '모두 완료'}`}><span>{summary.name}</span>{summary.remaining > 0 && <b>{summary.remaining}</b>}</span>)}{summaries.length > 3 && <small className="calendar-overflow">+{summaries.length - 3}개</small>}</span></button> })}</div></div></section>
}

function TaskPanel({ date, tasks, categories, onAdd, onToggle, onRemove, onCategories, onUpdate, onEditing }: { date: Date; tasks: Task[]; categories: Category[]; onAdd: (title: string, categoryId: string) => Promise<void>; onToggle: (id: string) => void; onRemove: (id: string) => Promise<void>; onCategories: () => void; onUpdate: (id: string, title: string) => Promise<void>; onEditing: (editing: boolean) => void }) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  function finishEdit() { setEditId(null); onEditing(false) }
  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editId || !draft.trim() || saving) return
    setSaving(true)
    try { await onUpdate(editId, draft.trim()); finishEdit() } catch { /* Keep unsaved input. */ }
    finally { setSaving(false) }
  }
  async function deleteTask(id: string) {
    try { await onRemove(id); if (editId === id) finishEdit() } catch { /* Parent displays the error. */ }
  }
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('work')
  const [adding, setAdding] = useState(false)
  const [quickCategory, setQuickCategory] = useState<string | null>(null)
  const activeCategory = categories.some(category => category.id === categoryId) ? categoryId : categories[0]?.id ?? ''
  async function submit(event: FormEvent) { event.preventDefault(); if (!title.trim() || !activeCategory || busy) return; setBusy(true); try { await onAdd(title.trim(), activeCategory); setTitle(''); setAdding(false) } catch { /* 상위 오류 안내를 표시하고 입력을 유지합니다. */ } finally { setBusy(false) } }
  const addForm = <form className="add-form" onSubmit={submit}><input autoFocus placeholder="무엇을 할까요?" value={title} onChange={event => setTitle(event.target.value)} maxLength={80} />{!quickCategory && <div className="category-picks">{categories.map(category => <button key={category.id} type="button" className={activeCategory === category.id ? 'selected' : ''} onClick={() => setCategoryId(category.id)}><span style={{ background: category.color }} />{category.name}</button>)}</div>}<div className="form-actions"><button type="button" className="text-button" onClick={() => setAdding(false)}>취소</button><button disabled={busy} className="submit-button">{busy ? '저장 중…' : '추가'}</button></div></form>
  return <aside className="context-panel task-inspector"><h2>{date.getMonth() + 1}월 {date.getDate()}일</h2><p>{dayNames[date.getDay()]}요일</p><div className="inspector-groups">{categories.map(category => { const items = tasks.filter(task => task.categoryId === category.id); return <section className="task-group" key={category.id}><div className="group-title"><span className="color-dot" style={{ background: category.color }} /><h3>{category.name}</h3><button className="category-quick-add" aria-label={`${category.name} 할 일 추가`} onClick={() => { setCategoryId(category.id); setQuickCategory(category.id); setAdding(true) }}><Plus size={16} /></button></div>{items.map(task => <div key={task.id} className={`task-row ${task.completed ? 'completed' : ''}`}><button className="check-button" aria-label={`${task.title} ${task.completed ? '완료 취소' : '완료'}`} aria-pressed={task.completed} style={{ '--task-color': category.color } as CSSProperties} onClick={() => onToggle(task.id)}>{task.completed && <Check size={14} strokeWidth={3} />}</button><div className="task-text-area">{editId === task.id ? <form className="task-edit-form" onSubmit={saveEdit}><input autoFocus aria-label="할 일 내용 수정" value={draft} maxLength={80} onChange={event => setDraft(event.target.value)} disabled={saving} /><div><button disabled={saving || !draft.trim()} className="submit-button">저장</button><button type="button" disabled={saving} className="text-button" onClick={finishEdit}>취소</button></div></form> : <button className="task-title" disabled={!!editId} onClick={() => { setEditId(task.id); setDraft(task.title); onEditing(true) }}>{task.title}</button>}</div><button className="delete-button" aria-label={`${task.title} 삭제`} disabled={saving} onClick={() => void deleteTask(task.id)}><Trash2 size={14} /></button></div>)}{adding && quickCategory === category.id && addForm}</section> })}</div>{!tasks.length && <div className="empty-state"><strong>등록된 할 일이 없어요</strong><p>선택한 날짜에 할 일을 추가하세요.</p></div>}{!categories.length ? <button className="add-task-button" onClick={onCategories}>카테고리 먼저 만들기</button> : adding && !quickCategory ? addForm : <button className="add-task-button" onClick={() => { setQuickCategory(null); setAdding(true) }}><Plus size={18} />할 일 추가</button>}</aside>
}

function Categories({ categories, tasks, onBack, onCreate, onUpdate, onRemove }: { categories: Category[]; tasks: Task[]; onBack: () => void; onCreate: (name: string, color: string) => Promise<void>; onUpdate: (id: string, name: string, color: string) => Promise<void>; onRemove: (id: string) => void }) {
  const [name, setName] = useState(''); const [color, setColor] = useState(colors[0]); const [editing, setEditing] = useState<string | null>(null)
  async function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; try { if (editing) await onUpdate(editing, name.trim(), color); else await onCreate(name.trim(), color); setName(''); setEditing(null) } catch { /* 저장 실패 시 입력을 유지합니다. */ } }
  return <section className="categories-view"><button className="back-button" onClick={onBack}><ArrowLeft size={17} />설정으로</button><div className="category-intro"><p>카테고리 이름과 색상은 캘린더와 할 일 목록에 바로 반영됩니다.</p><span>{categories.length}개 사용 중</span></div><form className="category-create" onSubmit={submit}><input aria-label="카테고리 이름" placeholder={editing ? '카테고리 이름 수정' : '새 카테고리 이름'} value={name} onChange={event => setName(event.target.value)} maxLength={30} /><div className="category-color-controls"><div className="category-color-picks">{colors.map(item => <button type="button" key={item} aria-label={`${item} 선택`} className={color === item ? 'selected' : ''} style={{ background: item }} onClick={() => setColor(item)} />)}</div><label className="custom-color-picker" title="직접 색상 선택"><input type="color" aria-label="사용자 지정 색상" value={color} onChange={event => setColor(event.target.value)} /><span>직접 선택</span></label></div><div className="category-form-actions"><button className="submit-button">{editing ? '저장' : '추가'}</button><button type="button" className="text-button" onClick={() => { setEditing(null); setName(''); setColor(colors[0]) }}>취소</button></div></form><div className="category-manager-list">{categories.map(category => { const categoryTasks = tasks.filter(task => task.categoryId === category.id); const remaining = categoryTasks.filter(task => !task.completed).length; return <div className="category-manager-row" key={category.id}><span className="category-swatch" style={{ background: category.color }} /><div><strong>{category.name}</strong>{remaining > 0 && <small>{remaining}개 미완료 남음</small>}</div><div className="category-row-actions"><button aria-label={`${category.name} 수정`} onClick={() => { setEditing(category.id); setName(category.name); setColor(category.color) }}><Pencil size={15} /></button><button aria-label={`${category.name} 삭제`} title="연결된 할 일과 함께 삭제" onClick={() => onRemove(category.id)}><Trash2 size={15} /></button></div></div> })}</div></section>
}
