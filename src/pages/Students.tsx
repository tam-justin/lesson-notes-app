import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Button, Dialog, EmptyState, Field, Input, PageHeader } from '../components/ui'
import { navigate } from '../lib/router'
import { usePageTitle } from '../lib/title'
import { useStore } from '../store'

export function StudentForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: { firstName: string }
  onSubmit: (v: { firstName: string }) => void
  submitLabel: string
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (firstName.trim()) onSubmit({ firstName: firstName.trim() })
      }}
    >
      <Field label="First name">
        <Input autoFocus required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" className="w-full">{submitLabel}</Button>
    </form>
  )
}

export function StudentsPage() {
  usePageTitle('Students')
  const { data, addStudent } = useStore()
  const [open, setOpen] = useState(false)
  const add = (
    <Button variant="primary" onClick={() => setOpen(true)}>
      <Plus size={16} />Add student
    </Button>
  )
  return (
    <>
      <PageHeader title="Students" actions={data.students.length ? add : undefined} />
      {data.students.length === 0 ? (
        <EmptyState title="Add your first student" body="Their lessons, projects and concept progress will show up here." action={add} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {data.students.map((s) => {
            const count = data.lessons.filter((l) => l.studentId === s.id).length
            const active = data.projects.filter((p) => p.studentId === s.id && p.status === 'active')
            return (
              <li key={s.id}>
                <a href={`#/students/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <Avatar name={s.firstName} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.firstName}</p>
                    <p className="truncate text-sm text-muted">{active.map((p) => p.name).join(', ') || 'No active project'}</p>
                  </div>
                  <span className="font-mono text-xs text-muted">{count} {count === 1 ? 'lesson' : 'lessons'}</span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Add student">
        <StudentForm
          submitLabel="Add student"
          onSubmit={(v) => {
            const id = addStudent(v)
            setOpen(false)
            navigate(`/students/${id}`)
          }}
        />
      </Dialog>
    </>
  )
}
