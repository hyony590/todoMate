import type { CSSProperties } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProjectData } from './data/projectRepository'
import type { HolidayMap } from './data/koreanHolidays'
import { defaultProjectVisibility, projectEntryOccursOn, projectWeekBars, visibleProjectEntries, type ProjectVisibility } from './data/projectCalendar'
import { projectColor } from './data/itemColors'
import PetalMark from './PetalMark'

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
const dayNames = ['일', '월', '화', '수', '목', '금', '토']
const visibleLanes = 3

export default function ProjectCalendar({ date, selectedDate, data, weekStart, holidays, onSelect, visibility = defaultProjectVisibility, onVisibilityChange, disabled = false }: {
  date: Date; selectedDate: string; data: ProjectData; weekStart: number; holidays: HolidayMap; onSelect: (key: string) => void;
  visibility?: ProjectVisibility; onVisibilityChange: (value: ProjectVisibility) => void; disabled?: boolean;
}) {
  const offset = (new Date(date.getFullYear(), date.getMonth(), 1).getDay() - weekStart + 7) % 7
  const count = Math.ceil((offset + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7)
  const today = dateKey(new Date())
  const entries = visibleProjectEntries(data, visibility)
  const projects = new Map(data.projects.map(project => [project.id, project]))
  return <section className="calendar-view project-month-calendar" aria-label="프로젝트 월간 캘린더">
    <div className="calendar-toolbar"><div><strong>{date.getFullYear()}년 {date.getMonth() + 1}월</strong></div><div className="toolbar-actions"><button disabled={disabled} onClick={() => onSelect(today)}>오늘</button><button disabled={disabled} aria-label="이전 달" onClick={() => onSelect(dateKey(new Date(date.getFullYear(), date.getMonth() - 1, 1)))}><ChevronLeft size={17} /></button><button disabled={disabled} aria-label="다음 달" onClick={() => onSelect(dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)))}><ChevronRight size={17} /></button></div></div>
    <div className="project-calendar-filters" role="group" aria-label="캘린더 표시 항목">{(['todo', 'schedule'] as const).map(kind => <button type="button" key={kind} disabled={disabled} aria-label={`${kind === 'todo' ? 'todo' : '일정'} 표시`} aria-pressed={visibility[kind]} onClick={() => onVisibilityChange({ ...visibility, [kind]: !visibility[kind] })}><span className="project-filter-check">{visibility[kind] && <Check size={12} />}</span>{kind === 'todo' ? 'todo' : '일정'}</button>)}</div>
    <div className="full-calendar-weekdays">{Array.from({ length: 7 }, (_, i) => <span key={i}>{dayNames[(weekStart + i) % 7]}</span>)}</div>
    {Array.from({ length: count }, (_, week) => {
      const dates = Array.from({ length: 7 }, (_, day) => new Date(date.getFullYear(), date.getMonth(), 1 - offset + week * 7 + day))
      const days = dates.map(dateKey)
      const bars = projectWeekBars(entries, days)
      const laneCount = Math.min(visibleLanes, Math.max(0, ...bars.map(bar => bar.lane + 1)))
      return <div className="project-calendar-week" key={days[0]} style={{ '--calendar-week-height': `${60 + laneCount * 18 + (bars.some(bar => bar.lane >= visibleLanes) ? 12 : 0)}px` } as CSSProperties}>
        <div className="project-calendar-days">{dates.map((cell, column) => {
          const key = days[column], items = entries.filter(entry => projectEntryOccursOn(entry, key))
          const todos = items.filter(entry => entry.kind === 'todo'), completed = todos.filter(entry => entry.completed).length
          const overflow = bars.filter(bar => bar.lane >= visibleLanes && bar.start <= column && column <= bar.end).length
          return <button key={key} disabled={disabled} aria-label={`${cell.getMonth() + 1}월 ${cell.getDate()}일`} aria-pressed={key === selectedDate} title={[...(holidays[key] ?? []), ...items.map(entry => `${projects.get(entry.projectId)?.name} · ${entry.title}`)].join('\n') || '표시할 항목 없음'} className={`project-calendar-day ${cell.getMonth() !== date.getMonth() ? 'outside' : ''} ${key === selectedDate ? 'selected' : ''} ${key === today ? 'today' : ''} ${holidays[key]?.length ? 'holiday' : ''}`} onClick={() => onSelect(key)}>
            <span className="project-calendar-date">{cell.getDate()}</span>
            {visibility.todo && !!todos.length && <span className={`project-calendar-todos ${completed === todos.length ? 'all-done' : ''}`}><PetalMark colors={[...new Set(todos.map(todo => projectColor(projects.get(todo.projectId)!)))].slice(0, 4)} count={todos.length} /><span className="sr-only">todo {todos.length}개 · {completed}개 완료</span></span>}
            {!!overflow && <small className="project-calendar-overflow">+{overflow}개</small>}
          </button>
        })}</div>
        <div className="project-calendar-bars" aria-hidden="true">{bars.filter(bar => bar.lane < visibleLanes).map(bar => <span key={bar.entry.id} className={`project-schedule-bar ${bar.startsHere ? 'starts-here' : ''} ${bar.endsHere ? 'ends-here' : ''}`} style={{ gridColumn: `${bar.start + 1} / ${bar.end + 2}`, gridRow: bar.lane + 1, '--schedule-color': projectColor(projects.get(bar.entry.projectId)!) } as CSSProperties}>{bar.entry.title}</span>)}</div>
      </div>
    })}
    <div className="project-calendar-key"><span><PetalMark colors={['#989b9e']} count={1} />todo 개수</span><span><i className="schedule-key" />일정 기간</span></div>
    {!visibility.todo && !visibility.schedule && <p className="project-calendar-hidden" role="status">todo와 일정이 숨겨져 있어요. 위 버튼으로 다시 표시하세요.</p>}
  </section>
}
