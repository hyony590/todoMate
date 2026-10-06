import { supabase } from './supabase'

export type ShareTarget = { kind: 'group' | 'project'; id: string; name: string }
export type ProjectShare = { id: string; groupId: string | null; projectId: string | null; email: string; role: 'view' | 'edit'; acceptedAt: string | null; targetName: string }
const fromRow = (row: any): ProjectShare => ({ id: row.id, groupId: row.group_id, projectId: row.project_id, email: row.invitee_email, role: row.role, acceptedAt: row.accepted_at, targetName: row.target_name ?? '' })
function client() { if (!supabase) throw new Error('실제 공유는 Supabase 연결 후 사용할 수 있습니다.'); return supabase }
function result<T>(value: { data: T; error: any }): T { if (value.error) throw value.error; return value.data }
export const projectSharing = {
  async list(target: ShareTarget): Promise<ProjectShare[]> {
    const rows = result(await client().from('project_shares').select('*').eq(target.kind === 'group' ? 'group_id' : 'project_id', target.id).order('created_at'))
    return (rows ?? []).map(fromRow)
  },
  async incoming(): Promise<ProjectShare[]> {
    return ((result(await client().rpc('incoming_haru_project_invites')) ?? []) as any[]).map(fromRow)
  },
  async invite(target: ShareTarget, email: string, role: 'view' | 'edit'): Promise<ProjectShare> {
    email = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !['view', 'edit'].includes(role)) throw new Error('이메일과 권한을 확인해주세요.')
    return fromRow(result(await client().rpc('invite_haru_project', { target_kind: target.kind, target_id: target.id, recipient_email: email, access_role: role })))
  },
  async setRole(id: string, role: 'view' | 'edit'): Promise<void> {
    if (!['view', 'edit'].includes(role)) throw new Error('권한을 확인해주세요.')
    result(await client().from('project_shares').update({ role }).eq('id', id).select('id').single())
  },
  async revoke(id: string): Promise<void> { result(await client().from('project_shares').delete().eq('id', id).select('id').single()) },
  async accept(id: string): Promise<void> { result(await client().rpc('accept_haru_project_invite', { invite_id: id })) },
}
