import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { uid } from '../lib/ids'
import { useStore } from '../store'
import type { ConceptEntry } from '../types'
import { RatingPicker } from './Rating'
import { Button, Input, Textarea } from './ui'

export function ConceptEditor({
  concepts,
  onChange,
  label,
}: {
  concepts: ConceptEntry[]
  onChange: (c: ConceptEntry[]) => void
  label: string
}) {
  const { data } = useStore()
  const [name, setName] = useState('')
  const listId = useId()
  const known = [
    ...new Set(data.lessons.flatMap((l) => [...l.warmup.concepts, ...l.main.concepts].map((c) => c.name))),
  ]

  const add = () => {
    const n = name.trim()
    if (!n) return
    onChange([...concepts, { id: uid(), name: n, rating: 3, comment: '' }])
    setName('')
  }
  const patch = (id: string, p: Partial<ConceptEntry>) =>
    onChange(concepts.map((c) => (c.id === id ? { ...c, ...p } : c)))

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      <div className="flex gap-2">
        <Input
          value={name}
          list={listId}
          placeholder="Add a concept, e.g. for loops"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <datalist id={listId}>
          {known.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <Button onClick={add} aria-label="Add concept">
          <Plus size={16} /> Add
        </Button>
      </div>
      {concepts.length > 0 && (
        <ul className="mt-3 space-y-3">
          {concepts.map((c) => (
            <li key={c.id} className="rounded-md border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">{c.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${c.name}`}
                  className="grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 md:size-8"
                  onClick={() => onChange(concepts.filter((x) => x.id !== c.id))}
                >
                  <X size={16} />
                </button>
              </div>
              <RatingPicker label={`How ${c.name} went`} value={c.rating} onChange={(rating) => patch(c.id, { rating })} />
              {/* A one-line box that grows with its text, so a long detail wraps instead of being cut off. */}
              <Textarea
                rows={1}
                className="field-sizing-content mt-2 min-h-11 resize-none md:min-h-10"
                value={c.comment}
                placeholder="Optional detail"
                aria-label={`Detail for ${c.name}`}
                onChange={(e) => patch(c.id, { comment: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
