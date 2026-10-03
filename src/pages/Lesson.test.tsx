import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { migrate } from '../lib/migrate'
import { StoreProvider } from '../store'
import { flushSave } from '../test/helpers'
import { LessonPage } from './Lesson'

const seed = () =>
  localStorage.setItem(
    'lesson-notes:v1',
    JSON.stringify(
      migrate({
        version: 2,
        students: [{ id: 's1', firstName: 'Maya', createdAt: 0 }],
        projects: [
          { id: 'p1', studentId: 's1', name: 'Maze', language: 'Scratch', status: 'active', createdAt: 0 },
          { id: 'p2', studentId: 's1', name: 'Chatbot', language: 'Python', status: 'active', createdAt: 1 },
        ],
        lessons: [
          {
            id: 'l1', studentId: 's1', projectId: 'p1', date: '2026-10-02', startedAt: 0,
            warmup: { name: '', concepts: [], details: '' },
            main: { name: '', concepts: [], details: '' },
            nextPlan: '', privateNotes: '', jots: [], noteEdits: {}, noteWritten: false,
          },
        ],
      }),
    ),
  )

const renderLesson = (view: 'capture' | 'note' = 'capture') =>
  render(
    <StoreProvider>
      <LessonPage id="l1" view={view} />
    </StoreProvider>,
  )

beforeEach(seed)

describe('LessonPage', () => {
  it('shows the parent note on the lesson page and updates it as main-activity concepts are added', async () => {
    renderLesson()
    const summary = screen.getByRole('region', { name: 'Parent note' })
    expect(within(summary).getAllByText('Nothing yet')).toHaveLength(3)

    const main = screen.getByRole('region', { name: 'Main activity' })
    await userEvent.type(within(main).getByPlaceholderText(/Add a concept/), 'for loops{Enter}')
    await userEvent.click(within(main).getByRole('radio', { name: /Needed support/ }))

    expect(summary).toHaveTextContent('This activity covered for loops.')
    expect(summary).toHaveTextContent('Maya needed some support with for loops.')
  })

  it('has a Jot placeholder short enough for the narrow column', () => {
    renderLesson()
    const placeholder = screen.getByLabelText('Quick jot').getAttribute('placeholder')!
    expect(placeholder.length).toBeLessThanOrEqual(24)
    expect(screen.getByText(/Press Enter to add it with the time/)).toBeInTheDocument()
  })

  it('sends a jot into a section and removes it from the list', async () => {
    renderLesson()
    await userEvent.type(screen.getByLabelText('Quick jot'), 'finished fast{Enter}')
    await userEvent.click(screen.getByRole('button', { name: '→ Warmup' }))
    expect(screen.getByPlaceholderText(/Did they struggle/)).toHaveValue('finished fast')
    expect(screen.queryByRole('button', { name: '→ Warmup' })).not.toBeInTheDocument()
  })

  it('lets you pick between the student’s projects', async () => {
    renderLesson()
    const select = screen.getByLabelText('Project') as HTMLSelectElement
    expect(select.value).toBe('p1')
    await userEvent.selectOptions(select, 'p2')
    expect(select.value).toBe('p2')
    await flushSave()
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).lessons[0].projectId).toBe('p2')
  })

  it('adds a new project from the lesson and selects it', async () => {
    renderLesson()
    await userEvent.selectOptions(screen.getByLabelText('Project'), '__new')
    await userEvent.type(screen.getByLabelText('Project name'), 'Platformer')
    await userEvent.click(screen.getByRole('button', { name: 'Add project' }))
    const select = screen.getByLabelText('Project') as HTMLSelectElement
    expect(select.selectedOptions[0].textContent).toBe('Platformer')
  })

  it('asks for confirmation in the app before deleting a lesson', async () => {
    renderLesson()
    await userEvent.click(screen.getByRole('button', { name: /Delete lesson/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Delete this lesson?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await flushSave()
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).lessons).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /Delete lesson/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete lesson' }))
    await flushSave()
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).lessons).toHaveLength(0)
  })

  it('sets the browser title to the student, lesson date and tab', () => {
    const { unmount } = renderLesson()
    expect(document.title).toMatch(/^Maya · Lesson .* · Lesson Notes$/)
    expect(document.title).not.toContain('Note ·')
    unmount()
    renderLesson('note')
    expect(document.title).toMatch(/^Maya · Lesson .* · Note · Lesson Notes$/)
  })

  it('renders the full note editor on the Note tab', async () => {
    renderLesson('note')
    expect(screen.getByLabelText('Warmup')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Note/ })).toHaveAttribute('aria-current', 'page')
  })
})
