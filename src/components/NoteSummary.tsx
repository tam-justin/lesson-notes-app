import { ArrowRight, Check } from 'lucide-react'
import { resolveNote } from '../lib/note'
import type { Lesson, Student } from '../types'

/** A live, read-only view of the note on the Lesson tab, so you can see what the lesson has produced so far. */
export function NoteSummary({ student, lesson }: { student: Pick<Student, 'firstName'>; lesson: Lesson }) {
  const note = resolveNote(student, lesson)
  return (
    <section aria-labelledby="note-summary" className="rounded-lg border border-line bg-surface p-4">
      <h2 id="note-summary" className="mb-2 text-lg font-semibold">Parent note</h2>
      <ul className="space-y-3">
        {note.map((s) => (
          <li key={s.heading}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              {s.body.trim() ? <Check size={12} aria-label="Filled in" /> : <span aria-label="Blank" className="inline-block size-3 rounded-full border border-line" />}
              {s.heading}
            </p>
            <p className={`mt-0.5 line-clamp-3 text-sm ${s.body.trim() ? '' : 'text-muted'}`}>{s.body.trim() || 'Nothing yet'}</p>
          </li>
        ))}
      </ul>
      <a href={`#/lessons/${lesson.id}/note`} className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline md:min-h-9">
        Review, polish and copy <ArrowRight size={14} aria-hidden />
      </a>
    </section>
  )
}
