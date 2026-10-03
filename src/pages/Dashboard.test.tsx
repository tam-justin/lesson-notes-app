import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { migrate } from '../lib/migrate'
import { StoreProvider } from '../store'
import { Dashboard } from './Dashboard'

const lesson = (id: string, noteWritten = false) => ({
  id, studentId: 's1', projectId: null, date: '2026-10-0' + id.slice(1), startedAt: 1,
  warmup: { name: '', concepts: [], details: '' }, main: { name: 'Board game', concepts: [], details: '' },
  nextPlan: '', privateNotes: '', jots: [], noteEdits: {}, noteWritten,
})

function seed(lessonCount: number, lastBackup: number | null = null) {
  localStorage.setItem(
    'lesson-notes:v1',
    JSON.stringify(
      migrate({
        version: 2,
        students: [{ id: 's1', firstName: 'Riley', createdAt: 0 }],
        projects: [{ id: 'p1', studentId: 's1', name: 'A very long project name that would stretch a grid track if it could', language: '', status: 'active', createdAt: 0 }],
        lessons: Array.from({ length: lessonCount }, (_, i) => lesson(`l${i + 1}`, i === 0)),
        lastBackup,
      }),
    ),
  )
}

const setup = () =>
  render(
    <StoreProvider>
      <Dashboard />
    </StoreProvider>,
  )

beforeEach(() => localStorage.clear())

describe('Dashboard', () => {
  it('shows the empty state for a new app', () => {
    setup()
    expect(screen.getByText('No lessons yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first student')).toBeInTheDocument()
    expect(screen.queryByText(/backup/i)).not.toBeInTheDocument()
  })

  it('lists only lessons whose note is not written, and a New lesson button per student', () => {
    seed(3)
    setup()
    expect(screen.getAllByText(/Board game/)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'New lesson' })).toBeInTheDocument()
  })

  it('shrinks the student cards to the screen: the grid track must not size to a long project name', () => {
    seed(1)
    setup()
    const list = screen.getByText(/A very long project name/).closest('ul')!
    expect(list.className).toContain('grid-cols-[minmax(0,1fr)]')
    expect(screen.getByRole('button', { name: 'New lesson' }).closest('li')!.className).toContain('min-w-0')
  })

  it('reminds you to back up once there are lessons and no backup', () => {
    seed(3)
    setup()
    expect(screen.getByRole('status')).toHaveTextContent('you have not made a backup yet')
    expect(screen.getByRole('link', { name: 'Back up now' })).toHaveAttribute('href', '#/settings')
  })

  it('does not remind while there is little data, or after a recent backup', () => {
    seed(2)
    const first = setup()
    expect(screen.queryByRole('link', { name: 'Back up now' })).not.toBeInTheDocument()
    first.unmount()

    seed(5, Date.now() - 24 * 60 * 60 * 1000)
    setup()
    expect(screen.queryByRole('link', { name: 'Back up now' })).not.toBeInTheDocument()
  })

  it('reminds again, naming the date, when the last backup is old', () => {
    seed(5, Date.now() - 30 * 24 * 60 * 60 * 1000)
    setup()
    expect(screen.getByRole('status')).toHaveTextContent(/Your last backup was/)
  })
})
