import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { StoreProvider } from '../store'
import type { ConceptEntry } from '../types'
import { ConceptEditor } from './ConceptEditor'

function Harness({ onChange }: { onChange?: (c: ConceptEntry[]) => void }) {
  const [c, setC] = useState<ConceptEntry[]>([])
  return (
    <StoreProvider>
      <ConceptEditor label="Concepts" concepts={c} onChange={(n) => (setC(n), onChange?.(n))} />
    </StoreProvider>
  )
}

describe('ConceptEditor', () => {
  it('adds a concept on Enter with a default Independent rating', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByPlaceholderText(/Add a concept/), 'for loops{Enter}')
    expect(screen.getByText('for loops')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Independent/ })).toBeChecked()
  })

  it('ignores blank input', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByPlaceholderText(/Add a concept/), '   {Enter}')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('uses a wrapping, auto-sizing box for the detail, and keeps it on one logical line', async () => {
    let latest: ConceptEntry[] = []
    render(<Harness onChange={(c) => (latest = c)} />)
    await userEvent.type(screen.getByPlaceholderText(/Add a concept/), 'lists{Enter}')
    const detail = screen.getByLabelText('Detail for lists')
    expect(detail.tagName).toBe('TEXTAREA')
    await userEvent.type(detail, 'first part{Enter}second part')
    expect(latest[0].comment).toBe('first partsecond part')
  })

  it('changes rating, stores a comment, and removes', async () => {
    let latest: ConceptEntry[] = []
    render(<Harness onChange={(c) => (latest = c)} />)
    await userEvent.type(screen.getByPlaceholderText(/Add a concept/), 'lists{Enter}')
    await userEvent.click(screen.getByRole('radio', { name: /Struggled/ }))
    await userEvent.type(screen.getByLabelText('Detail for lists'), 'index errors')
    expect(latest[0]).toMatchObject({ name: 'lists', rating: 1, comment: 'index errors' })
    await userEvent.click(screen.getByRole('button', { name: 'Remove lists' }))
    expect(latest).toHaveLength(0)
  })
})
