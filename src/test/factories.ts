import type { ConceptEntry, Lesson, Project, Rating, Student } from '../types'

export const student = (over: Partial<Student> = {}): Student => ({
  id: 's1', firstName: 'Maya', createdAt: 0, ...over,
})

export const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1', studentId: 's1', name: 'Space Shooter', language: 'Scratch', status: 'active', createdAt: 0, ...over,
})

export const concept = (name: string, rating: Rating, comment = ''): ConceptEntry => ({
  id: name, name, rating, comment,
})

export const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: 'l1',
  studentId: 's1',
  projectId: null,
  date: '2026-10-02',
  startedAt: 0,
  warmup: { name: '', concepts: [], details: '' },
  main: { name: '', concepts: [], details: '' },
  nextPlan: '',
  privateNotes: '',
  jots: [],
  noteEdits: {},
  noteWritten: false,
  ...over,
})
