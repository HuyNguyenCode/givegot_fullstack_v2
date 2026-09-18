'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Copy, Link2, Users } from 'lucide-react'

type Skill = { id: string; name: string }

export function BringYourPair({ skills }: { skills: Skill[] }) {
  const [skillId, setSkillId] = useState('')
  const [objective, setObjective] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setPending(true)
    try {
      const response = await fetch('/api/learning/invites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ primarySkillId: skillId, objective: objective || null, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), maxUses: 1 }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Không thể tạo liên kết mời.')
      setInviteUrl(`${window.location.origin}/learning/invite/${result.token}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo liên kết mời.') } finally { setPending(false) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-xl">
    <Link href="/dashboard" className="text-sm font-medium text-purple-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">← Quay lại bảng điều khiển</Link>
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8" aria-labelledby="bring-your-pair-heading">
      <Users aria-hidden="true" className="h-7 w-7 text-purple-600" /><h1 id="bring-your-pair-heading" className="mt-3 text-2xl font-bold text-slate-950">Học cùng người bạn đã có</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Chọn kỹ năng chính, rồi gửi một liên kết riêng tư cho người bạn muốn học cùng.</p>
      {!inviteUrl ? <form className="mt-6 space-y-5" onSubmit={createInvite}>
        <div><label htmlFor="primary-skill" className="block text-sm font-semibold text-slate-900">Kỹ năng chính</label><select id="primary-skill" required value={skillId} onChange={event => setSkillId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"><option value="">Chọn một kỹ năng</option>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select>{!skills.length && <p className="mt-2 text-sm text-slate-600">Chưa có kỹ năng khả dụng để tạo lời mời.</p>}</div>
        <div><label htmlFor="objective" className="block text-sm font-semibold text-slate-900">Mục tiêu chung <span className="font-normal text-slate-500">(không bắt buộc)</span></label><textarea id="objective" value={objective} onChange={event => setObjective(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600" placeholder="Ví dụ: cùng hoàn thành một dự án nhỏ trong bốn tuần." /></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button type="submit" disabled={!skills.length || pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2">{pending ? 'Đang tạo liên kết…' : 'Tạo liên kết mời'} <Link2 aria-hidden="true" className="h-4 w-4" /></button>
      </form> : <div className="mt-6" aria-live="polite"><h2 className="text-lg font-semibold text-slate-950">Liên kết mời đã sẵn sàng</h2><p className="mt-2 text-sm leading-6 text-slate-600">Liên kết này chỉ dành cho một người và hết hạn sau 7 ngày.</p><div className="mt-4 break-all rounded-lg bg-slate-100 p-3 text-sm text-slate-800">{inviteUrl}</div><button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-purple-300 px-4 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"><Copy aria-hidden="true" className="h-4 w-4" />Sao chép liên kết</button></div>}
    </section>
  </div></main>
}
