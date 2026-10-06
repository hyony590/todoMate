import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from './data/supabase'
import { projectSharing, type ProjectShare, type ShareTarget } from './data/projectSharing'

export default function ProjectSharing({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const [shares, setShares] = useState<ProjectShare[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'view' | 'edit'>('view')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState('')
  const [revokeId, setRevokeId] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (supabase) projectSharing.list(target).then(rows => { if (active) setShares(rows) }).catch(cause => { if (active) setError(cause.message ?? '공유 SQL을 먼저 적용해주세요.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [target])
  async function run(operation: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try { await operation() } catch (cause) { setError((cause as Error).message ?? '공유 설정을 저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  async function invite(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      const share = await projectSharing.invite(target, email, role)
      setShares(current => [...current.filter(item => item.id !== share.id), share]); setEmail('')
    })
  }
  return <div className="modal-backdrop"><section className="reset-dialog project-share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) onClose() }}>
    <header><div><small>{target.kind === 'group' ? '그룹 공유' : '프로젝트 공유'}</small><h2 id="share-title">{target.name}</h2></div><button autoFocus className="text-button" disabled={busy} onClick={onClose}>닫기</button></header>
    <p>{target.kind === 'group' ? '이 그룹의 현재·앞으로 추가되는 모든 프로젝트를 공유합니다.' : '이 프로젝트의 할 일·일정·메모만 공유합니다.'} 권한 변경과 공유 해제는 소유자만 할 수 있습니다.</p>
    {!supabase && <p className="share-demo-note" role="status">로컬 화면에서는 설정 미리보기만 가능합니다. 실제 초대·권한 적용은 Supabase 연결과 공유 SQL 적용 후 사용할 수 있습니다.</p>}
    {error && <p className="data-error" role="alert">{error}</p>}
    <form onSubmit={invite} className="project-share-form"><fieldset disabled={busy || loading}><label>초대할 이메일<input type="email" required maxLength={254} aria-label="초대할 이메일" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label><label>공유 권한<select aria-label="공유 권한" value={role} onChange={event => setRole(event.target.value as 'view' | 'edit')}><option value="view">보기만</option><option value="edit">함께 편집</option></select></label><p className="share-permission-note">{role === 'view' ? '내용을 볼 수 있지만 추가·수정·완료 체크는 할 수 없습니다.' : '내용 추가·수정·삭제와 완료 체크가 가능합니다. 그룹·프로젝트 삭제와 재공유는 소유자만 가능합니다.'}</p><button className="submit-button" disabled={!supabase || !email.trim()}>{busy ? '저장 중…' : '초대 등록'}</button></fieldset></form>
    <small className="share-permission-note">안내 메일은 발송되지 않습니다. 상대가 같은 이메일로 가입·로그인한 뒤 플젝하루에서 초대를 수락해야 접근할 수 있습니다.</small>
    <section className="project-share-members"><h3>공유한 사람</h3>{loading ? <p role="status">불러오는 중…</p> : !shares.length ? <p>아직 공유한 사람이 없어요.</p> : shares.map(share => <div key={share.id}><span><strong>{share.email}</strong><small>{share.acceptedAt ? '수락 완료' : '수락 대기'}</small></span><select aria-label={`${share.email} 권한`} value={share.role} disabled={busy} onChange={event => { const next = event.target.value as 'view' | 'edit'; void run(async () => { await projectSharing.setRole(share.id, next); setShares(current => current.map(item => item.id === share.id ? { ...item, role: next } : item)) }) }}><option value="view">보기만</option><option value="edit">함께 편집</option></select><button className="text-button" disabled={busy} onClick={() => setRevokeId(share.id)}>공유 해제</button></div>)}</section>
    {revokeId && <div className="share-revoke-confirm"><p>이 직접 공유 권한을 해제할까요? 다른 그룹·프로젝트 공유로 받은 권한은 별도로 유지됩니다.</p><button className="text-button" disabled={busy} onClick={() => setRevokeId(null)}>취소</button><button className="danger-button" disabled={busy} onClick={() => void run(async () => { await projectSharing.revoke(revokeId); setShares(current => current.filter(item => item.id !== revokeId)); setRevokeId(null) })}>공유 해제 확인</button></div>}
  </section></div>
}
