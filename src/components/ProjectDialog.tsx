import { useState } from 'react'
import { Button, Dialog, Field, Input } from './ui'

export interface ProjectValues {
  name: string
  language: string
}

function Form({ initial, submitLabel, onSubmit }: { initial?: ProjectValues; submitLabel: string; onSubmit: (v: ProjectValues) => void }) {
  const [v, setV] = useState<ProjectValues>(initial ?? { name: '', language: '' })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (v.name.trim()) onSubmit({ name: v.name.trim(), language: v.language.trim() })
      }}
    >
      <Field label="Project name">
        <Input autoFocus required value={v.name} placeholder="e.g. Space Shooter" onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field label="Language">
        <Input value={v.language} placeholder="e.g. Scratch, Python" onChange={(e) => setV({ ...v, language: e.target.value })} />
      </Field>
      <Button type="submit" variant="primary" className="w-full">{submitLabel}</Button>
    </form>
  )
}

/** Add or edit a project. The form remounts each time the dialog opens, so it always starts from `initial`. */
export function ProjectDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: ProjectValues
  onSubmit: (v: ProjectValues) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={initial ? 'Edit project' : 'Add project'}>
      <Form initial={initial} submitLabel={initial ? 'Save' : 'Add project'} onSubmit={onSubmit} />
    </Dialog>
  )
}
