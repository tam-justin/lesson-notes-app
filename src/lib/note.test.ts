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
    expect(note[0].body).toContain('We started with "Fix the maze".')
    expect(note[0].body).toContain('Maya handled variables with ease and worked independently on loops.')
  })

  it('groups concepts by rating, best first, at most two ratings per sentence', () => {
    expect(note[1].body).toContain('Our main activity was "Enemy spawning".')
    expect(note[1].body).toContain('Maya worked independently on lists and needed some support with conditionals.')
    expect(note[1].body).toContain('Maya found functions challenging and needed a lot of guidance.')
  })

  it('names each concept once instead of listing them first', () => {
    expect(note[1].body).not.toContain('It covered')
    expect(note[1].body.match(/conditionals/g)).toHaveLength(1)
  })

  it('capitalizes and punctuates free text', () => {
    expect(note[0].body).toMatch(/\n\nShe finished quickly\.$/)
    expect(note[2].body).toBe('Finish scoring and start on levels.')
  })

  it('includes per-concept comments', () => {
    expect(note[1].body).toContain('With functions, Maya needed a worked example.')
  })

  it('keeps a non-verb comment as its own clause', () => {
    const l = lesson({ main: { name: '', concepts: [concept('lists', 2, 'Indexing was tricky')], details: '' } })
    expect(templateNote(student(), l)[1].body).toContain('Regarding lists, indexing was tricky.')
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
    expect(resolveNote(student(), withMain)[1].body).toContain('worked independently on loops')
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
