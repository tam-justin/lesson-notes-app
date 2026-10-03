import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog, Dialog } from './ui'

function Opener() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Dialog open={open} onOpenChange={setOpen} title="A dialog">
        <button>Inside</button>
      </Dialog>
    </>
  )
}

describe('Dialog focus', () => {
  it('moves focus into the dialog, and back to the opening button on Escape', async () => {
    render(<Opener />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    await userEvent.click(opener)
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('returns focus to the opener when closed with the Close button', async () => {
    render(<Opener />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    await userEvent.click(opener)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(opener).toHaveFocus()
  })
})

describe('ConfirmDialog', () => {
  it('confirms and closes, or cancels without confirming', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="Sure?" description="Really." confirmLabel="Do it" onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)

    await userEvent.click(screen.getByRole('button', { name: 'Do it' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
