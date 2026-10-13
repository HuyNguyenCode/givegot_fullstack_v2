'use client'

import { useEffect, useState } from 'react'
import { History, NotebookPen } from 'lucide-react'
import { LearningResources, type LearningResourceView } from '@/components/learning/LearningResources'
import { LearningSubmissions } from '@/components/learning/LearningSubmissions'

type Section = 'materials' | 'tasks' | 'notes' | 'history'
const sections: Array<{ id: Section; label: string }> = [
  { id: 'materials', label: 'Tài liệu' },
  { id: 'tasks', label: 'Công việc & bài nộp' },
  { id: 'notes', label: 'Ghi chú' },
  { id: 'history', label: 'Lịch sử' },
]
function sectionFromHash(): Section {
  const hash = window.location.hash.slice(1)
  return sections.find(section => section.id === hash)?.id ?? 'materials'
}
function Placeholder({ kind }: { kind: 'notes' | 'history' }) {
  const notes = kind === 'notes'
  const Icon = notes ? NotebookPen : History
  const title = notes ? 'Ghi chú' : 'Lịch sử'
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby={`${kind}-heading`}>
    <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-purple-600" />
    <h2 id={`${kind}-heading`} className="text-base font-semibold text-slate-900">{title}</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">{notes ? 'Ghi chú và phần tóm tắt chung sẽ xuất hiện tại đây.' : 'Hoạt động học tập có cấu trúc sẽ xuất hiện tại đây.'}</p>
    <p className="mt-3 text-xs font-medium text-slate-500">Sắp có trong Learning Hub</p>
  </section>
}
export function LearningSpaceSections({ spaceId, viewerId, archived, resources, quota, topics }: {
  spaceId: string; viewerId: string; archived: boolean; resources: LearningResourceView[];
  quota: { usedBytes: string; maxBytes: string };
  topics: Array<{ id: string; label: string; state: 'ACTIVE' | 'ARCHIVED' }>
}) {
  const [selected, setSelected] = useState<Section>('materials')
  useEffect(() => {
    const sync = () => setSelected(sectionFromHash())
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return <div className="mt-6 min-w-0">
    <nav aria-label="Các phần LearningSpace" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {sections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={selected === section.id ? 'page' : undefined} onClick={() => setSelected(section.id)} className={`flex min-h-11 min-w-0 items-center justify-center rounded-xl border px-2 py-2 text-center text-sm font-semibold leading-snug break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 ${selected === section.id ? 'border-purple-700 bg-purple-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-purple-50'}`}>{section.label}</a>)}
    </nav>
    <div id="materials" hidden={selected !== 'materials'}><LearningResources spaceId={spaceId} resources={resources} quota={quota} topics={topics} archived={archived} /></div>
    <div id="tasks" hidden={selected !== 'tasks'} className="mt-4 min-w-0"><LearningSubmissions spaceId={spaceId} viewerId={viewerId} archived={archived} /></div>
    <div id="notes" hidden={selected !== 'notes'} className="mt-4"><Placeholder kind="notes" /></div>
    <div id="history" hidden={selected !== 'history'} className="mt-4"><Placeholder kind="history" /></div>
  </div>
}
