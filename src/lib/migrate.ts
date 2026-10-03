import type {
  Activity, AppData, ConceptEntry, Jot, Lesson, NoteEdit, NoteSection, Project, Rating, Student, Theme,
} from '../types'
import { today, uid } from './ids'
import { templateNote } from './note'

export const EMPTY: AppData = { version: 2, students: [], projects: [], lessons: [], theme: 'system', lastBackup: null }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const records = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])
const isRating = (v: unknown): v is Rating => v === 1 || v === 2 || v === 3 || v === 4

/** Keeps the first record for each id, dropping entries with no usable id. */
function byId<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((i) => i.id && !seen.has(i.id) && !!seen.add(i.id))
}

const concepts = (v: unknown): ConceptEntry[] =>
  records(v)
    .map((c) => ({ id: str(c.id) || uid(), name: str(c.name), rating: isRating(c.rating) ? c.rating : (3 as Rating), comment: str(c.comment) }))
    .filter((c) => c.name.trim())

const activity = (v: unknown): Activity => {
  const a = isObj(v) ? v : {}
  return { name: str(a.name), concepts: concepts(a.concepts), details: str(a.details) }
}

const jots = (v: unknown): Jot[] =>
  records(v).map((j) => ({ id: str(j.id) || uid(), at: num(j.at, 0), text: str(j.text) })).filter((j) => j.text)

const noteEdits = (v: unknown): Record<string, NoteEdit> => {
  const out: Record<string, NoteEdit> = {}
  if (isObj(v)) {
    for (const [heading, e] of Object.entries(v)) {
      if (isObj(e) && typeof e.text === 'string') out[heading] = { text: e.text, baseline: str(e.baseline) }
    }
  }
  return out
}

const THEMES: Theme[] = ['system', 'light', 'dark']

/**
 * Turns untrusted v2-shaped data (an import, or whatever is in storage) into data the UI can render without
 * crashing: wrong types get defaults, broken records are dropped, and references to missing records are cleared.
 */
function sanitize(raw: Obj): AppData {
  const students = byId(
    records(raw.students).map((s): Student => ({ id: str(s.id), firstName: str(s.firstName) || 'Student', createdAt: num(s.createdAt, 0) })),
  )
  const studentIds = new Set(students.map((s) => s.id))

  const projects = byId(
    records(raw.projects)
      .map((p): Project => ({
        id: str(p.id),
        studentId: str(p.studentId),
        name: str(p.name) || 'Project',
        language: str(p.language),
        status: p.status === 'done' ? 'done' : 'active',
        createdAt: num(p.createdAt, 0),
      }))
      .filter((p) => studentIds.has(p.studentId)),
  )
  const projectStudent = new Map(projects.map((p) => [p.id, p.studentId]))

  const lessons = byId(
    records(raw.lessons)
      .map((l): Lesson => {
        const studentId = str(l.studentId)
        const projectId = str(l.projectId)
        return {
          id: str(l.id),
          studentId,
          projectId: projectStudent.get(projectId) === studentId ? projectId : null,
          date: /^\d{4}-\d{2}-\d{2}$/.test(str(l.date)) ? str(l.date) : today(),
          startedAt: num(l.startedAt, 0),
          warmup: activity(l.warmup),
          main: activity(l.main),
          nextPlan: str(l.nextPlan),
          privateNotes: str(l.privateNotes),
          jots: jots(l.jots),
          noteEdits: noteEdits(l.noteEdits),
          noteWritten: l.noteWritten === true,
        }
      })
      .filter((l) => studentIds.has(l.studentId)),
  )

  return {
    version: 2,
    students,
    projects,
    lessons,
    theme: THEMES.includes(raw.theme as Theme) ? (raw.theme as Theme) : 'system',
    lastBackup: typeof raw.lastBackup === 'number' ? raw.lastBackup : null,
  }
}

interface V1Student {
  id: string
  firstName: string
  createdAt: number
  project?: string
  language?: string
}
interface V1Lesson extends Omit<Lesson, 'noteEdits' | 'projectId'> {
  note?: NoteSection[] | null
}

/** v1 kept project and language on the student, and stored notes as full snapshots. */
function fromV1(raw: Obj): Obj {
  const projects: Project[] = []
  const projectByStudent = new Map<string, string>()
  const students = records(raw.students).map((s) => {
    const { project, language, ...rest } = s as unknown as V1Student
    if (project?.trim() || language?.trim()) {
      const id = uid()
      projects.push({
        id,
        studentId: rest.id,
        name: project?.trim() || 'Project',
        language: language?.trim() ?? '',
        status: 'active',
        createdAt: num(rest.createdAt, 0),
      })
      projectByStudent.set(rest.id, id)
    }
    return rest
  })

  const lessons = records(raw.lessons).map((l) => {
    const { note, ...rest } = l as unknown as V1Lesson
    const student = students.find((s) => s.id === rest.studentId)
    const edits: Record<string, NoteEdit> = {}
    const base = { ...rest, projectId: projectByStudent.get(rest.studentId) ?? null, noteEdits: edits } as Lesson
    if (Array.isArray(note) && student) {
      // Only keep sections the user actually changed; untouched ones are regenerated from the lesson.
      const generated = templateNote(student, sanitize({ students: [student], lessons: [base] }).lessons[0] ?? base)
      for (const sec of note) {
        const g = generated.find((x) => x.heading === sec.heading)
        if (g && typeof sec.body === 'string' && sec.body !== g.body) edits[sec.heading] = { text: sec.body, baseline: g.body }
      }
    }
    return base
  })

  return { ...raw, students, projects, lessons }
}

/** Accepts saved or imported data of any known version and returns safe, current-shape data. */
export function migrate(raw: unknown): AppData {
  if (!isObj(raw)) return EMPTY
  return sanitize(raw.version === 2 ? raw : fromV1(raw))
}
