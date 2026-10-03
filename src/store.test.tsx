import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAVE_DELAY_MS, StoreProvider, useStore } from './store'
import { flushSave } from './test/helpers'

const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider>{children}</StoreProvider>
const setup = () => renderHook(() => useStore(), { wrapper })

describe('store', () => {
  it('creates students and lessons and persists them to localStorage', async () => {
    const { result } = setup()
    let sid = ''
    act(() => { sid = result.current.addStudent({ firstName: 'Maya' }) })
    act(() => { result.current.createLesson(sid) })
    expect(result.current.data.students).toHaveLength(1)
    expect(result.current.data.lessons[0]).toMatchObject({ studentId: sid, noteWritten: false, noteEdits: {} })
    await flushSave()
    const saved = JSON.parse(localStorage.getItem('lesson-notes:v1')!)
    expect(saved.version).toBe(2)
    expect(saved.students[0].firstName).toBe('Maya')
    expect(saved.lessons).toHaveLength(1)
  })

  it('restores saved data on load', () => {
    const first = setup()
    act(() => { first.result.current.addStudent({ firstName: 'Leo' }) })
    first.unmount()
    expect(setup().result.current.data.students[0].firstName).toBe('Leo')
  })

  it('deleting a student also deletes their lessons and projects', () => {
    const { result } = setup()
    let a = '', b = ''
    act(() => { a = result.current.addStudent({ firstName: 'A' }) })
    act(() => { b = result.current.addStudent({ firstName: 'B' }) })
    act(() => { result.current.addProject(a, { name: 'Game', language: '' }); result.current.addProject(b, { name: 'App', language: '' }) })
    act(() => { result.current.createLesson(a); result.current.createLesson(b) })
    act(() => result.current.deleteStudent(a))
    expect(result.current.data.students.map((s) => s.id)).toEqual([b])
    expect(result.current.data.projects.map((p) => p.name)).toEqual(['App'])
    expect(result.current.data.lessons.every((l) => l.studentId === b)).toBe(true)
  })

  it('updates a lesson by id', () => {
    const { result } = setup()
    let lid = ''
    act(() => { lid = result.current.createLesson('x') })
    act(() => result.current.updateLesson(lid, { nextPlan: 'levels', noteWritten: true }))
    expect(result.current.data.lessons[0]).toMatchObject({ nextPlan: 'levels', noteWritten: true })
  })

  it('applies the theme to the document', () => {
    const { result } = setup()
    act(() => result.current.setTheme('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('lesson-notes:v1', '{not json')
    expect(setup().result.current.data.students).toEqual([])
  })
})

describe('saving', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const writes = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter((c) => c[0] === 'lesson-notes:v1')

  it('batches rapid changes into one write after a short delay', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = setup()
    act(() => { result.current.addStudent({ firstName: 'A' }) })
    act(() => { result.current.addStudent({ firstName: 'B' }) })
    act(() => { result.current.addStudent({ firstName: 'C' }) })
    expect(writes(spy)).toHaveLength(0)

    act(() => { vi.advanceTimersByTime(SAVE_DELAY_MS) })
    expect(writes(spy)).toHaveLength(1)
    expect(JSON.parse(writes(spy)[0][1] as string).students.map((s: { firstName: string }) => s.firstName)).toEqual(['A', 'B', 'C'])
  })

  it('writes immediately when the page is hidden, so nothing pending is lost', async () => {
    vi.useFakeTimers()
    const { result } = setup()
    act(() => { result.current.addStudent({ firstName: 'Late' }) })
    expect(localStorage.getItem('lesson-notes:v1')).toBeNull()
    await flushSave()
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).students[0].firstName).toBe('Late')
  })

  it('writes pending changes when the app unmounts', () => {
    vi.useFakeTimers()
    const { result, unmount } = setup()
    act(() => { result.current.addStudent({ firstName: 'Bye' }) })
    unmount()
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).students[0].firstName).toBe('Bye')
  })

  it('reports a failed save, and clears the error once a save succeeds', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = setup()
    act(() => { result.current.addStudent({ firstName: 'X' }) })
    await flushSave()
    expect(result.current.saved.error).toBe(true)

    spy.mockRestore()
    act(() => { result.current.addStudent({ firstName: 'Y' }) })
    await flushSave()
    expect(result.current.saved.error).toBe(false)
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).students).toHaveLength(2)
  })

  it('never writes just because the app was opened, so a stale tab cannot overwrite newer data', async () => {
    const { unmount } = setup()
    localStorage.setItem('lesson-notes:v1', '{"version":2,"newer":"edits from another tab"}')
    await flushSave()
    unmount()
    expect(localStorage.getItem('lesson-notes:v1')).toBe('{"version":2,"newer":"edits from another tab"}')
  })

  it('adopts data saved by another tab', () => {
    const { result } = setup()
    const next = { version: 2, students: [{ id: 'z', firstName: 'FromOtherTab', createdAt: 0 }], projects: [], lessons: [], theme: 'dark', lastBackup: null }
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'lesson-notes:v1', newValue: JSON.stringify(next) }))
    })
    expect(result.current.data.students[0].firstName).toBe('FromOtherTab')
    expect(result.current.data.theme).toBe('dark')
  })

  it('does not drop unsaved edits when another tab saves first', async () => {
    vi.useFakeTimers()
    const { result } = setup()
    act(() => { result.current.addStudent({ firstName: 'Mine' }) })
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'lesson-notes:v1', newValue: '{"version":2}' }))
    })
    expect(result.current.data.students[0].firstName).toBe('Mine')
    await flushSave()
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).students[0].firstName).toBe('Mine')
  })

  it('ignores damaged or unrelated storage events', () => {
    const { result } = setup()
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'lesson-notes:v1', newValue: '{broken' })) })
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', newValue: '{"version":2}' })) })
    expect(result.current.data.students).toEqual([])
  })

  it('does not write when nothing changed since the last save', async () => {
    const { result } = setup()
    act(() => { result.current.addStudent({ firstName: 'Once' }) })
    await flushSave()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    await flushSave()
    expect(writes(spy)).toHaveLength(0)
  })
})

