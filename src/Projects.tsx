import { useEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react'
import ItemColorPicker from './ItemColorPicker'
import { projectColor } from './data/itemColors'
import { ArrowLeft, Check, Folder, FolderPlus, Pencil, Plus, Share2, Trash2 } from 'lucide-react'
import { projectRepository, type EntryDraft, type ProjectData, type ProjectEntry } from './data/projectRepository'
import { supabase } from './data/supabase'
import ProjectSharing from './ProjectSharing'
import { projectSharing, type ProjectShare, type ShareTarget } from './data/projectSharing'
import { projectEntryOccursOn } from './data/projectCalendar'
import { defaultProjectVisibility, visibleProjectEntries, type ProjectVisibility } from './data/projectCalendar'

const labels = { todo: 'todo', schedule: '일정', memo: '메모' }
type Editor = { type: 'group' | 'project' | 'entry'; id?: string; parentId?: string }
type Removal = { type: 'group' | 'project' | 'entry'; id: string; name: string }
const empty: ProjectData = { groups: [], projects: [], entries: [] }

export default function Projects({ onEditing, selectedDate, holidayNames, onCalendarData, management = false, onBack, visibility = defaultProjectVisibility }: { onEditing: (editing: boolean) => void; selectedDate: string; holidayNames: string[]; onCalendarData: (data: ProjectData) => void; management?: boolean; onBack?: () => void; visibility?: ProjectVisibility }) {
  const [data, setData] = useState<ProjectData>(empty)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const [actor, setActor] = useState('')
  const [invites, setInvites] = useState<ProjectShare[]>([])
  const [inviteError, setInviteError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<ProjectEntry['kind']>('todo')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3d8b67')
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const quickDialogRef = useRef<HTMLElement>(null)
  const addingGroup = editor?.type === 'group' && !editor.id
  const locked = busy || !!editor || !!removal || !!shareTarget
  async function load() {
    setLoading(true); setError('')
    try { const next = await projectRepository.list(); setData(next); setSelectedId(current => next.projects.some(item => item.id === current) ? current : next.projects[0]?.id ?? null) }
    catch (cause) { setError((cause as Error).message ?? '프로젝트를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  async function loadInvites() {
    if (!supabase) return
    try { setInvites(await projectSharing.incoming()); setInviteError('') } catch { setInviteError('공유 기능을 사용하려면 project-sharing.sql을 먼저 적용해주세요.') }
  }
  useEffect(() => { void load(); void loadInvites(); if (supabase) void supabase.auth.getUser().then(({ data }) => setActor(data.user?.id ?? '')) }, [])
  useEffect(() => { onEditing(!!editor || !!removal || !!shareTarget); return () => onEditing(false) }, [editor, removal, shareTarget, onEditing])
  useEffect(() => { onCalendarData(data) }, [data, onCalendarData])
  async function run(operation: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try { await operation() } catch (cause) { setError((cause as Error).message ?? '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  const project = data.projects.find(item => item.id === selectedId)
  const group = data.groups.find(item => item.id === project?.groupId)
  function owns(item: { ownerId?: string } | undefined) { return !!item && (!supabase || item.ownerId === actor) }
  function editable(item: { ownerId?: string; accessRole?: string } | undefined) { return owns(item) || item?.accessRole === 'edit' }
  const editableProjects = data.projects.filter(editable)

  function openCalendarEntry(projectId: string) {
    setTab('todo'); setEditor({ type: 'entry', parentId: projectId })
    setName(''); setContent(''); setDate(selectedDate); setEndDate(''); setError('')
  }

  useEffect(() => {
    if ((management && !addingGroup) || !editor) return
    const previousFocus = document.activeElement as HTMLElement | null
    const dialog = quickDialogRef.current
    dialog?.querySelector<HTMLElement>('input')?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); setEditor(null) }
      if (event.key !== 'Tab') return
      const elements = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [management, !!editor, addingGroup, busy])
  const allEntries = data.entries.filter(item => item.projectId === project?.id)
  const dailyEntries = visibleProjectEntries(data, visibility).filter(item => projectEntryOccursOn(item, selectedDate))
  const day = new Date(`${selectedDate}T12:00:00`)
  const entries = allEntries.filter(item => item.kind === tab).sort((a, b) => tab === 'memo' ? b.createdAt.localeCompare(a.createdAt) : (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.createdAt.localeCompare(b.createdAt))
  function open(next: Editor, title = '', entry?: ProjectEntry) {
    if (next.type === 'project') setColor(next.id ? projectColor(data.projects.find(item => item.id === next.id)!) : '#3d8b67')
    if (entry) setTab(entry.kind)
    setEditor(next); setName(title); setContent(next.type === 'group' ? data.groups.find(item => item.id === next.id)?.description ?? '' : entry?.content ?? ''); setDate(entry ? entry.date ?? '' : next.type === 'entry' && tab !== 'memo' ? selectedDate : ''); setEndDate(entry?.endDate ?? ''); setError('')
  }
  async function toggle(entry: ProjectEntry) {
    await run(async () => { const changed = await projectRepository.toggleEntry(entry.id, !entry.completed); setData(current => ({ ...current, entries: current.entries.map(item => item.id === changed.id ? changed : item) })) })
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!editor || busy || !name.trim()) return
    const target = editor
    await run(async () => {
      if (target.type === 'group') {
        const changed = target.id ? await projectRepository.updateGroup(target.id, name, content) : await projectRepository.createGroup(name, content)
        setData(current => ({ ...current, groups: target.id ? current.groups.map(item => item.id === changed.id ? { ...item, ...changed, accessRole: item.accessRole } : item) : [...current.groups, changed] }))
      } else if (target.type === 'project') {
        const changed = target.id ? await projectRepository.updateProject(target.id, name, color) : await projectRepository.createProject(target.parentId!, name, color)
        changed.accessRole = owns(changed) ? 'owner' : 'edit'
        setData(current => ({ ...current, projects: target.id ? current.projects.map(item => item.id === changed.id ? changed : item) : [...current.projects, changed] })); setSelectedId(changed.id)
      } else {
        if (!editable(data.projects.find(item => item.id === target.parentId))) throw new Error('등록할 수 있는 프로젝트를 선택해주세요.')
        const draft: EntryDraft = { kind: tab, title: name, content, date: date || null, endDate: endDate || null }
        const changed = await projectRepository.saveEntry(target.parentId!, draft, target.id)
        setData(current => ({ ...current, entries: target.id ? current.entries.map(item => item.id === changed.id ? changed : item) : [...current.entries, changed] }))
      }
      setEditor(null)
    })
  }
  async function remove() {
    if (!removal || busy) return
    const target = removal
    await run(async () => {
      if (target.type === 'group') await projectRepository.removeGroup(target.id)
      else if (target.type === 'project') await projectRepository.removeProject(target.id)
      else await projectRepository.removeEntry(target.id)
      const removedProjects = new Set(data.projects.filter(item => target.type === 'group' ? item.groupId === target.id : target.type === 'project' && item.id === target.id).map(item => item.id))
      setData(current => ({ groups: current.groups.filter(item => target.type !== 'group' || item.id !== target.id), projects: current.projects.filter(item => !removedProjects.has(item.id)), entries: current.entries.filter(item => !removedProjects.has(item.projectId) && (target.type !== 'entry' || item.id !== target.id)) }))
      if (selectedId && removedProjects.has(selectedId)) setSelectedId(null)
      setRemoval(null)
    })
  }
  function actions(type: Removal['type'], id: string, title: string, parentId?: string, entry?: ProjectEntry) {
    const scope = type === 'group' ? data.groups.find(item => item.id === id) : data.projects.find(item => item.id === (type === 'entry' ? parentId : id))
    const typeLabel = type === 'group' ? '그룹' : type === 'project' ? '프로젝트' : labels[entry!.kind]
    const canEdit = editable(scope), canDelete = type === 'entry' ? canEdit : owns(scope)
    return <div className="project-row-actions">{type !== 'entry' && owns(scope) && <button aria-label={`${title} ${typeLabel} 공유`} disabled={locked} onClick={() => setShareTarget({ kind: type, id, name: title })}><Share2 size={14} /></button>}{canEdit && <button aria-label={`${title} ${typeLabel} 수정`} disabled={locked} onClick={() => open({ type, id, parentId }, title, entry)}><Pencil size={14} /></button>}{canDelete && <button aria-label={`${title} ${typeLabel} 삭제`} disabled={locked} onClick={() => { setError(''); setRemoval({ type, id, name: title }) }}><Trash2 size={14} /></button>}</div>
  }
  return <section className={`projects-view ${management ? 'project-management-view' : 'project-calendar-view'}`}>
    {management && <button className="back-button" disabled={locked} onClick={onBack}><ArrowLeft size={17} />플젝하루로</button>}
    <header className="project-page-heading"><div><div className="project-page-title-row"><h1>{management ? '프로젝트 관리' : '플젝하루'}</h1></div><p>{management ? '그룹별 프로젝트와 todo, 일정, 메모' : '모든 프로젝트의 todo와 일정'}</p></div></header>
    {!management && !loading && <section className="project-day" aria-label="날짜별 프로젝트 내용"><header><h2>{day.getMonth() + 1}월 {day.getDate()}일 {['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}요일</h2>{holidayNames.length > 0 && <span className="project-holiday">{holidayNames.join(' · ')}</span>}</header>
      {data.groups.map(parent => {
        const projects = data.projects.filter(project => project.groupId === parent.id)
        return <section className="project-day-parent" key={parent.id} aria-label={`${parent.name} 그룹`}><h3 className="project-day-parent-heading"><Folder size={17} />{parent.name}</h3>{parent.description && <p className="project-group-description">{parent.description}</p>}<div className="project-day-children">
          {projects.map(scope => {
            const items = dailyEntries.filter(entry => entry.projectId === scope.id)
        return <section key={scope.id} className="project-day-group" style={{ '--project-color': projectColor(scope) } as CSSProperties}>
          <div className="project-day-heading-row"><h4 className="project-day-heading">{scope.name}</h4>{editable(scope) && <button type="button" className="project-calendar-register" disabled={locked} aria-label={`${scope.name}에 Todo 또는 일정 등록`} onClick={() => openCalendarEntry(scope.id)}><Plus size={14} />등록</button>}</div>
          {!items.length && <p className="project-day-empty">{!visibility.todo && !visibility.schedule ? 'todo와 일정이 숨겨져 있어요.' : `이 날짜에는 표시할 ${visibility.todo && visibility.schedule ? 'todo와 일정이' : visibility.todo ? 'todo가' : '일정이'} 없어요.`}</p>}{items.map(entry => <article className={`project-entry ${entry.completed ? 'completed' : ''}`} key={entry.id}>{entry.kind === 'todo' ? <button className="check-button" disabled={locked || !editable(scope)} aria-label={`날짜별 ${entry.title} ${entry.completed ? '완료 취소' : '완료'}`} aria-pressed={entry.completed} onClick={() => void toggle(entry)}>{entry.completed && <Check size={14} />}</button> : <span className="project-kind-label">일정</span>}<div className="project-entry-body"><h5>{entry.title}</h5>{entry.kind === 'schedule' && <time dateTime={entry.date!}>{entry.date}{entry.endDate && entry.endDate !== entry.date ? ` — ${entry.endDate}` : ''}</time>}{entry.content && <p>{entry.content}</p>}</div></article>)}</section>
          })}
          {!projects.length && <p className="project-day-empty">아직 프로젝트가 없어요.</p>}
        </div></section>
      })}
      {!data.projects.length && !data.groups.length && <p className="project-day-empty">아직 프로젝트가 없어요. 캘린더 위 버튼에서 프로젝트를 추가해주세요.</p>}
    </section>}
    {management && supabase && <section className="project-invitations"><div><h2>받은 초대</h2><button className="text-button" disabled={locked} onClick={() => { void loadInvites(); void load() }}>공유 상태 새로고침</button></div>{inviteError && <p>{inviteError}</p>}{!invites.length && !inviteError && <p>새로운 초대가 없어요.</p>}{invites.map(invite => <div key={invite.id}><span>{invite.targetName} <small>{invite.groupId ? '그룹 전체' : '프로젝트'} · {invite.role === 'edit' ? '함께 편집' : '보기만'}</small></span><button className="submit-button" disabled={locked} onClick={() => void run(async () => { await projectSharing.accept(invite.id); await load(); await loadInvites() })}>초대 수락</button></div>)}</section>}
    {error && <div className="data-error" role="alert"><p>{error}</p>{supabase && <small>Supabase에서 새 테이블을 찾지 못하면 projects.sql을 먼저 적용해주세요.</small>}{!editor && !removal && <button className="text-button" onClick={() => void load()}>다시 불러오기</button>}</div>}
    {loading && <p role="status">프로젝트 불러오는 중…</p>}
    {management && !loading && <div className="project-layout">
      <aside className="project-tree" aria-label="그룹과 프로젝트">
        <button type="button" className="project-add-group" disabled={locked} onClick={() => open({ type: 'group' })}><FolderPlus size={16} />그룹 추가</button>
        {!data.groups.length && <div className="project-empty"><strong>아직 그룹이 없어요</strong><p>회사, 팀플, 개인처럼 이름을 정해보세요.</p><button className="text-button" disabled={locked} onClick={() => open({ type: 'group' })}><Plus size={14} />첫 그룹 만들기</button></div>}
        {data.groups.map(item => <section className="project-group" key={item.id}><div className="project-group-heading"><Folder size={15} /><h2>{item.name}</h2>{actions('group', item.id, item.name)}<button className="project-icon-button" disabled={locked || !editable(item)} aria-label={`${item.name}에 프로젝트 추가`} onClick={() => open({ type: 'project', parentId: item.id })}><Plus size={15} /></button></div>{item.description && <p className="project-group-description">{item.description}</p>}<div className="project-tree-list">{data.projects.filter(child => child.groupId === item.id).map(child => <div className={`project-tree-row ${selectedId === child.id ? 'selected' : ''}`} key={child.id} style={{ '--project-color': projectColor(child) } as CSSProperties}><button className="project-select" aria-pressed={selectedId === child.id} disabled={locked} onClick={() => { setSelectedId(child.id); setError('') }}><i className="item-color-dot" style={{ background: projectColor(child) }} />{child.name}</button>{actions('project', child.id, child.name, child.groupId)}</div>)}{!data.projects.some(child => child.groupId === item.id) && <button className="project-tree-empty" disabled={locked || !editable(item)} onClick={() => open({ type: 'project', parentId: item.id })}>프로젝트 추가</button>}</div></section>)}
      </aside>
      <div className="project-detail" style={{ '--project-color': project ? projectColor(project) : 'var(--accent)' } as CSSProperties}>
        {project ? <header className="project-detail-heading"><span>{group?.name}{!owns(project) && ` · 공유받음 · ${editable(project) ? '함께 편집' : '보기만'}`}</span><h2><i className="item-color-dot" style={{ background: projectColor(project) }} />{project.name}</h2><p>todo {allEntries.filter(item => item.kind === 'todo' && item.completed).length}/{allEntries.filter(item => item.kind === 'todo').length} 완료 · 일정 {allEntries.filter(item => item.kind === 'schedule').length} · 메모 {allEntries.filter(item => item.kind === 'memo').length}</p></header> : !editor && <div className="project-empty"><strong>프로젝트를 선택해주세요</strong><p>그룹 아래에 프로젝트를 만들고 내용을 모아보세요.</p></div>}
        {project && <div className="project-tabs" role="tablist" aria-label="프로젝트 내용">{(['todo', 'schedule', 'memo'] as const).map(kind => <button role="tab" id={`project-tab-${kind}`} aria-controls="project-entries-panel" aria-selected={tab === kind} disabled={locked} key={kind} onClick={() => setTab(kind)}>{labels[kind]}<span>{allEntries.filter(item => item.kind === kind).length}</span></button>)}<button className="project-add-entry" disabled={locked || !editable(project)} onClick={() => open({ type: 'entry', parentId: project.id })}><Plus size={14} />{labels[tab]} 추가</button></div>}
        {editor && !addingGroup && <form className="project-editor" onSubmit={save}><h3>{editor.type === 'group' ? '그룹' : editor.type === 'project' ? '프로젝트' : labels[tab]} {editor.id ? '수정' : '추가'}</h3><fieldset disabled={busy}><label>{editor.type === 'entry' ? '제목' : '이름'}<input autoFocus aria-label={editor.type === 'group' ? '그룹 이름' : editor.type === 'project' ? '프로젝트 이름' : `${labels[tab]} 제목`} maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder={editor.type === 'group' ? '회사, 팀플, 개인…' : editor.type === 'project' ? '프로젝트 이름' : '제목을 입력하세요'} /></label>{editor.type === 'group' && <label>설명 (선택)<textarea aria-label="그룹 설명" rows={3} maxLength={1000} value={content} onChange={event => setContent(event.target.value)} placeholder="그룹에 대한 설명을 적어주세요" /></label>}{editor.type === 'project' && <ItemColorPicker label="프로젝트" value={color} onChange={setColor} />}{editor.type === 'entry' && <><label>{tab === 'memo' ? '메모 내용' : '설명'}<textarea aria-label={`${labels[tab]} 내용`} rows={tab === 'memo' ? 6 : 3} maxLength={10000} value={content} onChange={event => setContent(event.target.value)} placeholder="내용을 입력하세요" /></label>{tab !== 'memo' && <div className="project-date-inputs"><label>{tab === 'todo' ? 'todo 날짜 (선택)' : '시작 날짜'}<input type="date" aria-label={tab === 'todo' ? 'todo 날짜' : '일정 시작 날짜'} required={tab === 'schedule'} value={date} onInput={event => setDate(event.currentTarget.value)} onChange={event => setDate(event.target.value)} /></label>{tab === 'schedule' && <label>종료 날짜 (선택)<input type="date" aria-label="일정 종료 날짜" min={date || undefined} value={endDate} onInput={event => setEndDate(event.currentTarget.value)} onChange={event => setEndDate(event.target.value)} /></label>}</div>}</>}<div className="form-actions"><button className="text-button" type="button" onClick={() => setEditor(null)}>취소</button><button className="submit-button" disabled={!name.trim()}>{busy ? '저장 중…' : '저장'}</button></div></fieldset></form>}
        {project && <div id="project-entries-panel" className="project-entries" role="tabpanel" aria-labelledby={`project-tab-${tab}`}>{entries.map(entry => <article className={`project-entry ${entry.completed ? 'completed' : ''}`} key={entry.id}>{entry.kind === 'todo' && <button className="check-button" disabled={locked || !editable(project)} aria-label={`${entry.title} ${entry.completed ? '완료 취소' : '완료'}`} aria-pressed={entry.completed} onClick={() => void toggle(entry)}>{entry.completed && <Check size={14} />}</button>}<div className="project-entry-body"><h3>{entry.title}</h3>{entry.date && <time dateTime={entry.date}>{entry.date}{entry.endDate && entry.endDate !== entry.date ? ` — ${entry.endDate}` : ''}</time>}{entry.content && <p>{entry.content}</p>}</div>{actions('entry', entry.id, entry.title, entry.projectId, entry)}</article>)}{!entries.length && !editor && <div className="project-empty"><strong>등록된 {labels[tab]}이 없어요</strong><p>위의 ‘{labels[tab]} 추가’ 버튼으로 작성하세요.</p></div>}</div>}
      </div>
    </div>}
    {addingGroup && <div className="modal-backdrop"><section ref={quickDialogRef} className="reset-dialog project-quick-dialog" role="dialog" aria-modal="true" aria-labelledby="project-group-add-title">
      <h2 id="project-group-add-title">그룹 추가</h2>
      <form className="project-editor" onSubmit={save}><fieldset disabled={busy}>
        <label>그룹 이름<input autoFocus aria-label="그룹 이름" maxLength={80} required value={name} onChange={event => setName(event.target.value)} placeholder="회사, 팀플, 개인…" /></label>
        <label>설명 (선택)<textarea aria-label="그룹 설명" rows={3} maxLength={1000} value={content} onChange={event => setContent(event.target.value)} placeholder="그룹에 대한 설명을 적어주세요" /></label>
        {error && <p className="project-quick-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="text-button" onClick={() => setEditor(null)}>취소</button><button className="submit-button" disabled={!name.trim()}>{busy ? '저장 중…' : '저장'}</button></div>
      </fieldset></form>
    </section></div>}
    {!management && editor?.type === 'entry' && <div className="modal-backdrop"><section ref={quickDialogRef} className="reset-dialog project-quick-dialog" role="dialog" aria-modal="true" aria-labelledby="project-quick-title">
      <h2 id="project-quick-title">Todo · 일정 등록</h2>
      <p className="project-registration-group"><span>그룹</span><strong>{data.groups.find(group => group.id === data.projects.find(project => project.id === editor.parentId)?.groupId)?.name ?? '프로젝트를 선택해주세요'}</strong></p>
      {!editableProjects.length ? <><p>등록할 수 있는 프로젝트가 없어요. 프로젝트 관리에서 프로젝트를 먼저 만들어주세요. 공유받은 프로젝트는 편집 권한이 있어야 등록할 수 있습니다.</p><button autoFocus className="text-button" onClick={() => setEditor(null)}>닫기</button></> : <form className="project-editor" onSubmit={save}>
        <fieldset disabled={busy}>
          <div className="project-kind-picker" role="group" aria-label="등록 유형">{(['todo', 'schedule'] as const).map(kind => <button key={kind} type="button" aria-pressed={tab === kind} onClick={() => { setTab(kind); if (kind === 'todo') setEndDate('') }}>{kind === 'todo' ? 'Todo' : '일정'}</button>)}</div>
          <label>프로젝트<select required value={editor.parentId ?? ''} onChange={event => setEditor({ ...editor, parentId: event.target.value })}><option value="" disabled>프로젝트를 선택하세요</option>{data.groups.map(parent => <optgroup key={parent.id} label={parent.name}>{editableProjects.filter(item => item.groupId === parent.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label>
          <label>제목<input autoFocus aria-label={`${tab === 'todo' ? 'Todo' : '일정'} 제목`} required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="제목을 입력하세요" /></label>
          <div className="project-date-inputs"><label>{tab === 'todo' ? 'Todo 날짜' : '시작 날짜'}<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>{tab === 'schedule' && <label>종료 날짜 (선택)<input type="date" min={date || undefined} value={endDate} onChange={event => setEndDate(event.target.value)} /></label>}</div>
          <label>설명 (선택)<textarea rows={3} maxLength={10000} value={content} onChange={event => setContent(event.target.value)} placeholder="내용을 입력하세요" /></label>
          {error && <p className="project-quick-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="text-button" onClick={() => setEditor(null)}>취소</button><button className="submit-button" disabled={!name.trim() || !editor.parentId || !date}>{busy ? '저장 중…' : '등록'}</button></div>
        </fieldset>
      </form>}
    </section></div>}
    {shareTarget && <ProjectSharing target={shareTarget} onClose={() => setShareTarget(null)} />}
    {removal && <div className="modal-backdrop"><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="project-removal-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) setRemoval(null) }}><h2 id="project-removal-title">‘{removal.name}’을 삭제할까요?</h2><p>{removal.type === 'group' ? '이 그룹의 모든 프로젝트와 todo·일정·메모가 함께 삭제됩니다.' : removal.type === 'project' ? '이 프로젝트의 todo·일정·메모가 함께 삭제됩니다.' : '이 항목이 삭제됩니다.'} 삭제 후에는 복구할 수 없습니다. 다른 그룹과 프로젝트의 내용은 유지됩니다.</p>{error && <p role="alert">{error}</p>}<div className="form-actions"><button autoFocus className="text-button" disabled={busy} onClick={() => setRemoval(null)}>취소</button><button className="danger-button solid" disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제'}</button></div></section></div>}
  </section>
}
