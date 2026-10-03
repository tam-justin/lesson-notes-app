import { useState } from 'react'
import { clock } from '../lib/format'
import { uid } from '../lib/ids'
import type { Lesson } from '../types'
import { Input } from './ui'

type Target = 'warmup' | 'main' | 'next'

const TARGET_LABEL: Record<Target, string> = { warmup: 'Warmup', main: 'Main', next: 'Next week' }

/** Timestamped one-liners captured during the lesson, which can be sent into a section afterward. */
export function JotRail({ lesson, patch }: { lesson: Lesson; patch: (p: Partial<Lesson>) => void }) {
  const [text, setText] = useState('')
  const [freshId, setFresh] = useState('')

  const add = () => {
    const t = text.trim()
    if (!t) return
    const j = { id: uid(), at: Date.now(), text: t }
    patch({ jots: [j, ...lesson.jots] })
    setFresh(j.id)
    setText('')
  }

  const send = (jotId: string, to: Target) => {
    const j = lesson.jots.find((x) => x.id === jotId)
    if (!j) return
    const join = (s: string) => (s.trim() ? `${s.trim()} ${j.text}` : j.text)
    const rest = lesson.jots.filter((x) => x.id !== jotId)
    if (to === 'warmup') patch({ jots: rest, warmup: { ...lesson.warmup, details: join(lesson.warmup.details) } })
    else if (to === 'main') patch({ jots: rest, main: { ...lesson.main, details: join(lesson.main.details) } })
    else patch({ jots: rest, nextPlan: join(lesson.nextPlan) })
  }

  return (
    <section aria-labelledby="jots" className="rounded-lg border border-line bg-surface p-4">
      <h2 id="jots" className="mb-2 text-lg font-semibold">Quick jots</h2>
      <Input
        value={text}
        placeholder="Jot a quick note"
        aria-label="Quick jot"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
      />
      <p className="mt-1 text-xs text-muted">Press Enter to add it with the time.</p>
      <ul className="mt-3 space-y-2" aria-live="polite">
        {lesson.jots.map((j) => (
          <li key={j.id} className={`rounded-md border border-line p-2.5 text-sm ${j.id === freshId ? 'jot-new' : ''}`}>
            <p><span className="mr-2 font-mono text-xs text-muted">{clock(j.at)}</span>{j.text}</p>
            <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
              {(['warmup', 'main', 'next'] as const).map((t) => (
                <button key={t} className="min-h-11 rounded-sm px-3 font-medium text-muted hover:bg-surface-2 hover:text-fg md:min-h-8 md:px-2" onClick={() => send(j.id, t)}>
                  → {TARGET_LABEL[t]}
                </button>
              ))}
              <button className="ml-auto min-h-11 rounded-sm px-3 text-muted hover:bg-surface-2 hover:text-danger md:min-h-8 md:px-2" onClick={() => patch({ jots: lesson.jots.filter((x) => x.id !== j.id) })}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
