import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StoreProvider } from '../store'
import { flushSave } from '../test/helpers'
import { SettingsPage } from './Settings'

const setup = () =>
  render(
    <StoreProvider>
      <SettingsPage />
    </StoreProvider>,
  )

describe('SettingsPage theme', () => {
  it('shows all three choices at once, with System selected by default', () => {
    setup()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })

  it('switches and persists the theme', async () => {
    setup()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    await flushSave()
    expect(JSON.parse(localStorage.getItem('lesson-notes:v1')!).theme).toBe('dark')
  })

  it('supports arrow-key navigation', async () => {
    setup()
    screen.getByRole('radio', { name: 'System' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
