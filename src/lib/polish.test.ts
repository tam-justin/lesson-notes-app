import { describe, expect, it, vi } from 'vitest'
import { concept, lesson, student } from '../test/factories'
import { polishSection } from './llm'
import { requiredTerms, sectionFacts } from './note'
import { checkPolish, EXAMPLES } from './polish'

// All names and lesson details in these tests are invented. Never paste real student data into fixtures.
const facts = [
  'Activity: "Tic Tac Toe Game"',
  'Concepts covered: loops, lists',
  'Riley worked independently on loops and needed some support with lists.',
  "Instructor's notes: built the board and random computer moves",
]

describe('checkPolish', () => {
  const good = 'For the main activity, we worked on "Tic Tac Toe Game", which covered loops and lists. Riley worked independently on loops and needed some support with lists. Riley built the board and added random computer moves.'

  it('accepts a faithful rewrite', () => {
    expect(checkPolish(good, facts, ['loops', 'lists'])).toEqual([])
  })

  it('rejects output that drops a concept', () => {
    expect(checkPolish('We built a game board.', facts, ['loops', 'lists'])[0]).toMatch(/left out: loops, lists/)
  })

  it('rejects invented filler words but allows words that were in the facts', () => {
    expect(checkPolish(`${good} This reinforced foundational skills.`, facts, [])[0]).toMatch(/filler.*reinforced.*foundational/)
    expect(checkPolish('We practiced great loops.', ['Instructor: great loops'], [])).toEqual([])
  })

  it('rejects gendered pronouns', () => {
    expect(checkPolish(`${good} He did well.`, facts, [])[0]).toMatch(/gendered pronouns \(he\)/)
  })

  it('rejects empty and rambling output', () => {
    expect(checkPolish('  ', facts, [])).toEqual(['the output was empty'])
    expect(checkPolish('word '.repeat(200), facts, []).join()).toMatch(/longer than the facts justify/)
  })

  it('treats hyphenation and case in concept names as equal', () => {
    expect(checkPolish('We covered For-Loops.', ['x'], ['for loops'])).toEqual([])
  })

  describe('activity names', () => {
    const typo = ['Activity: "Binary Seach Practice"', 'Concepts covered: loops']

    it('allows an obvious one or two letter typo fix, and keeping the name as is', () => {
      expect(checkPolish('We worked on "Binary Search Practice", covering loops.', typo, ['loops'])).toEqual([])
      expect(checkPolish('We worked on "Binary Seach Practice", covering loops.', typo, ['loops'])).toEqual([])
      expect(checkPolish('We worked on "binary search practice", covering loops.', typo, ['loops'])).toEqual([])
    })

    it('rejects a reworded name and tells the model the original', () => {
      const p = checkPolish('We tackled "Binary Find Practice", covering loops.', typo, ['loops'])
      expect(p).toHaveLength(2)
      expect(p[0]).toContain('"Binary Seach Practice"')
      expect(p[1]).toMatch(/not an activity name: "Binary Find Practice"/)
    })

    it('rejects a dropped name', () => {
      expect(checkPolish('We worked on loops.', typo, ['loops'])[0]).toMatch(/changed or dropped the activity name/)
    })

    it('rejects stray quoted text but allows quotes that came from the facts', () => {
      expect(checkPolish('We worked on "Pong", and it was "amazing".', ['Activity: "Pong"'], [])[0]).toMatch(/"amazing"/)
      expect(checkPolish('We worked on "Pong". They said "I get it now".', ['Activity: "Pong"', 'Notes: said "I get it now"'], [])).toEqual([])
    })

    it('does not require quotes when no activity was named', () => {
      expect(checkPolish('Next week, we will add scoring.', ['Plan for next week: add scoring'], [])).toEqual([])
    })
  })

  it('the few-shot examples obey their own rules', () => {
    for (const x of EXAMPLES) {
      expect(checkPolish(x.text, x.facts, [])).toEqual([])
    }
  })
})

function fakeEngine(replies: string[]) {
  const create = vi.fn()
  for (const r of replies) create.mockResolvedValueOnce({ choices: [{ message: { content: r } }] })
  return { engine: { chat: { completions: { create } } } as never, create }
}

const input = { student: 'Riley', heading: 'Main activity', facts, required: ['loops', 'lists'] }
const good = 'We worked on "Tic Tac Toe Game", covering loops and lists. Riley worked independently on loops and needed some support with lists.'

describe('polishSection', () => {
  it('returns the first reply when it passes the check', async () => {
    const { engine, create } = fakeEngine([good])
    const r = await polishSection(engine, input)
    expect(r).toEqual({ text: good, ok: true, problems: [] })
    expect(create).toHaveBeenCalledOnce()
    const sent = create.mock.calls[0][0]
    expect(sent.temperature).toBeLessThanOrEqual(0.3)
    expect(sent.messages.at(-1).content).toContain('- Activity: "Tic Tac Toe Game"')
  })

  it('strips an empty thinking block some models prepend', async () => {
    const { engine } = fakeEngine([`<think>\n\n</think>\n\n${good}`])
    expect((await polishSection(engine, input)).text).toBe(good)
  })

  it('retries once, telling the model what was wrong', async () => {
    const { engine, create } = fakeEngine(['He built a board.', good])
    const r = await polishSection(engine, input)
    expect(r.ok).toBe(true)
    expect(create).toHaveBeenCalledTimes(2)
    const retry = create.mock.calls[1][0].messages.at(-1).content as string
    expect(retry).toMatch(/rejected/)
    expect(retry).toMatch(/gendered pronouns/)
    expect(retry).toMatch(/left out/)
  })

  it('reports failure when the retry is still bad so the caller keeps its draft', async () => {
    const { engine, create } = fakeEngine(['He built a board.', 'She built a board.'])
    const r = await polishSection(engine, input)
    expect(r.ok).toBe(false)
    expect(r.problems.length).toBeGreaterThan(0)
    expect(create).toHaveBeenCalledTimes(2)
  })
})

describe('sectionFacts', () => {
  const l = lesson({
    main: {
      name: 'Tic Tac Toe',
      concepts: [concept('loops', 3), concept('lists', 2, 'indexing was tricky')],
      details: 'built the board',
    },
    nextPlan: 'add a scoreboard',
  })

  it('lists the activity, concepts, ratings, comments and raw notes as separate facts', () => {
    expect(sectionFacts(student({ firstName: 'Riley' }), l, 'Main activity')).toEqual([
      'Activity: "Tic Tac Toe"',
      'Concepts covered: loops and lists',
      'Riley worked independently on loops and needed some support with lists.',
      'About lists: indexing was tricky',
      "Instructor's notes: built the board",
    ])
  })

  it('gives the plan as one fact and nothing for an empty section', () => {
    expect(sectionFacts(student(), l, 'Plan for next week')).toEqual(['Plan for next week: add a scoreboard'])
    expect(sectionFacts(student(), l, 'Warmup')).toEqual([])
  })

  it('requires the concept names of the matching activity only', () => {
    expect(requiredTerms(l, 'Main activity')).toEqual(['loops', 'lists'])
    expect(requiredTerms(l, 'Warmup')).toEqual([])
    expect(requiredTerms(l, 'Plan for next week')).toEqual([])
  })
})