describe('projects', () => {
  it('lets one student have several projects', () => {
    const { result } = setup()
    let sid = ''
    act(() => { sid = result.current.addStudent({ firstName: 'Maya' }) })
    act(() => {
      result.current.addProject(sid, { name: 'Maze', language: 'Scratch' })
      result.current.addProject(sid, { name: 'Chatbot', language: 'Python' })
    })
    expect(result.current.data.projects.filter((p) => p.studentId === sid).map((p) => p.name)).toEqual(['Maze', 'Chatbot'])
  })

  it('new lessons default to the only active project', () => {
    const { result } = setup()
    let sid = '', pid = '', lid = ''
    act(() => { sid = result.current.addStudent({ firstName: 'Maya' }) })
    act(() => { pid = result.current.addProject(sid, { name: 'Maze', language: '' }) })
    act(() => { lid = result.current.createLesson(sid) })
    expect(result.current.data.lessons.find((l) => l.id === lid)?.projectId).toBe(pid)
  })

  it('new lessons default to the last-used active project when there are several', () => {
    const { result } = setup()
    let sid = '', a = '', b = '', lid = ''
    act(() => { sid = result.current.addStudent({ firstName: 'Maya' }) })
    act(() => { a = result.current.addProject(sid, { name: 'A', language: '' }) })
    act(() => { b = result.current.addProject(sid, { name: 'B', language: '' }) })
    act(() => { result.current.createLesson(sid, b) })
    act(() => { lid = result.current.createLesson(sid) })
    expect(result.current.data.lessons.find((l) => l.id === lid)?.projectId).toBe(b)
    expect(a).not.toBe(b)
  })

  it('does not default to a finished project or guess between several', () => {
    const { result } = setup()
    let sid = '', a = '', lid = ''
    act(() => { sid = result.current.addStudent({ firstName: 'Maya' }) })
    act(() => { a = result.current.addProject(sid, { name: 'A', language: '' }) })
    act(() => { result.current.createLesson(sid, a) })
    act(() => result.current.updateProject(a, { status: 'done' }))
    act(() => { lid = result.current.createLesson(sid) })
    expect(result.current.data.lessons.find((l) => l.id === lid)?.projectId).toBeNull()
  })

  it('deleting a project keeps its lessons but unlinks them', () => {
    const { result } = setup()
    let sid = '', pid = ''
    act(() => { sid = result.current.addStudent({ firstName: 'Maya' }) })
    act(() => { pid = result.current.addProject(sid, { name: 'A', language: '' }) })
    act(() => { result.current.createLesson(sid, pid) })
    act(() => result.current.deleteProject(pid))
    expect(result.current.data.projects).toHaveLength(0)
    expect(result.current.data.lessons).toHaveLength(1)
    expect(result.current.data.lessons[0].projectId).toBeNull()
  })
})
