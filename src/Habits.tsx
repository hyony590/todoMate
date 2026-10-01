import { useEffect, useState, type FormEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { habitRepository } from './data/habitRepository'
import type { Habit, HabitCompletion } from './types'

const days = ['일', '월', '화', '수', '목', '금', '토']
const allDays = [0, 1, 2, 3, 4, 5, 6]
function key(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function parse(value: string) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d) }
function repeatLabel(habit: Habit) { return habit.weekdays.length === 7 ? '매일' : `매주 ${habit.weekdays.map(day => days[day]).join(' · ')}` }

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<HabitCompletion[]>([])
  const [date, setDate] = useState(key(new Date()))
  const [name, setName] = useState('')
  const [daily, setDaily] = useState(true)
  const [weekdays, setWeekdays] = useState([1, 3, 5])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; habitRepository.list().then(data => { if (active) { setHabits(data.habits); setCompletions(data.completions) } }).catch(cause => { if (active) setError(cause.message ?? '습관을 불러오지 못했습니다.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  async function create(event: FormEvent) {
    event.preventDefault()
    if (saving || !name.trim() || (!daily && !weekdays.length)) return
    setSaving(true); setError('')
    try { const habit = await habitRepository.create(name.trim(), daily ? allDays : [...weekdays].sort()); setHabits(current => [...current, habit]); setName(''); setAdding(false) }
    catch (cause) { setError((cause as Error).message ?? '습관을 저장하지 못했습니다.') }
    finally { setSaving(false) }
  }
  async function toggle(habitId: string) {
    const targetDate = date, token = habitId + ':' + targetDate
    if (pending.includes(token)) return
    const completed = completions.some(item => item.habitId === habitId && item.date === targetDate)
    setPending(current => [...current, token]); setError('')
    try {
      await habitRepository.setCompleted(habitId, targetDate, !completed)
      setCompletions(current => { const next = current.filter(item => item.habitId !== habitId || item.date !== targetDate); return completed ? next : [...next, { habitId, date: targetDate }] })
    } catch (cause) { setError((cause as Error).message ?? '완료 기록을 저장하지 못했습니다.') }
    finally { setPending(current => current.filter(item => item !== token)) }
  }
  const selected = parse(date)
  const scheduled = habits.filter(habit => habit.weekdays.includes(selected.getDay()) && key(new Date(habit.createdAt)) <= date)
  function move(offset: number) { const next = parse(date); next.setDate(next.getDate() + offset); setDate(key(next)) }
  return <section className="habits-view">
    <div className="calendar-toolbar"><div><strong>꾸준히 이어가는 나의 습관</strong><span>완료 기록은 날짜별로 따로 저장됩니다.</span></div><button className="submit-button" onClick={() => setAdding(true)}><Plus size={16} />습관 추가</button></div>
    {error && <p className="data-error" role="alert">{error}</p>}
    {adding && <form className="habit-create" onSubmit={create}><label>습관 이름<input autoFocus aria-label="습관 이름" value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="물 마시기" required /></label><label>반복 주기<select aria-label="습관 반복 주기" value={daily ? 'daily' : 'weekly'} onChange={event => setDaily(event.target.value === 'daily')}><option value="daily">매일</option><option value="weekly">특정 요일</option></select></label>{!daily && <div className="weekday-picks">{[1, 2, 3, 4, 5, 6, 0].map(day => <button type="button" aria-pressed={weekdays.includes(day)} key={day} onClick={() => setWeekdays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day])}>{days[day]}</button>)}</div>}<div className="form-actions"><button type="button" disabled={saving} className="text-button" onClick={() => setAdding(false)}>취소</button><button className="submit-button" disabled={saving || !name.trim() || (!daily && !weekdays.length)}>{saving ? '저장 중…' : '저장'}</button></div></form>}
    <div className="habit-date"><button aria-label="습관 이전 날짜" onClick={() => move(-1)}><ChevronLeft size={18} /></button><input type="date" aria-label="습관 날짜" value={date} onChange={event => { if (event.target.value) setDate(event.target.value) }} /><button aria-label="습관 다음 날짜" onClick={() => move(1)}><ChevronRight size={18} /></button><button onClick={() => setDate(key(new Date()))}>오늘</button></div>
    <h2>{selected.getMonth() + 1}월 {selected.getDate()}일 · {days[selected.getDay()]}요일</h2>
    {loading ? <p role="status">습관 불러오는 중…</p> : <div className="habit-list">{scheduled.map(habit => { const done = completions.some(item => item.habitId === habit.id && item.date === date); return <div key={habit.id} className={`habit-row ${done ? 'completed' : ''}`}><button className="check-button" aria-label={`${habit.name} ${done ? '완료 취소' : '완료'}`} aria-pressed={done} disabled={pending.includes(habit.id + ':' + date)} onClick={() => void toggle(habit.id)}>{done && <Check size={14} strokeWidth={3} />}</button><div><strong>{habit.name}</strong><small>{repeatLabel(habit)}</small></div></div> })}{!scheduled.length && <div className="empty-state"><strong>이 날짜에 예정된 습관이 없어요</strong><p>습관을 추가하거나 다른 날짜를 선택하세요.</p></div>}</div>}
    {!!habits.length && <section className="habit-library"><h3>등록된 습관</h3>{habits.map(habit => <div key={habit.id}><span>{habit.name}</span><small>{repeatLabel(habit)}</small></div>)}</section>}
  </section>
}
