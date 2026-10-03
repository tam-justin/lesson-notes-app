import type { AppData } from '../types'

/** Don't nag until there is enough written to be worth protecting. */
export const MIN_LESSONS_FOR_REMINDER = 3
export const BACKUP_MAX_AGE_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

/** Data lives only in this browser, so remind the user to export when they have never backed up or it has been a while. */
export function needsBackup(data: Pick<AppData, 'lessons' | 'lastBackup'>, now: number): boolean {
  if (data.lessons.length < MIN_LESSONS_FOR_REMINDER) return false
  return data.lastBackup === null || now - data.lastBackup > BACKUP_MAX_AGE_DAYS * DAY_MS
}
