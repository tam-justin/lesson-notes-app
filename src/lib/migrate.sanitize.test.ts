import { describe, expect, it } from 'vitest'
import { migrate } from './migrate'

const student = { id: 's1', firstName: 'Riley', createdAt: 1 }
const lesson = (over: object = {}) => ({
  id: 'l1', studentId: 's1', projectId: null, date: '2026-10-02', startedAt: 1,
  warmup: { name: '', concepts: [], details: '' }, main: { name: '', concepts: [], details: '' },
  nextPlan: '', privateNotes: '', jots: [], noteEdits: {}, noteWritten: false, ...over,
})
const v2 = (over: object = {}) => ({ version: 2, students: [student], projects: [], lessons: [lesson()], theme: 'system', lastBackup: null, ...over })

describe('migrate: untrusted data cannot break rendering', () => {
  it('leaves valid v2 data unchanged', () => {
    const out = migrate(v2())
    expect(out.students).toEqual([student])
    expect(out.lessons[0]).toMatchObject({ id: 'l1', studentId: 's1', date: '2026-10-02' })
  })

  it('fills in missing or wrongly typed lesson fields instead of crashing later', () => {
    const out = migrate(v2({ lessons: [{ id: 'l1', studentId: 's1', warmup: 'oops', main: null, jots: 'x', noteEdits: [], nextPlan: 5 }] }))
    const l = out.lessons[0]
    expect(l.warmup).toEqual({ name: '', concepts: [], details: '' })
    expect(l.main).toEqual({ name: '', concepts: [], details: '' })
    expect(l.jots).toEqual([])
    expect(l.noteEdits).toEqual({})
    expect(l.nextPlan).toBe('')
    expect(l.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(l.noteWritten).toBe(false)
  })

  it('drops records that are not objects or have no usable id', () => {
    const out = migrate(v2({ students: [student, null, 'x', { firstName: 'No id' }], lessons: [lesson(), 7, { studentId: 's1' }] }))
    expect(out.students).toHaveLength(1)
    expect(out.lessons).toHaveLength(1)
  })

  it('drops duplicate ids, keeping the first', () => {
    const out = migrate(v2({ students: [student, { ...student, firstName: 'Dup' }], lessons: [lesson(), lesson({ nextPlan: 'dup' })] }))
    expect(out.students.map((s) => s.firstName)).toEqual(['Riley'])
    expect(out.lessons).toHaveLength(1)
    expect(out.lessons[0].nextPlan).toBe('')
  })

  it('drops lessons and projects whose student is missing', () => {
    const out = migrate(v2({
      projects: [{ id: 'p1', studentId: 'ghost', name: 'X', language: '', status: 'active', createdAt: 0 }],
      lessons: [lesson(), lesson({ id: 'l2', studentId: 'ghost' })],
    }))
    expect(out.projects).toEqual([])
    expect(out.lessons.map((l) => l.id)).toEqual(['l1'])
  })

  it('clears a lesson project that does not exist or belongs to another student', () => {
    const projects = [
      { id: 'p1', studentId: 's1', name: 'Mine', language: '', status: 'active', createdAt: 0 },
      { id: 'p2', studentId: 's2', name: 'Theirs', language: '', status: 'active', createdAt: 0 },
    ]
    const out = migrate(v2({
      students: [student, { id: 's2', firstName: 'Sam', createdAt: 0 }],
      projects,
      lessons: [lesson({ projectId: 'p1' }), lesson({ id: 'l2', projectId: 'p2' }), lesson({ id: 'l3', projectId: 'nope' })],
    }))
    expect(out.lessons.map((l) => l.projectId)).toEqual(['p1', null, null])
  })

  it('repairs concepts: bad ratings default, nameless ones go, ids are filled', () => {
    const out = migrate(v2({
      lessons: [lesson({ warmup: { name: 'W', details: 'd', concepts: [{ name: 'loops', rating: 9 }, { name: '  ', rating: 2 }, { id: 'c', name: 'lists', rating: 1, comment: 'hard' }] } })],
    }))
    const c = out.lessons[0].warmup.concepts
    expect(c.map((x) => [x.name, x.rating])).toEqual([['loops', 3], ['lists', 1]])
    expect(c[0].id).toBeTruthy()
    expect(c[1].comment).toBe('hard')
  })

  it('keeps only well-formed note edits', () => {
    const out = migrate(v2({ lessons: [lesson({ noteEdits: { Warmup: { text: 'mine', baseline: 'gen' }, Main: { text: 5 }, Plan: 'x' } })] }))
    expect(out.lessons[0].noteEdits).toEqual({ Warmup: { text: 'mine', baseline: 'gen' } })
  })

  it('falls back to safe values for theme and project status', () => {
    const out = migrate(v2({ theme: 'neon', lastBackup: 'yesterday', projects: [{ id: 'p', studentId: 's1', name: '', status: 'weird' }] }))
    expect(out.theme).toBe('system')
    expect(out.lastBackup).toBeNull()
    expect(out.projects[0]).toMatchObject({ name: 'Project', status: 'active', language: '' })
  })

  it('returns an empty app for anything that is not an object', () => {
    for (const bad of [null, undefined, 42, 'text', [], true]) {
      expect(migrate(bad).students).toEqual([])
    }
  })

  it('also cleans v1 data after converting it', () => {
    const out = migrate({ students: [{ id: 's1', firstName: 'Riley', project: 'Game', language: 'Scratch', createdAt: 1 }], lessons: [{ id: 'l1', studentId: 's1', warmup: 7 }] })
    expect(out.projects[0].name).toBe('Game')
    expect(out.lessons[0].warmup).toEqual({ name: '', concepts: [], details: '' })
    expect(out.lessons[0].projectId).toBe(out.projects[0].id)
  })
})
