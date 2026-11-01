'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { SpaceListingItem } from '@/lib/learning-space-listing'

const linkStyle = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2'
export function MySpacesView({ spaces, status, retry }: { spaces: SpaceListingItem[]; status: 'loading' | 'error' | 'ready'; retry(): void }) {
  return <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard" className="rounded text-purple-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">← Bảng điều khiển</Link>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold text-gray-900">Không gian của tôi</h1><Link href="/learning/new" className={linkStyle}>Tạo không gian</Link></div>
    {status === 'loading' && <p role="status" className="mt-6">Đang tải không gian...</p>}
    {status === 'error' && <div role="alert" className="mt-6"><p>Không thể tải không gian. Vui lòng thử lại.</p><button type="button" onClick={retry} className={`${linkStyle} mt-3`}>Thử lại</button></div>}
    {status === 'ready' && (spaces.length === 0 ? <div className="mt-6 rounded-xl bg-white p-6 shadow-sm"><p>Bạn chưa có không gian học tập nào.</p><Link href="/learning/new" className={`${linkStyle} mt-4`}>Tạo không gian</Link></div> : <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">{spaces.map(space => <li key={space.id} className="min-w-0 rounded-xl bg-white p-6 shadow-sm"><h2 className="break-words text-xl font-semibold text-gray-900">{space.title}</h2><p className="mt-2 break-words text-gray-700">Kỹ năng chính: {space.primarySkillName}</p>{space.partnerName && <p className="mt-1 break-words text-gray-700">Bạn học: {space.partnerName}</p>}<p className="mt-3 text-sm font-medium">{space.state === 'ARCHIVED' ? 'Đã lưu trữ · Chỉ xem' : 'Đang hoạt động'}</p><Link href={`/learning/${encodeURIComponent(space.id)}`} className={`${linkStyle} mt-4`}>Mở không gian<span className="sr-only"> {space.title}</span></Link></li>)}</ul>)}
  </div></main>
}
export function MySpaces() {
  const [spaces, setSpaces] = useState<SpaceListingItem[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const response = await fetch('/api/learning/spaces', { cache: 'no-store' })
      if (!response.ok) throw new Error('Request failed')
      const data = await response.json()
      if (!Array.isArray(data.spaces)) throw new Error('Invalid response')
      setSpaces(data.spaces); setStatus('ready')
    } catch { setStatus('error') }
  }, [])
  useEffect(() => { void load() }, [load])
  return <MySpacesView spaces={spaces} status={status} retry={load} />
}
