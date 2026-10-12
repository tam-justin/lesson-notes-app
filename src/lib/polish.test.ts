import { describe, expect, it, vi } from 'vitest'
import { concept, lesson, student } from '../test/factories'
import { polishSection } from './llm'
import { requiredTerms, sectionFacts } from './note'
import { checkPolish, EXAMPLES, parseReview } from './polish'

// All names and lesson details in these tests are invented. Never paste real student data into fixtures.
const facts = [
  'Activity: "Tic Tac Toe Game"',
  'Concepts covered: loops, lists',
  'Riley worked independently on loops and needed some support with lists.',
  "Instructor's notes: built the board and random computer moves",
]

describe('checkPolish', () => {
  const good = 'For the main activity, we worked on "Tic Tac Toe Game", which covered loops and lists. Riley worked independently on loops and needed some support with lists.\n\nRiley built the board and added random computer moves.'

  it('accepts a faithful rewrite', () => {
    expect(checkPolish(good, facts, ['loops', 'lists'])).toEqual([])
  })

  it('rejects output that drops a concept', () => {
    expect(checkPolish('We built a game board.', facts, ['loops', 'lists']).join()).toMatch(/left out: loops, lists/)
  })

  it('rejects invented filler words but allows words that were in the facts', () => {
    expect(checkPolish(`${good} This reinforced foundational skills.`, facts, [])[0]).toMatch(/filler.*reinforced.*foundational/)
    expect(checkPolish('We practiced.\n\nWe did great loops.',["Instructor's notes: great loops"], [])).toEqual([])
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
      expect(checkPolish('We worked on "Pong". They said "I get it now".', ['Activity: "Pong"', 'About loops: said "I get it now"'], [])).toEqual([])
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
const good = 'We worked on "Tic Tac Toe Game", covering loops and lists. Riley worked independently on loops and needed some support with lists.\n\nRiley built the board and added random computer moves.'

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

describe('checkPolish on a hand-edited draft', () => {
  const draftText = 'We worked on "Maze Runner". Riley needed some support with lists.'
  const draft = { text: draftText, knownTerms: ['loops', 'conditionals', 'lists'] }

  it('accepts a light clean-up of the draft', () => {
    const out = 'We worked on "Maze Runner". Riley needed some support with lists.'
    expect(checkPolish(out, [draftText], [], draft)).toEqual([])
  })

  it('rejects text that puts back a concept the instructor removed', () => {
    const out = 'We worked on "Maze Runner". Riley worked independently on loops and needed some support with lists.'
    const problems = checkPolish(out, [draftText], [], draft)
    expect(problems.join(' ')).toContain('put back details the instructor removed: loops')
  })

  it('rejects added content that is not in the draft', () => {
    const out = 'We worked on "Maze Runner". Riley needed some support with lists, then explored recursion and sorting algorithms.'
    expect(checkPolish(out, [draftText], [], draft).join(' ')).toContain('not in the draft')
  })

  it('allows a typo fix inside the quoted activity name', () => {
    const typo = { text: 'We worked on "maze runnr". Riley did well.', knownTerms: [] }
    expect(checkPolish('We worked on "Maze Runner". Riley did well.', [typo.text], [], typo)).toEqual([])
  })
})

describe('checkPolish keeps the instructor\'s details', () => {
  const noKnown = (text: string) => ({ text, knownTerms: [] as string[] })

  it('accepts corrected spellings in an edited draft', () => {
    const text = 'we tryed it then there was evry bug fixed'
    const out = 'We tried it, and then every bug was fixed.'
    expect(checkPolish(out, [text], [], noKnown(text))).toEqual([])
  })

  it('rejects a dropped sentence', () => {
    const text = 'We used random numbers for the enemy positions. Jo did a lot of careful testing.'
    const problems = checkPolish('We used random numbers for the enemy positions.', [text], [], noKnown(text))
    expect(problems.join()).toMatch(/dropped or rewrote a detail: "Jo did a lot of careful testing."/)
  })

  it('rejects a dropped number, but not one that was kept', () => {
    const text = 'We ran the timer for 2 mins and 30 rounds.'
    expect(checkPolish('We ran the timer for 2 mins and 30 rounds.', [text], [], noKnown(text))).toEqual([])
    expect(checkPolish('We ran the timer for a few mins and many rounds.', [text], [], noKnown(text)).join()).toMatch(/dropped numbers.*2, 30/)
  })

  it('rejects "we" turned into a name or "they"', () => {
    const text = 'We used random numbers for the enemy positions.'
    expect(checkPolish('Jo used random numbers for the enemy positions.', [text], [], noKnown(text)).join()).toMatch(/changed "we"/)
    expect(checkPolish('They used random numbers for the enemy positions.', [text], [], noKnown(text)).join()).toMatch(/changed "we"/)
  })

  it('tolerates a synonym or two inside a sentence', () => {
    const text = 'We found the longest part of the string and counted how many times it repeats.'
    const out = 'We found the longest stretch of the string and counted how often it repeats.'
    expect(checkPolish(out, [text], [], noKnown(text))).toEqual([])
  })

  it('rejects merged paragraphs', () => {
    const text = 'We built the board.\n\nNext we added moves.'
    expect(checkPolish('We built the board. Next we added moves.', [text], [], noKnown(text)).join()).toMatch(/merged paragraphs/)
    expect(checkPolish('We built the board.\n\nNext we added moves.', [text], [], noKnown(text))).toEqual([])
  })

  it('applies the same coverage to the instructor notes in a facts-based polish', () => {
    const f = ['Activity: "Maze"', "Instructor's notes: we used the Replit editor and saved 3 copies"]
    expect(checkPolish('We started with "Maze".\n\nWe used the Replit editor and saved 3 copies.', f, [])).toEqual([])
    expect(checkPolish('We started with "Maze". We used an editor.', f, []).join()).toMatch(/dropped/)
  })
})

describe('parseReview', () => {
  it('reads numbered and star lists, and a prose finding that is not a list', () => {
    expect(parseReview('1. dropped the timer detail\n2) tense changed')).toEqual(['dropped the timer detail', 'tense changed'])
    expect(parseReview('* rating blurred')).toEqual(['rating blurred'])
    expect(parseReview('The AFTER drops the random numbers sentence.')).toEqual(['The AFTER drops the random numbers sentence.'])
  })

  it('treats prose that says there are no differences as clean', () => {
    expect(parseReview('There are no differences in meaning.')).toEqual([])
    expect(parseReview('Everything matches the source.')).toEqual([])
    expect(parseReview('Both versions have the same meaning.')).toEqual([])
  })

  it('treats OK and an empty reply as no findings', () => {
    expect(parseReview('OK')).toEqual([])
    expect(parseReview('  ok.\n')).toEqual([])
    expect(parseReview('')).toEqual([])
  })

  it('reads one finding per dash line and ignores chatter', () => {
    const reply = 'Here are the differences:\n- "needed support" became "worked independently" for lists\n- dropped "random moves"\nHope this helps'
    expect(parseReview(reply)).toEqual(['"needed support" became "worked independently" for lists', 'dropped "random moves"'])
  })
})

describe('polishSection with a review pass', () => {
  const withReview = { ...input, review: true }

  it('accepts the polish when the reviewer finds nothing, using one extra call', async () => {
    const { engine, create } = fakeEngine([good, 'OK'])
    const r = await polishSection(engine, withReview)
    expect(r).toEqual({ text: good, ok: true, problems: [] })
    expect(create).toHaveBeenCalledTimes(2)
    const review = create.mock.calls[1][0].messages.at(-1).content as string
    expect(review).toContain('BEFORE:')
    expect(review).toContain('Activity: "Tic Tac Toe Game"')
    expect(review).toContain(`AFTER:\n${good}`)
  })

  it('rewrites once when the reviewer finds a change, and accepts a clean rewrite', async () => {
    const fixed = `${good} Riley built the board and added random computer moves.`
    const { engine, create } = fakeEngine([good, '- dropped "random computer moves"', fixed])
    const r = await polishSection(engine, withReview)
    expect(r).toEqual({ text: fixed, ok: true, problems: [] })
    expect(create).toHaveBeenCalledTimes(3)
    expect(create.mock.calls[2][0].messages.at(-1).content).toContain('dropped "random computer moves"')
  })

  it('keeps the polish that passed when the review rewrite breaks the checks', async () => {
    const { engine } = fakeEngine([good, '- dropped a detail', 'He built a board.'])
    const r = await polishSection(engine, withReview)
    expect(r).toEqual({ text: good, ok: true, problems: [] })
  })

  it('requires the instructor notes in their own paragraph on the facts path', () => {
    const merged = good.replace('\n\n', ' ')
    expect(checkPolish(merged, facts, ['loops', 'lists']).join()).toMatch(/new paragraph/)
  })

  it('skips the review when the polish already failed its checks', async () => {
    const { engine, create } = fakeEngine(['He built a board.', 'She built a board.'])
    expect((await polishSection(engine, withReview)).ok).toBe(false)
    expect(create).toHaveBeenCalledTimes(2)
  })
})
