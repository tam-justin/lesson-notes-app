import { describe, expect, it } from 'vitest'
import { concept, lesson, student } from '../test/factories'
import { blankSections, resolveNote, templateNote, toHtml, toPlain } from './note'

const full = lesson({
  warmup: { name: 'Fix the maze', concepts: [concept('variables', 4), concept('loops', 3)], details: 'she finished quickly' },
  main: {
    name: 'Enemy spawning',
    concepts: [concept('functions', 1, 'needed a worked example'), concept('conditionals', 2), concept('lists', 3)],
    details: '',
  },
  nextPlan: 'finish scoring and start on levels',
  privateNotes: 'SECRET behavior note',
})

describe('templateNote', () => {
  const note = templateNote(student(), full)

  it('produces the three parent-facing sections in order', () => {
    expect(note.map((s) => s.heading)).toEqual(['Warmup', 'Main activity', 'Plan for next week'])
  })

  it('uses the first name and "we" voice', () => {
    expect(note[0].body).toContain('We started with the warmup activity "Fix the maze".')
    expect(note[0].body).toContain('Maya breezed through variables and worked independently on loops.')
  })

  it('groups concepts by rating, best first, with an Oxford comma', () => {
    expect(note[1].body).toContain('This activity covered functions, conditionals, and lists.')
    expect(note[1].body).toContain(
      'Maya worked independently on lists, needed some support with conditionals, and found functions challenging and needed significant guidance.',
    )
  })

  it('capitalizes and punctuates free text', () => {
    expect(note[0].body).toContain('She finished quickly.')
    expect(note[2].body).toBe('Finish scoring and start on levels.')
  })

  it('includes per-concept comments', () => {
    expect(note[1].body).toContain('On functions: Needed a worked example.')
  })

  it('never leaks private notes', () => {
    expect(JSON.stringify(note)).not.toContain('SECRET')
  })

  it('leaves empty sections blank', () => {
    const blank = templateNote(student(), lesson())
    expect(blank.every((s) => s.body === '')).toBe(true)
    expect(blankSections(blank)).toEqual(['Warmup', 'Main activity', 'Plan for next week'])
  })

  it('does not double existing end punctuation', () => {
    const n = templateNote(student(), lesson({ nextPlan: 'Try levels!' }))
    expect(n[2].body).toBe('Try levels!')
  })
})

describe('resolveNote', () => {
  const withMain = lesson({ main: { name: 'Enemies', concepts: [concept('loops', 3)], details: '' } })

  it('follows the lesson when nothing has been edited', () => {
    const before = resolveNote(student(), withMain)
    expect(before[1]).toMatchObject({ edited: false, stale: false })
    const after = resolveNote(student(), {
      ...withMain,
      main: { ...withMain.main, concepts: [...withMain.main.concepts, concept('lists', 1)] },
    })
    expect(after[1].body).toContain('lists')
    expect(after[1].body).toContain('found lists challenging')
  })

  it('includes main-activity concepts in the live note', () => {
    expect(resolveNote(student(), withMain)[1].body).toContain('This activity covered loops.')
  })

  it('uses an override as the text and flags it stale when the lesson changes afterward', () => {
    const generated = resolveNote(student(), withMain)[1].generated
    const edited = lesson({
      ...withMain,
      noteEdits: { 'Main activity': { text: 'My wording.', baseline: generated } },
    })
    expect(resolveNote(student(), edited)[1]).toMatchObject({ body: 'My wording.', edited: true, stale: false })

    const changed = { ...edited, main: { ...edited.main, concepts: [...edited.main.concepts, concept('lists', 2)] } }
    const s = resolveNote(student(), changed)[1]
    expect(s).toMatchObject({ body: 'My wording.', edited: true, stale: true })
    expect(s.generated).toContain('lists')
  })
})

describe('formatters', () => {
  const note = [
    { heading: 'Warmup', body: 'Line one.\n\nLine <two> & more.' },
    { heading: 'Empty', body: '  ' },
    { heading: 'Plan', body: 'Next.' },
  ]

  it('skips blank sections', () => {
    expect(toPlain(note)).toBe('Warmup\nLine one.\n\nLine <two> & more.\n\nPlan\nNext.')
  })

  it('escapes HTML and splits paragraphs', () => {
    expect(toHtml(note)).toBe(
      '<h2>Warmup</h2><p>Line one.</p><p>Line &lt;two&gt; &amp; more.</p><h2>Plan</h2><p>Next.</p>',
    )
  })
})
