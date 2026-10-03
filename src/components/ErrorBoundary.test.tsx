import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('bad saved data')
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renders children when nothing is wrong', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows a recovery screen with the error instead of a blank page', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText('bad saved data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download my data' })).toBeInTheDocument()
  })

  it('offers the raw saved data for download', async () => {
    localStorage.setItem('lesson-notes:v1', '{"damaged":true}')
    const create = vi.fn(() => 'blob:raw')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    await userEvent.click(screen.getByRole('button', { name: 'Download my data' }))
    expect(click).toHaveBeenCalledOnce()
    expect(await (create.mock.calls[0] as unknown as [Blob])[0].text()).toBe('{"damaged":true}')
  })

  it('requires a second click before erasing saved data', async () => {
    localStorage.setItem('lesson-notes:v1', '{"keep":"me"}')
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload, hash: '' }, configurable: true })
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    await userEvent.click(screen.getByText('Still broken?'))
    await userEvent.click(screen.getByRole('button', { name: /Clear saved data/ }))
    expect(localStorage.getItem('lesson-notes:v1')).toBe('{"keep":"me"}')
    await userEvent.click(screen.getByRole('button', { name: /Yes, erase everything/ }))
    expect(localStorage.getItem('lesson-notes:v1')).toBeNull()
    expect(reload).toHaveBeenCalled()
  })
})
