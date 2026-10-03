import type { AppData } from '../types'

/** The project a new lesson should default to: the student's last-used active project, else their only active one. */
export function defaultProjectId(data: AppData, studentId: string): string | null {
  const active = data.projects.filter((p) => p.studentId === studentId && p.status === 'active')
  const last = data.lessons
    .filter((l) => l.studentId === studentId && l.projectId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)[0]
  if (last && active.some((p) => p.id === last.projectId)) return last.projectId
  return active.length === 1 ? active[0].id : null
}
