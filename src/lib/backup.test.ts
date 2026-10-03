import { describe, expect, it } from 'vitest'
import { BACKUP_MAX_AGE_DAYS, MIN_LESSONS_FOR_REMINDER, needsBackup } from './backup'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 3)
const lessons = (n: number) => Array.from({ length: n }, () => ({}) as never)

describe('needsBackup', () => {
  it('stays quiet until there is enough data worth protecting', () => {
    expect(needsBackup({ lessons: lessons(MIN_LESSONS_FOR_REMINDER - 1), lastBackup: null }, NOW)).toBe(false)
    expect(needsBackup({ lessons: [], lastBackup: null }, NOW)).toBe(false)
  })

  it('asks when there are lessons and no backup has ever been made', () => {
    expect(needsBackup({ lessons: lessons(MIN_LESSONS_FOR_REMINDER), lastBackup: null }, NOW)).toBe(true)
  })

  it('asks once the last backup is older than the limit, not before', () => {
    const data = (ageDays: number) => ({ lessons: lessons(10), lastBackup: NOW - ageDays * DAY })
    expect(needsBackup(data(BACKUP_MAX_AGE_DAYS), NOW)).toBe(false)
    expect(needsBackup(data(BACKUP_MAX_AGE_DAYS + 1), NOW)).toBe(true)
    expect(needsBackup(data(1), NOW)).toBe(false)
  })
})
