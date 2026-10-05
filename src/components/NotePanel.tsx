import { Check, Copy, Lock, RotateCcw, Sparkles, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  getSavedModelId, loadEngine, LOW_MEMORY_MODEL, LOW_MEMORY_NOTE, MODELS, polishSection, recommendedModelId, setModelId,
  webgpuAvailable,
} from '../lib/llm'
import {
  blankSections, requiredTerms, resolveNote, sectionFacts, toHtml, toPlain, type ResolvedSection,
} from '../lib/note'
import type { Lesson, NoteEdit, Student } from '../types'
import { Button, ConfirmDialog, Select, Textarea } from './ui'

type Format = 'rich' | 'plain'

const FORMATS: { f: Format; label: string }[] = [
  { f: 'rich', label: 'Rich text' },
  { f: 'plain', label: 'Plain text' },
]

/** The parent-facing note. It is always derived from the lesson; hand edits are kept as per-section overrides. */
export function NotePanel({
  student,
  lesson,
  onChange,
}: {
  student: Pick<Student, 'firstName'>
  lesson: Lesson
  onChange: (patch: Partial<Lesson>) => void
}) {
  const note = resolveNote(student, lesson)
  const [copied, setCopied] = useState<Format | null>(null)
  const [progress, setProgress] = useState<{ pct: number; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<Lesson['noteEdits'] | null>(null)
  // An explicit choice wins; otherwise use whatever this device's GPU can handle (decided once the adapter answers).
  const [recommended, setRecommended] = useState<string>(MODELS[0].id)
  const [chosen, setChosen] = useState<string | null>(getSavedModelId)
  const modelId = chosen ?? recommended
  useEffect(() => {
    let live = true
    recommendedModelId().then((id) => live && setRecommended(id))
    return () => {
      live = false
    }
  }, [])
  const [kept, setKept] = useState<string[]>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const copiedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])
  const canPolish = webgpuAvailable()
  const hasNote = note.some((s) => s.edited) || lesson.noteWritten
  const blanks = blankSections(note)
  // With every section blank there is nothing to polish (a multi-GB model download), copy, or mark as written.
  const empty = blanks.length === note.length

  const setEdits = (noteEdits: Lesson['noteEdits']) => onChange({ noteEdits })

  const setText = (s: ResolvedSection, text: string) => {
    const edits = { ...lesson.noteEdits }
    if (text === s.generated) delete edits[s.heading]
    else edits[s.heading] = { text, baseline: lesson.noteEdits[s.heading]?.baseline ?? s.generated }
    setEdits(edits)
  }

  const reset = (s: ResolvedSection) => {
    const edits = { ...lesson.noteEdits }
    delete edits[s.heading]
    setEdits(edits)
  }

  const keepMine = (s: ResolvedSection) =>
    setEdits({ ...lesson.noteEdits, [s.heading]: { text: s.body, baseline: s.generated } })

  const copy = async (f: Format) => {
    try {
      if (f === 'rich' && 'ClipboardItem' in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([toHtml(note)], { type: 'text/html' }),
            'text/plain': new Blob([toPlain(note)], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(toPlain(note))
      }
      setError('')
      setCopied(f)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setError('Copy was blocked by the browser. Select the text and copy it manually.')
    }
  }

  const polish = async () => {
    setError('')
    setKept([])
    setBusy(true)
    try {
      const engine = await loadEngine(modelId, (fraction, text) => setProgress({ pct: Math.round(fraction * 100), text }))
      setProgress(null)
      setUndo(lesson.noteEdits)
      const edits: Record<string, NoteEdit> = { ...lesson.noteEdits }
      const rejected: string[] = []
      for (const s of note) {
        if (!s.body.trim()) continue
        // Work from the lesson's facts. If the section was hand-edited, the edited text is the only fact.
        const facts = s.edited ? [`Instructor's draft: ${s.body.trim()}`] : sectionFacts(student, lesson, s.heading)
        const required = s.edited ? [] : requiredTerms(lesson, s.heading)
        const result = await polishSection(engine, { student: student.firstName, heading: s.heading, facts, required, modelId })
        if (result.ok) {
          edits[s.heading] = { text: result.text, baseline: s.generated }
          onChange({ noteEdits: { ...edits } })
        } else {
          rejected.push(s.heading)
        }
      }
      setKept(rejected)
    } catch (e) {
      setProgress(null)
      const low = modelId === LOW_MEMORY_MODEL ? '' : ' If it ran out of memory, close other tabs or switch to the low-memory model.'
      setError(`The AI model could not run (${e instanceof Error ? e.message : 'unknown error'}). Your draft is unchanged.${low}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">
          <Lock size={14} aria-hidden /> Private notes are not included. This draft updates as you fill in the lesson.
        </p>
        {empty ? (
          <p role="status" className="rounded-md border border-hilite bg-hilite-soft px-3 py-2 text-sm">
            Nothing to copy yet. Fill in the lesson first, or type in the sections below.
          </p>
        ) : (
          blanks.length > 0 && (
            <p role="status" className="rounded-md border border-hilite bg-hilite-soft px-3 py-2 text-sm">
              Still blank: {blanks.join(', ')}. You can still copy the note.
            </p>
          )
        )}
      </div>

      {note.map((s, i) => (
        <div key={s.heading}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 id={`note-h-${i}`} className="text-lg font-semibold">{s.heading}</h2>
            {s.edited && !s.stale && (
              <button className="inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg md:min-h-8" onClick={() => reset(s)} disabled={busy}>
                <RotateCcw size={12} aria-hidden /> Edited. Reset to generated
              </button>
            )}
          </div>
          {s.stale && (
            <div role="status" className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-hilite bg-hilite-soft px-3 py-2 text-sm">
              <span className="basis-full flex-1 sm:basis-0">The lesson changed since you edited this section.</span>
              <Button onClick={() => reset(s)} disabled={busy}>Use updated draft</Button>
              <Button variant="ghost" onClick={() => keepMine(s)} disabled={busy}>Keep mine</Button>
            </div>
          )}
          <Textarea
            aria-labelledby={`note-h-${i}`}
            className="field-sizing-content min-h-28 text-[17px]"
            value={s.body}
            disabled={busy}
            placeholder={`Nothing for "${s.heading}" yet. Fill it in on the Lesson tab, or write it here.`}
            onChange={(e) => setText(s, e.target.value)}
          />
        </div>
      ))}

      {progress && (
        <div className="rounded-md border border-line p-3 text-sm">
          <p className="mb-2 font-semibold">Downloading the AI model ({progress.pct}%)</p>
          <div role="progressbar" aria-label="Model download" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">One-time download. It stays on this device. {progress.text}</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {kept.length > 0 && (
        <p role="status" className="rounded-md border border-hilite bg-hilite-soft px-3 py-2 text-sm">
          The AI changed or dropped details in: {kept.join(', ')}. Those sections kept your draft. Try again{modelId === LOW_MEMORY_MODEL ? ', or switch to a larger model if your device can run one' : ''}.
        </p>
      )}
      {!canPolish && (
        <p className="text-sm text-muted">AI polishing needs a browser with WebGPU (recent Chrome or Edge). You can still edit the draft and copy it.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={polish} disabled={busy || !canPolish || empty} variant="primary">
          <Sparkles size={16} /> {busy ? 'Polishing…' : 'Polish with AI'}
        </Button>
        <Select
          aria-label="AI model"
          value={modelId}
          disabled={busy || !canPolish}
          onChange={(e) => (setChosen(e.target.value), setModelId(e.target.value))}
          className="w-auto min-w-0 max-w-full"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}{m.id === recommended ? ' (recommended)' : ''}</option>
          ))}
        </Select>
        {undo && (
          <Button disabled={busy} onClick={() => (setEdits(undo), setUndo(null))}>
            <Undo2 size={16} /> Undo polish
          </Button>
        )}
      </div>
      {canPolish && modelId === LOW_MEMORY_MODEL && (
        <p role="note" className="rounded-md border border-hilite bg-hilite-soft px-3 py-2 text-sm">{LOW_MEMORY_NOTE}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Copy note">
          {FORMATS.map(({ f, label }) => (
            <Button key={f} onClick={() => copy(f)} disabled={busy || empty}>
              {copied === f ? <Check size={16} /> : <Copy size={16} />}
              {copied === f ? 'Copied' : label}
            </Button>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--ink)]"
            checked={lesson.noteWritten}
            disabled={empty && !lesson.noteWritten}
            onChange={(e) => onChange({ noteWritten: e.target.checked })}
          />
          Mark note as written
        </label>
      </div>
      {hasNote && (
        <Button variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>
          <RotateCcw size={16} /> Reset note
        </Button>
      )}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        destructive={false}
        title="Reset this note?"
        description="Your edits and any polished text are removed, and the note is rebuilt from the lesson. The lesson itself is not changed."
        confirmLabel="Reset note"
        onConfirm={() => {
          onChange({ noteEdits: {}, noteWritten: false })
          setUndo(null)
          setKept([])
        }}
      />
      <span className="sr-only" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </div>
  )
}
