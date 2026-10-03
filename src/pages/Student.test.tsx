import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { migrate } from '../lib/migrate'
import { StoreProvider } from '../store'
import { StudentPage } from './Student'

const concept = (name: string, rating: number) => ({ id: name, name, rating, comment: '' })
const lesson = (id: string, projectId: string | null, date: string, main: string) => ({
  id, studentId: 's1', projectId, date, startedAt: 1,
  warmup: { name: '', concepts: [], details: '' },
  main: { name: main, concepts: [concept('loops', 3)], details: '' },
  nextPlan: '', privateNotes: '', jots: [], noteEdits: {}, noteWritten: false,
})

function seed(projects: object[] = [
  { id: 'p1', studentId: 's1', name: 'Tic Tac Toe', language: 'Python', status: 'active', createdAt: 1 },
  { id: 'p2', studentId: 's1', name: 'Quiz App', language: 'Python', status: 'done', createdAt: 2 },
]) {
  localStorage.setItem(
    'lesson-notes:v1',
    JSON.stringify(
      migrate({
        version: 2,
        students: [{ id: 's1', firstName: 'Riley', createdAt: 0 }],
        projects,
        lessons: [lesson('l1', 'p1', '2026-10-01', 'Board game'), lesson('l2', 'p2', '2026-10-02', 'Quiz screen')],
      }),
    ),
  )
}

const setup = () =>
  render(
    <StoreProvider>
      <StudentPage id="s1" />
    </StoreProvider>,
  )

beforeEach(() => seed())

describe('StudentPage', () => {
  it('lists lessons newest first with their project', () => {
    setup()
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Quiz screen')
    expect(items[0]).toHaveTextContent('Quiz App')
    expect(items[1]).toHaveTextContent('Board game')
  })

  it('filters the timeline by project', async () => {
    setup()
    await userEvent.selectOptions(screen.getByLabelText('Filter by project'), 'p1')
    expect(screen.getByText('Board game')).toBeInTheDocument()
    expect(screen.queryByText('Quiz screen')).not.toBeInTheDocument()
  })

  it('keeps the filter in the layout but invisible on the Projects tab, so the tab row does not jump', async () => {
    setup()
    const filter = screen.getByLabelText('Filter by project')
    expect(filter.className).not.toContain('invisible')
    await userEvent.click(screen.getByRole('button', { name: 'projects' }))
    expect(screen.getByLabelText('Filter by project', { selector: 'select' }).className).toContain('invisible')
  })

  it('marks the current tab and shows the projects with their state', async () => {
    setup()
    expect(screen.getByRole('button', { name: 'timeline' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'projects' }))
    expect(screen.getByRole('button', { name: 'projects' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/Python · 1 lesson · In progress/)).toBeInTheDocument()
    expect(screen.getByText(/Python · 1 lesson · Finished/)).toBeInTheDocument()
  })

  it('finishes and reopens a project', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'projects' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mark finished' }))
    expect(screen.queryByRole('button', { name: 'Mark finished' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reopen' })).toHaveLength(2)
  })

  it('asks before deleting a project, and keeps its lessons', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'projects' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Quiz App' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Its lessons are kept')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete project' }))
    expect(screen.queryByText('Quiz App')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'timeline' }))
    expect(screen.getByText('Quiz screen')).toBeInTheDocument()
  })

  it('offers Add project right away when the student has none', () => {
    seed([])
    setup()
    expect(screen.getByRole('button', { name: /Add project/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Filter by project')).not.toBeInTheDocument()
  })

  it('shows the concept grid with one labelled cell per rating', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'concepts' }))
    expect(screen.getByRole('rowheader', { name: 'loops' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Independent' })).toHaveLength(2)
  })

  it('sets the page title to the student name', () => {
    setup()
    expect(document.title).toBe('Riley · Lesson Notes')
  })

  it('says so when the student does not exist', () => {
    render(
      <StoreProvider>
        <StudentPage id="nobody" />
      </StoreProvider>,
    )
    expect(screen.getByText('Student not found')).toBeInTheDocument()
  })
})
