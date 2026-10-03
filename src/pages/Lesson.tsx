import { ArrowLeft, Check, Lock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ActivitySection } from '../components/ActivitySection'
import { JotRail } from '../components/JotRail'
import { NotePanel } from '../components/NotePanel'
import { NoteSummary } from '../components/NoteSummary'
import { ProjectDialog } from '../components/ProjectDialog'
import { Button, ConfirmDialog, EmptyState, Input, Select, Textarea } from '../components/ui'
import { clock, fmtDate } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../store'
import type { Lesson } from '../types'

export function LessonPage({ id, view }: { id: string; view: 'capture' | 'note' }) {
  const { data, updateLesson, deleteLesson, addProject, saved } = useStore()
  const lesson = data.lessons.find((l) => l.id === id)
  const student = data.students.find((s) => s.id === lesson?.studentId)
  const [newProject, setNewProject] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!lesson || !student)
    return <EmptyState title="Lesson not found" body="It may have been deleted." action={<Button onClick={() => navigate('/')}>Back to dashboard</Button>} />

  const patch = (p: Partial<Lesson>) => updateLesson(id, p)
  const projects = data.projects.filter((p) => p.studentId === student.id && (p.status === 'active' || p.id === lesson.projectId))
  const previous = data.lessons
    .filter((l) => l.studentId === student.id && l.id !== id && l.date <= lesson.date && l.nextPlan.trim())
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  const deleteButton = (
    <div className="border-t border-line pt-4">
      <Button variant="danger" onClick={() => setConfirmDelete(true)}>
        <Trash2 size={16} /> Delete lesson
      </Button>
    </div>
  )

  const TABS = [
    { view: 'capture' as const, label: 'Lesson', to: `/lessons/${id}` },
    { view: 'note' as const, label: 'Note', to: `/lessons/${id}/note` },
  ]

  return (
    <>
      <a href={`#/students/${student.id}`} className="mb-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg md:min-h-0 md:mb-3">
        <ArrowLeft size={14} /> {student.firstName}
      </a>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Lesson with {student.firstName}</h1>
          <p className="mt-1 text-sm text-muted">
            {fmtDate(lesson.date)} · <span className="font-mono">Saved {clock(saved.at)} · stored on this device</span>
          </p>
        </div>
        <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:max-w-full sm:min-w-0">
          <label className="col-span-2 block min-w-0 sm:col-span-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">Project</span>
            <Select
              aria-label="Project"
              className="sm:w-auto sm:min-w-48 sm:max-w-full"
              value={lesson.projectId ?? ''}
              onChange={(e) => (e.target.value === '__new' ? setNewProject(true) : patch({ projectId: e.target.value || null }))}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.language ? ` (${p.language})` : ''}</option>
              ))}
              <option value="__new">＋ Add project…</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">Date</span>
            <Input type="date" aria-label="Lesson date" value={lesson.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} className="sm:w-auto" />
          </label>
        </div>
      </div>

      <nav aria-label="Lesson views" className="mb-6 flex items-center gap-1 border-b border-line">
        {TABS.map((t) => (
          <a
            key={t.view}
            href={`#${t.to}`}
            aria-current={view === t.view ? 'page' : undefined}
            className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold md:min-h-10 ${view === t.view ? 'border-ink' : 'border-transparent text-muted hover:text-fg'}`}
          >
            {t.label}
            {t.view === 'note' && lesson.noteWritten && <Check size={14} aria-label="Note written" />}
          </a>
        ))}
      </nav>

      {view === 'note' ? (
        <div className="max-w-3xl space-y-8">
          <NotePanel student={student} lesson={lesson} onChange={patch} />
          {deleteButton}
        </div>
      ) : (
        <>
          {previous && (
            <p className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm">
              <span className="font-semibold">Last plan ({fmtDate(previous.date)}):</span> {previous.nextPlan}
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <ActivitySection
                id="warmup"
                title="Warmup"
                activity={lesson.warmup}
                onChange={(warmup) => patch({ warmup })}
                namePlaceholder="e.g. Fix the broken maze script"
                detailsLabel="How did it go?"
                detailsPlaceholder="Did they struggle or breeze through? Anything notable."
              />
              <ActivitySection
                id="main"
                title="Main activity"
                activity={lesson.main}
                onChange={(main) => patch({ main })}
                namePlaceholder="e.g. Add enemy spawning to the game"
                detailsLabel="Progress and struggles"
                detailsPlaceholder="What progress was made? Which parts were hard?"
              />
              <section aria-labelledby="next" className="rounded-lg border border-line bg-surface p-5">
                <h2 id="next" className="mb-3 text-xl font-semibold">Plan for next week</h2>
                <Textarea value={lesson.nextPlan} placeholder="What will we work on next?" aria-labelledby="next" onChange={(e) => patch({ nextPlan: e.target.value })} />
              </section>
              <section aria-labelledby="private" className="hatch rounded-lg border border-private-line bg-private-bg p-5 text-private-fg focus-within:ring-2 focus-within:ring-private-fg">
                <h2 id="private" className="flex items-center gap-2 text-xl font-semibold"><Lock size={18} aria-hidden />Private notes</h2>
                <p className="mb-3 text-sm">Private, only you see this. Never copied or exported to the note.</p>
                <Textarea
                  value={lesson.privateNotes}
                  aria-labelledby="private"
                  placeholder="Behavior, handoff notes for another instructor, things to review (optional)"
                  className="!border-private-line !bg-private-bg !text-private-fg placeholder:!text-private-fg focus-visible:!outline-private-fg"
                  onChange={(e) => patch({ privateNotes: e.target.value })}
                />
              </section>
              {deleteButton}
            </div>
            {/* On phones the jots come first (the in-lesson action) and the note summary last; from lg up both sit in a sticky rail. */}
            <aside aria-label="Quick capture and note" className="contents lg:sticky lg:top-6 lg:block lg:space-y-4 lg:self-start">
              <div className="max-lg:order-first"><JotRail lesson={lesson} patch={patch} /></div>
              <NoteSummary student={student} lesson={lesson} />
            </aside>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this lesson?"
        description="The lesson and its note are removed. This can't be undone."
        confirmLabel="Delete lesson"
        onConfirm={() => {
          deleteLesson(id)
          navigate(`/students/${student.id}`)
        }}
      />
      <ProjectDialog
        open={newProject}
        onOpenChange={setNewProject}
        onSubmit={(v) => {
          patch({ projectId: addProject(student.id, v) })
          setNewProject(false)
        }}
      />
    </>
  )
}
