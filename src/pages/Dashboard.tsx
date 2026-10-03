import { ArrowRight, Plus } from 'lucide-react'
import { Button, EmptyState, PageHeader, Avatar } from '../components/ui'
import { fmtDate } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../store'

export function Dashboard() {
  const { data, createLesson } = useStore()
  const pending = data.lessons.filter((l) => !l.noteWritten).sort((a, b) => b.date.localeCompare(a.date))
  const name = (id: string) => data.students.find((s) => s.id === id)

  const start = (studentId: string) => navigate(`/lessons/${createLesson(studentId)}`)

  return (
    <>
      <PageHeader title="Dashboard" sub="Capture during the lesson. The parent note writes itself as you go." />

      <section aria-labelledby="pending" className="mb-10">
        <h2 id="pending" className="mb-3 text-xl font-semibold">Notes to write</h2>
        {pending.length === 0 ? (
          <EmptyState
            title={data.lessons.length ? 'All caught up' : 'No lessons yet'}
            body={data.lessons.length ? 'Every lesson has notes.' : 'Start a lesson from a student below, or add your first student.'}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {pending.map((l) => {
              const s = name(l.studentId)
              return (
                <li key={l.id}>
                  <a href={`#/lessons/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Avatar name={s?.firstName ?? '?'} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s?.firstName ?? 'Unknown student'}</p>
                      <p className="truncate text-sm text-muted">
                        {[data.projects.find((p) => p.id === l.projectId)?.name, l.main.name || l.warmup.name || 'No activity named yet'].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted">{fmtDate(l.date)}</span>
                    <ArrowRight size={16} className="text-muted" aria-hidden />
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="students">
        <h2 id="students" className="mb-3 text-xl font-semibold">Start a lesson</h2>
        {data.students.length === 0 ? (
          <EmptyState
            title="Add your first student"
            body="Their lessons, projects and concept progress will show up here."
            action={<Button variant="primary" onClick={() => navigate('/students')}><Plus size={16} />Add student</Button>}
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
                <Avatar name={s.firstName} />
                <a href={`#/students/${s.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold">{s.firstName}</p>
                  <p className="truncate text-sm text-muted">
                    {data.projects.filter((p) => p.studentId === s.id && p.status === 'active').map((p) => p.name).join(', ') || 'No active project'}
                  </p>
                </a>
                <Button variant="primary" onClick={() => start(s.id)}>New lesson</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
