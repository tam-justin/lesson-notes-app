import type { Activity } from '../types'
import { ConceptEditor } from './ConceptEditor'
import { Field, Input, Textarea } from './ui'

/** One activity (warmup or main): its name, rated concepts, and free-text details. */
export function ActivitySection({
  id,
  title,
  activity,
  onChange,
  namePlaceholder,
  detailsLabel,
  detailsPlaceholder,
}: {
  id: string
  title: string
  activity: Activity
  onChange: (a: Activity) => void
  namePlaceholder: string
  detailsLabel: string
  detailsPlaceholder: string
}) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 id={id} className="text-xl font-semibold">{title}</h2>
      <Field label="Activity">
        <Input value={activity.name} placeholder={namePlaceholder} onChange={(e) => onChange({ ...activity, name: e.target.value })} />
      </Field>
      <ConceptEditor label="Concepts covered" concepts={activity.concepts} onChange={(concepts) => onChange({ ...activity, concepts })} />
      <Field label={detailsLabel}>
        <Textarea value={activity.details} placeholder={detailsPlaceholder} onChange={(e) => onChange({ ...activity, details: e.target.value })} />
      </Field>
    </section>
  )
}
