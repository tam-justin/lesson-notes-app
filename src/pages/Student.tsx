import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProjectDialog } from '../components/ProjectDialog'
import { Glyph, RatingChip } from '../components/Rating'
import { Avatar, Button, ConfirmDialog, Dialog, EmptyState, PageHeader, Select } from '../components/ui'
import { fmtDate } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../store'
import { RATING_LABELS, type Project, type Rating } from '../types'
import { StudentForm } from './Students'

type Tab = 'timeline' | 'concepts' | 'projects'

export function StudentPage({ id }: { id: string }) {
  const { data, updateStudent, deleteStudent, addProject, updateProject, deleteProject, createLesson } = useStore()
  const student = data.students.find((s) => s.id === id)
  const [tab, setTab] = useState<Tab>('timeline')
  const [filter, setFilter] = useState('')
  const [edit, setEdit] = useState(false)
  const [del, setDel] = useState(false)
  const [projectDialog, setProjectDialog] = useState<{ project?: Project } | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  const projects = useMemo(() => data.projects.filter((p) => p.studentId === id), [data.projects, id])
  const projectName = (pid: string | null) => projects.find((p) => p.id === pid)?.name

  const allLessons = useMemo(
    () => data.lessons.filter((l) => l.studentId === id).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt),
    [data.lessons, id],
  )
  const lessons = filter ? allLessons.filter((l) => l.projectId === filter) : allLessons

  const grid = useMemo(() => {
    const recent = lessons.slice(-6)
    const rows = new Map<string, { name: string; cells: (Rating | null)[] }>()
    recent.forEach((l, i) => {
      for (const c of [...l.warmup.concepts, ...l.main.concepts]) {
        const k = c.name.trim().toLowerCase()
        const row = rows.get(k) ?? { name: c.name, cells: recent.map(() => null) }
        row.cells[i] = c.rating
        rows.set(k, row)
      }
    })
    return { recent, rows: [...rows.values()] }
  }, [lessons])

  if (!student) return <EmptyState title="Student not found" body="They may have been deleted." action={<Button onClick={() => navigate('/students')}>Back to students</Button>} />

  const active = projects.filter((p) => p.status === 'active')

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={student.firstName} size={56} />
        <div className="flex-1">
          <PageHeader title={student.firstName} sub={active.map((p) => p.name).join(', ') || 'No active project'} />
        </div>
      </div>
      <div className="-mt-4 mb-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => navigate(`/lessons/${createLesson(id)}`)}><Plus size={16} />New lesson</Button>
        {projects.length === 0 && <Button onClick={() => setProjectDialog({})}><Plus size={16} />Add project</Button>}
        <Button onClick={() => setEdit(true)}><Pencil size={16} />Edit</Button>
        <Button variant="danger" onClick={() => setDel(true)}><Trash2 size={16} />Delete</Button>
      </div>

      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-line">
        <nav aria-label="Student views" className="flex gap-1">
          {(['timeline', 'concepts', 'projects'] as const).map((t) => (
            <button
              key={t}
              aria-current={tab === t ? 'page' : undefined}
              onClick={() => setTab(t)}
              className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold capitalize md:min-h-10 ${tab === t ? 'border-ink' : 'border-transparent text-muted hover:text-fg'}`}
            >
              {t}
            </button>
          ))}
        </nav>
        {tab !== 'projects' && projects.length > 0 && (
          <Select aria-label="Filter by project" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-1 w-auto max-w-full">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
      </div>

      {tab === 'projects' ? (
        <>
          <div className="mb-3">
            <Button onClick={() => setProjectDialog({})}><Plus size={16} />Add project</Button>
          </div>
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" body={`Add what ${student.firstName} is building, like a game in Scratch or a Python app. You can pick one on each lesson.`} />
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => {
                const count = allLessons.filter((l) => l.projectId === p.id).length
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-4">
                    {/* min-w-full on phones puts the buttons on their own row instead of squeezing the name. */}
                    <div className="min-w-full flex-1 sm:min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted">
                        {[p.language, `${count} ${count === 1 ? 'lesson' : 'lessons'}`, p.status === 'done' ? 'Finished' : 'In progress'].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Button onClick={() => setProjectDialog({ project: p })}>Edit</Button>
                    <Button onClick={() => updateProject(p.id, { status: p.status === 'done' ? 'active' : 'done' })}>
                      {p.status === 'done' ? 'Reopen' : 'Mark finished'}
                    </Button>
                    <Button
                      variant="danger"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setProjectToDelete(p)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : lessons.length === 0 ? (
        <EmptyState title={`No lessons yet for ${student.firstName}`} body="Start a lesson to begin tracking progress." />
      ) : tab === 'timeline' ? (
        <ol className="space-y-3">
          {[...lessons].reverse().map((l) => (
            <li key={l.id}>
              <a href={`#/lessons/${l.id}`} className="block rounded-lg border border-line bg-surface p-4 hover:bg-surface-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted">{fmtDate(l.date)}{projectName(l.projectId) ? ` · ${projectName(l.projectId)}` : ''}</span>
                  <span className={`rounded-sm border px-2 py-0.5 text-xs font-semibold ${l.noteWritten ? 'border-transparent bg-surface-2 text-muted' : 'border-hilite bg-hilite-soft'}`}>
                    {l.noteWritten ? 'Note written' : 'Note to write'}
                  </span>
                </div>
                <p className="font-semibold">{l.main.name || 'Untitled main activity'}</p>
                {l.warmup.name && <p className="text-sm text-muted">Warmup: {l.warmup.name}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...l.warmup.concepts, ...l.main.concepts].map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 rounded-sm border border-line px-1.5 py-0.5 text-xs">
                      <Glyph rating={c.rating} />{c.name}
                      <span className="sr-only">: {RATING_LABELS[c.rating]}</span>
                    </span>
                  ))}
                </div>
              </a>
            </li>
          ))}
        </ol>
      ) : grid.rows.length === 0 ? (
        <EmptyState title="No concepts yet" body="Tag concepts during a lesson to see progress build over time." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">Concept ratings over the last {grid.recent.length} lessons</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th className="px-4 py-2 font-semibold">Concept</th>
                {grid.recent.map((l) => <th key={l.id} className="px-2 py-2 text-center font-mono font-normal">{fmtDate(l.date).replace(/, \d{4}$/, '')}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((r) => (
                <tr key={r.name} className="border-b border-line last:border-0">
                  <th scope="row" className="sticky left-0 whitespace-nowrap bg-surface px-4 py-2 text-left font-medium">{r.name}</th>
                  {r.cells.map((c, i) => (
                    <td key={i} className="px-2 py-2 text-center">
                      {c ? <RatingChip rating={c} compact /> : <span className="text-muted" aria-label="Not covered">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            {([1, 2, 3, 4] as Rating[]).map((r) => RATING_LABELS[r]).join(' → ')}
          </p>
        </div>
      )}

      <Dialog open={edit} onOpenChange={setEdit} title="Edit student">
        <StudentForm
          initial={student}
          submitLabel="Save"
          onSubmit={(v) => {
            updateStudent(id, v)
            setEdit(false)
          }}
        />
      </Dialog>
      <ProjectDialog
        open={projectDialog !== null}
        onOpenChange={(o) => !o && setProjectDialog(null)}
        initial={projectDialog?.project}
        onSubmit={(v) => {
          if (projectDialog?.project) updateProject(projectDialog.project.id, v)
          else addProject(id, v)
          setProjectDialog(null)
        }}
      />
      <ConfirmDialog
        open={projectToDelete !== null}
        onOpenChange={(o) => !o && setProjectToDelete(null)}
        title={`Delete "${projectToDelete?.name ?? ''}"?`}
        description="Its lessons are kept but will have no project."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (!projectToDelete) return
          deleteProject(projectToDelete.id)
          if (filter === projectToDelete.id) setFilter('')
        }}
      />
      <Dialog open={del} onOpenChange={setDel} title={`Delete ${student.firstName}?`} description={`This also deletes ${allLessons.length} lesson${allLessons.length === 1 ? '' : 's'} and ${projects.length} project${projects.length === 1 ? '' : 's'}. This can't be undone.`}>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setDel(false)}>Cancel</Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={() => {
              deleteStudent(id)
              navigate('/students')
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  )
}
