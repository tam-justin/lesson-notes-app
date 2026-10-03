import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider, useStore } from '../store'
import { flushSave } from '../test/helpers'
import { Shell } from './Shell'

function AddStudent() {
  const { addStudent } = useStore()
  return <button onClick={() => addStudent({ firstName: 'Riley' })}>add</button>
}

const setup = () =>
  render(
    <StoreProvider>
      <Shell path="/">
        <AddStudent />
      </Shell>
    </StoreProvider>,
  )

afterEach(() => vi.restoreAllMocks())

describe('Shell', () => {
  it('marks the current section in the navigation', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Students' })).not.toHaveAttribute('aria-current')
  })

  it('shows no warning while saving works', async () => {
    setup()
    await act(async () => screen.getByRole('button', { name: 'add' }).click())
    await flushSave()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('warns when changes cannot be saved to the device', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    setup()
    await act(async () => screen.getByRole('button', { name: 'add' }).click())
    await flushSave()
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't save to this device/)
  })
})
