import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './data/supabase'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setSession(data.session); setLoading(false)
      if (error) setMessage(error.message)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const { data, error } = signup
        ? await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : await supabase!.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (signup && !data.session) setMessage('메일의 확인 링크를 누른 후 로그인해주세요.')
      setPassword('')
    } catch (error) { setMessage(error instanceof Error ? error.message : '인증에 실패했습니다.') }
    finally { setBusy(false) }
  }
  if (!supabase) return children
  if (loading) return <div className="auth-screen">로그인 상태 확인 중…</div>
  if (session) return <div key={session.user.id}>{children}</div>
  return <main className="auth-screen"><section className="auth-box"><p className="eyebrow">HARU · PERSONAL PLANNER</p><h1>{signup ? '내 공간 만들기' : '나의 하루에 로그인'}</h1><p>할 일과 카테고리를 안전하게 저장합니다.</p><form onSubmit={submit}><label>이메일<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>비밀번호<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><button className="submit-button" disabled={busy}>{busy ? '처리 중…' : signup ? '회원가입' : '로그인'}</button></form>{message && <p role="status">{message}</p>}<button className="text-button" disabled={busy} onClick={() => { setSignup(!signup); setMessage('') }}>{signup ? '이미 계정이 있어요 · 로그인' : '처음인가요? · 회원가입'}</button></section></main>
}
