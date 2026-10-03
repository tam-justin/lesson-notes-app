import { useRef } from 'react'
import { RATING_LABELS, type Rating } from '../types'

const LEVELS: Rating[] = [1, 2, 3, 4]

export function Glyph({ rating, size = 14 }: { rating: Rating; size?: number }) {
  const c = 7
  const r = 5.6
  const a = (2 * Math.PI * rating) / 4
  const x = c + r * Math.sin(a)
  const y = c - r * Math.cos(a)
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden style={{ color: `var(--r${rating}-glyph)` }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {rating < 4 ? (
        <path d={`M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${rating > 2 ? 1 : 0} 1 ${x} ${y} Z`} fill="currentColor" />
      ) : (
        <>
          <circle cx={c} cy={c} r={r + 0.7} fill="currentColor" />
          <path d="M4.3 7.2l2 2 3.5-4" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

const chipStyle = (r: Rating) => ({
  background: `var(--r${r}-bg)`,
  color: `var(--r${r}-fg)`,
  borderColor: `color-mix(in srgb, var(--r${r}-glyph) 35%, transparent)`,
})

export function RatingChip({ rating, compact }: { rating: Rating; compact?: boolean }) {
  return (
    <span
      title={RATING_LABELS[rating]}
      role={compact ? 'img' : undefined}
      aria-label={compact ? RATING_LABELS[rating] : undefined}
      className={`inline-flex items-center gap-1.5 rounded-sm border text-xs font-medium ${compact ? 'size-7 justify-center' : 'h-6 px-2'}`}
      style={chipStyle(rating)}
    >
      <Glyph rating={rating} />
      {!compact && RATING_LABELS[rating]}
    </span>
  )
}

export function RatingPicker({
  value,
  onChange,
  label,
}: {
  value: Rating
  onChange: (r: Rating) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (to: number) => {
    const next = (((to - 1 + 4) % 4) + 1) as Rating
    onChange(next)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[next - 1]?.focus()
  }
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-1.5"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(value + 1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(value - 1)
        } else if (/^[1-4]$/.test(e.key)) move(Number(e.key))
      }}
    >
      {LEVELS.map((r) => {
        const on = r === value
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(r)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium transition-transform duration-200 md:min-h-8"
            style={{
              ...(on
                ? { ...chipStyle(r), boxShadow: `0 0 0 2px var(--r${r}-glyph)`, transform: 'scale(1.02)' }
                : { background: 'transparent', color: 'var(--fg-muted)', borderColor: 'var(--border)' }),
            }}
          >
            <Glyph rating={r} />
            {RATING_LABELS[r]}
          </button>
        )
      })}
    </div>
  )
}
