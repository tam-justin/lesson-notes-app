export type Rating = 1 | 2 | 3 | 4

export const RATING_LABELS: Record<Rating, string> = {
  1: 'Struggled',
  2: 'Needed support',
  3: 'Independent',
  4: 'Breezed through',
}

export interface ConceptEntry {
  id: string
  name: string
  rating: Rating
  comment: string
}

export interface Activity {
  name: string
  concepts: ConceptEntry[]
  details: string
}

export interface Jot {
  id: string
  at: number
  text: string
}

export interface NoteSection {
  heading: string
  body: string
}

/** A hand-edited (or AI-polished) note section. `baseline` is the generated text it was derived from. */
export interface NoteEdit {
  text: string
  baseline: string
}

export interface Lesson {
  id: string
  studentId: string
  projectId: string | null
  date: string
  startedAt: number
  warmup: Activity
  main: Activity
  nextPlan: string
  privateNotes: string
  jots: Jot[]
  noteEdits: Record<string, NoteEdit>
  noteWritten: boolean
}

export interface Student {
  id: string
  firstName: string
  createdAt: number
}

export interface Project {
  id: string
  studentId: string
  name: string
  language: string
  status: 'active' | 'done'
  createdAt: number
}

export type Theme = 'system' | 'light' | 'dark'

export interface AppData {
  version: 2
  students: Student[]
  projects: Project[]
  lessons: Lesson[]
  theme: Theme
  lastBackup: number | null
}
