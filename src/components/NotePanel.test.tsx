import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { concept, lesson as makeLesson, student } from '../test/factories'
import type { Lesson } from '../types'
import { NotePanel } from './NotePanel'

const base = makeLesson({
  warmup: { name: 'Maze', concepts: [concept('loops', 3)], details: '' },
  privateNotes: 'PRIVATE-TEXT',
})

let latest: Lesson
let setLesson: (l: Lesson) => void

function Harness({ initial = base }: { initial?: Lesson }) {
  const [l, setL] = useState(initial)
  useEffect(() => {
    latest = l
    setLesson = setL
  })
  return <NotePanel student={student()} lesson={l} onChange={(p) => setL((cur) => ({ ...cur, ...p }))} />
}

const box = (name: string) => screen.getByLabelText(name) as HTMLTextAreaElement

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

describe('NotePanel', () => {
  it('shows the generated draft and never the private notes', () => {
    render(<Harness />)
    expect(box('Warmup').value).toContain('Maya worked independently on loops.')
    expect(screen.getByText(/Private notes are not included/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('PRIVATE-TEXT')
  })

  it('warns about blank sections but still allows copying', () => {
    render(<Harness />)
    expect(screen.getByRole('status')).toHaveTextContent('Still blank: Main activity, Plan for next week')
    expect(screen.getByRole('button', { name: /Plain text/ })).toBeEnabled()
  })

  it('disables polish, copy and mark-as-written while the whole note is empty, and enables them once there is text', async () => {
    render(<Harness initial={makeLesson()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Nothing to copy yet')
    for (const name of [/Rich text/, /Plain text/, /Polish with AI/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByRole('checkbox', { name: /Mark note as written/ })).toBeDisabled()

    await userEvent.type(box('Plan for next week'), 'Start levels.')
    expect(screen.getByRole('button', { name: /Plain text/ })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: /Mark note as written/ })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Still blank: Warmup, Main activity')
  })

  it('copies the edited text as plain text', async () => {
    render(<Harness />)
    await userEvent.type(box('Plan for next week'), 'Start levels.')
    await userEvent.click(screen.getByRole('button', { name: /Plain text/ }))
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('Plan for next week\nStart levels.')
    expect(text).not.toContain('PRIVATE-TEXT')
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeInTheDocument()
  })

  it('picks up main-activity concepts added after the note was first viewed', () => {
    render(<Harness />)
    expect(box('Main activity').value).toBe('')
    setLesson({ ...latest, main: { name: 'Enemies', concepts: [concept('lists', 2)], details: '' } })
    return screen.findByLabelText('Main activity').then((el) => {
      expect((el as HTMLTextAreaElement).value).toContain('needed some support with lists')
    })
  })

  it('keeps a hand edit but flags it when the lesson changes, with a way to take the update', async () => {
    render(<Harness />)
    await userEvent.type(box('Main activity'), 'My own words.')
    expect(screen.getByRole('button', { name: /Reset to generated/ })).toBeInTheDocument()

    setLesson({ ...latest, main: { name: 'Enemies', concepts: [concept('lists', 2)], details: '' } })
    expect(await screen.findByText(/The lesson changed since you edited/)).toBeInTheDocument()
    expect(box('Main activity').value).toBe('My own words.')

    await userEvent.click(screen.getByRole('button', { name: 'Use updated draft' }))
    expect(box('Main activity').value).toContain('lists')
    expect(latest.noteEdits).toEqual({})
  })

  it('"Keep mine" dismisses the warning without changing the text', async () => {
    render(<Harness />)
    await userEvent.type(box('Main activity'), 'Mine.')
    setLesson({ ...latest, main: { name: 'X', concepts: [], details: '' } })
    await userEvent.click(await screen.findByRole('button', { name: 'Keep mine' }))
    expect(screen.queryByText(/The lesson changed since you edited/)).not.toBeInTheDocument()
    expect(box('Main activity').value).toBe('Mine.')
  })

  it('typing the generated text back removes the override', async () => {
    render(<Harness />)
    const generated = box('Warmup').value
    await userEvent.type(box('Warmup'), 'x')
    expect(Object.keys(latest.noteEdits)).toEqual(['Warmup'])
    await userEvent.clear(box('Warmup'))
    await userEvent.type(box('Warmup'), generated)
    expect(latest.noteEdits).toEqual({})
  })

  it('offers Reset note only when there is something to reset, and rebuilds from the lesson', async () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /Reset note/ })).not.toBeInTheDocument()

    await userEvent.type(box('Warmup'), ' Extra.')
    await userEvent.click(screen.getByRole('checkbox', { name: /Mark note as written/ }))
    await userEvent.click(screen.getByRole('button', { name: /Reset note/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset note' }))

    expect(latest.noteEdits).toEqual({})
    expect(latest.noteWritten).toBe(false)
    expect(box('Warmup').value).toContain('Maya worked independently on loops.')
    expect(box('Warmup').value).not.toContain('Extra.')
    expect(screen.queryByRole('button', { name: /Reset note/ })).not.toBeInTheDocument()
  })

  it('does not style the reset as destructive, since the lesson is untouched', async () => {
    render(<Harness />)
    await userEvent.type(box('Warmup'), ' Extra.')
    expect(screen.getByRole('button', { name: /Reset note/ }).className).not.toMatch(/text-danger/)
  })

  it('keeps everything when the reset is cancelled', async () => {
    render(<Harness />)
    await userEvent.type(box('Warmup'), ' Extra.')
    await userEvent.click(screen.getByRole('button', { name: /Reset note/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(box('Warmup').value).toContain('Extra.')
  })

  it('an explicit model choice wins over the recommendation', () => {
    localStorage.setItem('lesson-notes:model', 'Qwen2.5-7B-Instruct-q4f16_1-MLC')
    render(<Harness />)
    expect((screen.getByLabelText('AI model') as HTMLSelectElement).value).toBe('Qwen2.5-7B-Instruct-q4f16_1-MLC')
  })

  it('lets you choose the AI model and remembers it', async () => {
    render(<Harness />)
    const select = screen.getByLabelText('AI model') as HTMLSelectElement
    expect(select.value).toBe('Qwen2.5-3B-Instruct-q4f16_1-MLC')
    // disabled without WebGPU in jsdom, so check the stored default and option list instead
    expect([...select.options].map((o) => o.value)).toContain('Qwen2.5-7B-Instruct-q4f16_1-MLC')
  })

  it('disables AI polish without WebGPU and explains why', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /Polish with AI/ })).toBeDisabled()
    expect(screen.getByText(/needs a browser with WebGPU/)).toBeInTheDocument()
  })
})
