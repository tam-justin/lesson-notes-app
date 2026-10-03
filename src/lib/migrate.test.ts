import { describe, expect, it } from 'vitest'
import { migrate } from './migrate'

const v1Lesson = (over: object = {}) => ({
  id: 'l1', studentId: 's1', date: '2026-10-01', startedAt: 0,
  warmup: { name: '', concepts: [], details: '' },
  main: { name: 'Enemies', concepts: [{ id: 'c', name: 'loops', rating: 3, comment: '' }], details: '' },
  nextPlan: '', privateNotes: '', jots: [], note: null, noteWritten: false, ...over,
})

describe('migrate', () => {
  it('moves a v1 student project and language into a project and links their lessons', () => {
    const out = migrate({
      students: [{ id: 's1', firstName: 'Maya', project: 'Space Shooter', language: 'Scratch', createdAt: 5 }],
      lessons: [v1Lesson()],
    })
    expect(out.version).toBe(2)
    expect(out.students[0]).not.toHaveProperty('project')
    expect(out.projects).toHaveLength(1)
    expect(out.projects[0]).toMatchObject({ studentId: 's1', name: 'Space Shooter', language: 'Scratch', status: 'active' })
    expect(out.lessons[0].projectId).toBe(out.projects[0].id)
    expect(out.lessons[0]).not.toHaveProperty('note')
  })

  it('creates no project for a v1 student without one', () => {
    const out = migrate({ students: [{ id: 's1', firstName: 'Leo', createdAt: 0 }], lessons: [v1Lesson()] })
    expect(out.projects).toEqual([])
    expect(out.lessons[0].projectId).toBeNull()
  })

  it('keeps hand-edited v1 note sections as overrides and drops untouched snapshots', () => {
    const out = migrate({
      students: [{ id: 's1', firstName: 'Maya', createdAt: 0 }],
      lessons: [
        v1Lesson({
          note: [
            { heading: 'Warmup', body: '' },
            { heading: 'Main activity', body: 'My own wording.' },
            { heading: 'Plan for next week', body: '' },
          ],
        }),
      ],
    })
    expect(Object.keys(out.lessons[0].noteEdits)).toEqual(['Main activity'])
    expect(out.lessons[0].noteEdits['Main activity'].text).toBe('My own wording.')
  })

  it('passes v2 data through and tolerates garbage', () => {
    const v2 = { version: 2, students: [{ id: 'a', firstName: 'A', createdAt: 0 }], projects: [], lessons: [], theme: 'dark', lastBackup: null }
    expect(migrate(v2).students).toHaveLength(1)
    expect(migrate(v2).theme).toBe('dark')
    expect(migrate(null).students).toEqual([])
    expect(migrate('nope').lessons).toEqual([])
  })
})
