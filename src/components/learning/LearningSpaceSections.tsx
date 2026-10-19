'use client'

import { useEffect, useState } from 'react'
import { LearningResources, type LearningResourceView } from '@/components/learning/LearningResources'
import { LearningSubmissions } from '@/components/learning/LearningSubmissions'
import { LearningNotes } from '@/components/learning/LearningNotes'
import { LearningActivity } from '@/components/learning/LearningActivity'

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
export function LearningSpaceSections({ spaceId, viewerId, archived, resources, quota, topics, bookings }: {
  spaceId: string; viewerId: string; archived: boolean; resources: LearningResourceView[];
  quota: { usedBytes: string; maxBytes: string };
  topics: Array<{ id: string; label: string; state: 'ACTIVE' | 'ARCHIVED' }>; bookings: Array<{ id: string; endTime: Date; status: string }>
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
    <div id="notes" hidden={selected !== 'notes'} className="mt-4"><LearningNotes spaceId={spaceId} viewerId={viewerId} archived={archived} bookings={bookings} /></div>
    <div id="history" hidden={selected !== 'history'} className="mt-4"><LearningActivity spaceId={spaceId} /></div>
  </div>
}
