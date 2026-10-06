import { useEffect, useState, type FormEvent, type CSSProperties } from 'react'
import ItemColorPicker from './ItemColorPicker'
import { defaultHabitColor } from './data/itemColors'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { habitRepository } from './data/habitRepository'
import { habitIsVisible, habitIsScheduled, habitWeekdaysOn, habitExcludesHolidaysOn } from './data/habitSchedule'
import type { Habit, HabitCompletion } from './types'
import type { HolidayMap } from './data/koreanHolidays'

const days = ['일', '월', '화', '수', '목', '금', '토']
const allDays = [0, 1, 2, 3, 4, 5, 6]
function parse(value: string) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d) }
function repeatLabel(habit: Habit, date?: string) { const weekdays = date ? habitWeekdaysOn(habit, date) : habit.weekdays; return weekdays.length === 7 ? '매일' : `매주 ${weekdays.map(day => days[day]).join(' · ')}` }

export type HabitCalendarData = { habits: Habit[]; completions: HabitCompletion[] }

export default function Habits({ date, onCalendarData, holidays, holidayReady }: { date: string; onCalendarData: (data: HabitCalendarData) => void; holidays: HolidayMap; holidayReady: boolean }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<HabitCompletion[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState(defaultHabitColor)
  const [daily, setDaily] = useState(true)
  const [excludeHolidays, setExcludeHolidays] = useState(false)
  const [weekdays, setWeekdays] = useState([1, 3, 5])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; habitRepository.list().then(data => { if (active) { setHabits(data.habits); setCompletions(data.completions) } }).catch(cause => { if (active) setError(cause.message ?? '습관을 불러오지 못했습니다.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  useEffect(() => { onCalendarData({ habits, completions }) }, [habits, completions, onCalendarData])
  async function create(event: FormEvent) {
    event.preventDefault()
    if (saving || deleting || !name.trim() || (!daily && !weekdays.length)) return
    setSaving(true); setError('')
    try {
      const repeatDays = daily ? allDays : [...weekdays].sort((a, b) => a - b)
      const habit = editing ? await habitRepository.update(editing, name.trim(), repeatDays, excludeHolidays, color) : await habitRepository.create(name.trim(), repeatDays, excludeHolidays, color)
      setHabits(current => editing ? current.map(item => item.id === habit.id ? habit : item) : [...current, habit])
      setName(''); setAdding(false); setEditing(null)
    }
    catch (cause) { setError((cause as Error).message ?? '습관을 저장하지 못했습니다.') }
    finally { setSaving(false) }
  }
  async function toggle(habitId: string) {
    const targetDate = date, token = habitId + ':' + targetDate
    if (pending.includes(token) || saving || deleteTarget || deleting) return
    const completed = completions.some(item => item.habitId === habitId && item.date === targetDate)
    setPending(current => [...current, token]); setError('')
    try {
      await habitRepository.setCompleted(habitId, targetDate, !completed)
      setCompletions(current => { const next = current.filter(item => item.habitId !== habitId || item.date !== targetDate); return completed ? next : [...next, { habitId, date: targetDate }] })
    } catch (cause) { setError((cause as Error).message ?? '완료 기록을 저장하지 못했습니다.') }
    finally { setPending(current => current.filter(item => item !== token)) }
  }
  const selected = parse(date)
  const holiday = holidayReady ? !!holidays[date]?.length : null
  const scheduled = habits.filter(habit => habitIsVisible(habit, date, completions, holiday))
  function edit(habit: Habit) {
    setColor(habit.color ?? defaultHabitColor)
    setExcludeHolidays(!!habit.excludeHolidays); setEditing(habit.id); setName(habit.name); setDaily(habit.weekdays.length === 7); setWeekdays([...habit.weekdays]); setAdding(true); setError('')
  }
  async function remove() {
    if (!deleteTarget || deleting || saving || pending.length) return
    const id = deleteTarget.id
    setDeleting(true); setError('')
    try {
      await habitRepository.remove(id)
      setHabits(current => current.filter(habit => habit.id !== id))
      setCompletions(current => current.filter(item => item.habitId !== id))
      setDeleteTarget(null)
      if (editing === id) { setEditing(null); setAdding(false); setName('') }
    } catch (cause) { setError((cause as Error).message ?? '습관을 삭제하지 못했습니다.') }
    finally { setDeleting(false) }
  }
  function actions(habit: Habit, prefix = '') {
    const busy = saving || deleting || !!deleteTarget || !!pending.length
    return <div className="habit-row-actions"><button type="button" aria-label={`${prefix}${habit.name} 수정`} title="습관 수정" disabled={busy} onClick={() => edit(habit)}><Pencil size={15} /></button><button type="button" aria-label={`${prefix}${habit.name} 삭제`} title="습관 삭제" disabled={busy} onClick={() => { setError(''); setDeleteTarget(habit) }}><Trash2 size={15} /></button></div>
  }
  return <section className="habits-view">
    <header className="feed-heading"><h1>습관하루</h1><span>나의 반복 기록</span></header>
    <div className="feed-date-heading"><h2>{selected.getMonth() + 1}월 {selected.getDate()}일</h2><p>{days[selected.getDay()]}요일</p>{!!holidays[date]?.length && <span className="holiday-badge">{holidays[date].join(' · ')}</span>}<button className="text-button habit-add-button" disabled={saving || deleting || !!deleteTarget} onClick={() => { setEditing(null); setColor(defaultHabitColor); setExcludeHolidays(false); setName(''); setDaily(true); setWeekdays([1, 3, 5]); setAdding(true); setError('') }}><Plus size={16} />습관 추가</button></div>
    {error && <p className="data-error" role="alert">{error}</p>}
    {adding && <form className="habit-create" onSubmit={create} aria-label={editing ? '습관 수정' : '습관 추가'}><h3>{editing ? '습관 수정' : '새 습관'}</h3>{editing && <p className="habit-edit-note">반복 주기 변경은 오늘부터 적용됩니다. 어제까지의 일정과 완료 기록, 오늘 이미 완료한 기록은 유지됩니다.</p>}<fieldset disabled={saving}><label>습관 이름<input autoFocus aria-label="습관 이름" value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="물 마시기" required /></label><ItemColorPicker label="습관" value={color} onChange={setColor} /><label>반복 주기<select aria-label="습관 반복 주기" value={daily ? 'daily' : 'weekly'} onChange={event => setDaily(event.target.value === 'daily')}><option value="daily">매일</option><option value="weekly">특정 요일</option></select></label>{!daily && <div className="weekday-picks">{[1, 2, 3, 4, 5, 6, 0].map(day => <button type="button" aria-pressed={weekdays.includes(day)} key={day} onClick={() => setWeekdays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day])}>{days[day]}</button>)}</div>}<label className="habit-holiday-option"><input type="checkbox" checked={excludeHolidays} onChange={event => setExcludeHolidays(event.target.checked)} />대한민국 공휴일 제외</label><div className="form-actions"><button type="button" disabled={saving} className="text-button" onClick={() => { setAdding(false); setEditing(null); setName('') }}>취소</button><button className="submit-button" disabled={saving || !name.trim() || (!daily && !weekdays.length)}>{saving ? '저장 중…' : '저장'}</button></div></fieldset></form>}
    {loading ? <p role="status">습관 불러오는 중…</p> : <div className="habit-list">{scheduled.map(habit => { const done = completions.some(item => item.habitId === habit.id && item.date === date); return <div key={habit.id} className={`habit-row ${done ? 'completed' : ''}`} style={{ '--habit-color': habit.color ?? defaultHabitColor } as CSSProperties}><button className="check-button" aria-label={`${habit.name} ${done ? '완료 취소' : '완료'}`} aria-pressed={done} disabled={saving || deleting || !!deleteTarget || pending.includes(habit.id + ':' + date)} onClick={() => void toggle(habit.id)}>{done && <Check size={14} strokeWidth={3} />}</button><div className="habit-row-content"><strong><i className="item-color-dot" style={{ background: habit.color ?? defaultHabitColor }} />{habit.name}</strong><small>{habitIsScheduled(habit, date, holiday) ? repeatLabel(habit, date) + (habitExcludesHolidaysOn(habit, date) ? ' · 공휴일 제외' : '') : '일정 변경 전 완료 기록'}</small></div>{actions(habit)}</div> })}{!scheduled.length && <div className="empty-state"><strong>이 날짜에 예정된 습관이 없어요</strong><p>습관을 추가하거나 다른 날짜를 선택하세요.</p></div>}</div>}
    {!!habits.length && <section className="habit-library"><h3>등록된 습관</h3>{habits.map(habit => <div key={habit.id}><div className="habit-row-content"><span><i className="item-color-dot" style={{ background: habit.color ?? defaultHabitColor }} />{habit.name}</span><small>{repeatLabel(habit)}{habit.excludeHolidays && ' · 공휴일 제외'}</small></div>{actions(habit, '등록된 습관 ')}</div>)}</section>}
    {deleteTarget && <div className="modal-backdrop"><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="habit-delete-title" onKeyDown={event => { if (event.key === 'Escape' && !deleting) setDeleteTarget(null) }}><h2 id="habit-delete-title">습관을 삭제할까요?</h2><p>‘{deleteTarget.name}’ 습관과 이 습관의 모든 날짜별 완료 기록이 함께 삭제됩니다. 다른 습관과 할 일은 유지됩니다. 삭제 후에는 복구할 수 없습니다.</p>{error && <p role="alert" className="data-error">{error}</p>}<div className="form-actions"><button autoFocus type="button" className="text-button" disabled={deleting} onClick={() => setDeleteTarget(null)}>취소</button><button type="button" className="danger-button solid" disabled={deleting || saving || !!pending.length} onClick={() => void remove()}>{deleting ? '삭제 중…' : '삭제'}</button></div></section></div>}
  </section>
}
