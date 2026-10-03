import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { today, uid } from './lib/ids'
import { EMPTY, migrate } from './lib/migrate'
import { defaultProjectId } from './lib/projects'
import type { Activity, AppData, Lesson, Project, Student, Theme } from './types'

const KEY = 'lesson-notes:v1'

/** Typing changes data on every keystroke, so writes to storage are batched. */
export const SAVE_DELAY_MS = 400

const blankActivity = (): Activity => ({ name: '', concepts: [], details: '' })

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    /* storage unavailable or corrupt */
  }
  return EMPTY
}

export interface SaveStatus {
  /** When data was last written to this device. */
  at: number
  /** The last write failed (for example, storage is full), so recent changes exist only in this tab. */
  error: boolean
}

interface Store {
  data: AppData
  addStudent: (s: Pick<Student, 'firstName'>) => string
  updateStudent: (id: string, patch: Partial<Student>) => void
  deleteStudent: (id: string) => void
  addProject: (studentId: string, p: Pick<Project, 'name' | 'language'>) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  createLesson: (studentId: string, projectId?: string | null) => string
  updateLesson: (id: string, patch: Partial<Lesson>) => void
  deleteLesson: (id: string) => void
  setTheme: (t: Theme) => void
  importData: (d: unknown) => void
  markBackup: () => void
  saved: SaveStatus
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [saved, setSaved] = useState<SaveStatus>(() => ({ at: Date.now(), error: false }))

  const latest = useRef(data)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    try {
      localStorage.setItem(KEY, JSON.stringify(latest.current))
      setSaved({ at: Date.now(), error: false })
    } catch {
      setSaved((s) => ({ ...s, error: true }))
    }
  }, [])

  useEffect(() => {
    // Only real edits are saved. Data that was just loaded (or adopted from another tab) is already on disk, and
    // rewriting it would let an idle, out-of-date tab overwrite newer edits made elsewhere.
    if (latest.current === data) return
    latest.current = data
    dirty.current = true
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
  }, [data, flush])

  // Another tab saved: adopt its data, unless this tab has unsaved edits of its own (then ours is written next).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || e.newValue === null || dirty.current) return
      try {
        const next = migrate(JSON.parse(e.newValue))
        latest.current = next
        setData(next)
      } catch {
        /* ignore a damaged write from another tab */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Write straight away when the page is hidden or closed, so a pending change is never lost.
  useEffect(() => {
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [flush])

  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const t = data.theme === 'system' ? (dark.matches ? 'dark' : 'light') : data.theme
      document.documentElement.dataset.theme = t
    }
    apply()
    dark.addEventListener('change', apply)
    return () => dark.removeEventListener('change', apply)
  }, [data.theme])

  const addStudent: Store['addStudent'] = useCallback((s) => {
    const id = uid()
    setData((d) => ({ ...d, students: [...d.students, { ...s, id, createdAt: Date.now() }] }))
    return id
  }, [])

  const updateStudent: Store['updateStudent'] = useCallback((id, patch) => {
    setData((d) => ({ ...d, students: d.students.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  }, [])

  const deleteStudent = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      students: d.students.filter((s) => s.id !== id),
      projects: d.projects.filter((p) => p.studentId !== id),
      lessons: d.lessons.filter((l) => l.studentId !== id),
    }))
  }, [])

  const addProject: Store['addProject'] = useCallback((studentId, p) => {
    const id = uid()
    setData((d) => ({
      ...d,
      projects: [...d.projects, { ...p, id, studentId, status: 'active', createdAt: Date.now() }],
    }))
    return id
  }, [])

  const updateProject: Store['updateProject'] = useCallback((id, patch) => {
    setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
      lessons: d.lessons.map((l) => (l.projectId === id ? { ...l, projectId: null } : l)),
    }))
  }, [])

  const createLesson: Store['createLesson'] = useCallback((studentId, projectId) => {
    const id = uid()
    setData((d) => {
      const lesson: Lesson = {
        id,
        studentId,
        projectId: projectId === undefined ? defaultProjectId(d, studentId) : projectId,
        date: today(),
        startedAt: Date.now(),
        warmup: blankActivity(),
        main: blankActivity(),
        nextPlan: '',
        privateNotes: '',
        jots: [],
        noteEdits: {},
        noteWritten: false,
      }
      return { ...d, lessons: [...d.lessons, lesson] }
    })
    return id
  }, [])

  const updateLesson: Store['updateLesson'] = useCallback((id, patch) => {
    setData((d) => ({ ...d, lessons: d.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  }, [])

  const deleteLesson = useCallback((id: string) => {
    setData((d) => ({ ...d, lessons: d.lessons.filter((l) => l.id !== id) }))
  }, [])

  const setTheme = useCallback((theme: Theme) => setData((d) => ({ ...d, theme })), [])
  const importData = useCallback((incoming: unknown) => setData(migrate(incoming)), [])
  const markBackup = useCallback(() => setData((d) => ({ ...d, lastBackup: Date.now() })), [])

  const value = useMemo(
    () => ({
      data, addStudent, updateStudent, deleteStudent, addProject, updateProject, deleteProject,
      createLesson, updateLesson, deleteLesson, setTheme, importData, markBackup, saved,
    }),
    [
      data, addStudent, updateStudent, deleteStudent, addProject, updateProject, deleteProject,
      createLesson, updateLesson, deleteLesson, setTheme, importData, markBackup, saved,
    ],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}
