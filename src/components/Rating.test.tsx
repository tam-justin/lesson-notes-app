import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { Rating } from '../types'
import { RatingChip, RatingPicker } from './Rating'

function Harness({ start = 3 as Rating }) {
  const [v, setV] = useState<Rating>(start)
  return <RatingPicker label="How loops went" value={v} onChange={setV} />
}

describe('RatingPicker', () => {
  it('exposes four labelled radios with the current one checked', () => {
    render(<Harness />)
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByRole('radio', { name: /Independent/ })).toBeChecked()
  })

  it('selects on click', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('radio', { name: /Struggled/ }))
    expect(screen.getByRole('radio', { name: /Struggled/ })).toBeChecked()
  })

  it('supports arrow keys with wraparound and number keys', async () => {
    render(<Harness start={4} />)
    screen.getByRole('radio', { name: /Breezed/ }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: /Struggled/ })).toBeChecked()
    await userEvent.keyboard('2')
    expect(screen.getByRole('radio', { name: /Needed support/ })).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: /Breezed/ })).toBeChecked()
  })
})

describe('RatingChip', () => {
  it('shows the text label, never color alone', () => {
    render(<RatingChip rating={2} />)
    expect(screen.getByText('Needed support')).toBeInTheDocument()
  })

  it('compact chips carry an accessible label', () => {
    render(<RatingChip rating={1} compact />)
    expect(screen.getByLabelText('Struggled')).toBeInTheDocument()
  })
})
