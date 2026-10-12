export const SYSTEM = `You edit lesson notes that a coding instructor sends to parents.
Turn the FACTS into smooth, correct prose.

Voice: first-person plural ("we"), formal and warm. Past tense for what happened, future tense for plans.

Rules:
1. Use every fact. Add nothing: no reasons, goals, praise, evaluations, or background that is not in the FACTS.
2. Do not use filler such as "introductory", "foundational", "reinforce", "solidify", "demonstrate", "great", or "excellent".
3. Say how the student did only as the FACTS say. Never blur different ratings together.
4. Refer to the student by first name. Never use he, she, him, her, his, or hers. Use "they" or "their" sparingly, or repeat the name.
5. Put activity names in quotes and fix obvious spelling mistakes in them. Keep concept names as written.
6. Mention each concept once, together with how the student did. Do not list the concepts separately before the ratings.
7. Work an instructor's comment about a concept into a sentence of its own, with the student's name as the subject.
8. Keep every number, tool name, and other detail from the instructor's notes. Where a note says "we" did something, keep "we"; do not change it to "they" or the student's name.
9. Put the instructor's notes in their own paragraph, after a blank line, as the example shows.
10. Write 2 to 5 sentences. No lists, no headings, no greeting, no sign-off. Output only the note text.`

interface Example {
  heading: string
  student: string
  facts: string[]
  text: string
}

export const EXAMPLES: Example[] = [
  {
    heading: 'Warmup',
    student: 'Maya',
    facts: [
      'Activity: "reverse a strng"',
      'Concepts covered: strings and loops',
      'Maya handled strings with ease and worked independently on loops.',
      "Instructor's notes: tried slicing first then wrote a for loop herself",
    ],
    text: 'We started with "Reverse a String". Maya handled strings with ease and worked independently on loops.\n\nMaya tried slicing first and then wrote a for loop without help.',
  },
  {
    heading: 'Main activity',
    student: 'Sam',
    facts: [
      'Activity: "Pong Game"',
      'Concepts covered: functions and conditionals',
      'Sam worked independently on conditionals and found functions challenging and needed a lot of guidance.',
      'About functions: needed a worked example',
      "Instructor's notes: got the paddle moving, ball bounce logic not finished",
    ],
    text: 'Our main activity was "Pong Game". Sam worked independently on conditionals but found functions challenging and needed a lot of guidance. With functions, Sam needed a worked example.\n\nSam got the paddle moving, and the ball bounce logic is not yet finished.',
  },
  {
    heading: 'Plan for next week',
    student: 'Sam',
    facts: ['Plan for next week: add scoring and a game over screen'],
    text: 'Next week, we will add scoring and a game over screen.',
  },
]

export const factsMessage = (student: string, heading: string, facts: string[]) =>
  `Student: ${student}\nSection: ${heading}\nFACTS:\n${facts.map((f) => `- ${f}`).join('\n')}`

/** Used when the instructor has already written or edited the section: their text is the source, not the lesson data. */
export const DRAFT_SYSTEM = `You lightly edit a lesson note that a coding instructor wrote for a parent.
The DRAFT is the instructor's own text. Improve its grammar, spelling and flow and nothing else.

Rules:
1. Keep the instructor's wording, order, details, and paragraph breaks wherever they are already clear. Change as little as possible.
2. Add nothing and remove nothing: no new facts, reasons, goals, praise, or evaluations, and keep every detail and rating the draft states.
3. Keep the voice (first-person plural "we", warm and formal) and the tense. Where the draft says "we", keep "we"; never change it to "they" or the student's name.
   Keep every sentence, number, and tool name. Fix spelling and grammar errors you find, without rewording what is already correct.
4. Refer to the student by first name. Never use he, she, him, her, his, or hers.
5. Keep activity names in quotes and fix obvious spelling mistakes in them.
6. Output only the edited note text. No headings, no greeting, no sign-off, no commentary.`

export const DRAFT_EXAMPLES: Example[] = [
  {
    heading: 'Warmup',
    student: 'Maya',
    facts: ['we did "reverse a strng" as a warmup. maya tried slicing first then wrote the for loop herself, took her a few tries tho'],
    text: 'We did "Reverse a String" as a warmup. Maya tried slicing first and then wrote the for loop herself. It took her a few tries, but she got there.',
  },
  {
    heading: 'Plan for next week',
    student: 'Sam',
    facts: ['Next week we will finish the bounce logic and start on scoring.'],
    text: 'Next week, we will finish the bounce logic and start on scoring.',
  },
]

/** The second pass: it only lists differences in meaning between BEFORE and AFTER, it never rewrites. */
export const REVIEW_SYSTEM = `You compare two versions of a lesson note for a parent. BEFORE is the source of truth. AFTER is a polished version.
List every difference in meaning: a fact, concept, detail, or comment that AFTER added, dropped, or changed; a student rating that became stronger, weaker, or blurred together with another; a wrong tense (plans must be future, what happened must be past); a changed activity name.
Ignore differences in wording, order, and grammar that keep the same meaning.

Output format, nothing else:
- If there are no differences in meaning, output exactly: OK
- Otherwise output one line per difference, each starting with "- " and naming the exact words involved.`

export const reviewMessage = (before: string, after: string) => `BEFORE:\n${before}\n\nAFTER:\n${after}`

/** Reads the reviewer's reply into a list of problems; an empty list means it found nothing. */
export function parseReview(reply: string): string[] {
  const text = reply.trim()
  if (!text || /^OK\b/i.test(text)) return []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const items = lines.filter((l) => /^([-*•]|\d+[.)])\s+/.test(l)).map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, ''))
  const found = items.filter((l) => !/^OK\b/i.test(l)).slice(0, 5)
  if (found.length) return found
  if (items.length) return []
  // Prose with no list: a finding unless it plainly says there are none. A false alarm only costs one checked rewrite.
  const clean = /\b(no|not any|without any) (meaningful |significant )?(differences?|changes?|problems?|issues?|discrepanc\w+)\b|\b(everything|all|both) (matches|matched|is (the )?same|are (the )?same|is accurate|is preserved|is consistent)\b|\bidentical\b|\bsame meaning\b/i
  if (clean.test(text)) return []
  return [text.slice(0, 300)]
}

export const draftMessage =(student: string, heading: string, draft: string) =>
  `Student: ${student}\nSection: ${heading}\nDRAFT:\n${draft}`

/**
 * The instructor's own text often says "his" or "she". The model copies it, then fails the pronoun check twice. So the
 * text it is sent already uses the student's name; the checks still run against the original.
 */
export function neutralizePronouns(text: string, name: string): string {
  const objectNext = '(a|an|the|some|another|this|that|it|them|to|with|for|on|in|at|up|through|and|but|when|before|after)'
  // Possessives become "their" so the name is not repeated ("Riley did polishing for Riley's app").
  return text
    .replace(/\b(his|hers)\b/gi, 'their')
    .replace(new RegExp(`\\bher\\b(?!\\s+${objectNext}\\b)(?=\\s+[a-z])`, 'gi'), 'their')
    .replace(/\b(he|she|him|her)\b/gi, name)
    .replace(/\b(himself|herself)\b/gi, 'themselves')
}

const FILLER =/\b(introductory|foundational|reinforc\w*|solidif\w*|demonstrat\w*|excellent|great|impressive|wonderful|fantastic|strong)\b/gi
const GENDERED = /\b(he|she|him|his|her|hers|himself|herself)\b/gi

const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ')

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** A typo fix may change a letter or two; anything bigger means the model rewrote the name. */
const MAX_NAME_EDITS = 2

const activityNames = (facts: string[]) =>
  facts.map((f) => /^Activity: "(.+)"$/.exec(f)?.[1]).filter((n): n is string => !!n)

const quoted = (text: string) => [...text.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1])

/** A line break of any kind starts a new paragraph: the note is rendered with one, and the instructor chose it. */
const paragraphs = (s: string) => s.split(/\n+/).filter((p) => p.trim()).length

const wordsOf = (s: string) => s.toLowerCase().match(/[a-z']{4,}/g) ?? []

/**
 * A light edit may fix wording but must not reintroduce what the instructor removed. Lesson terms missing from the
 * draft are forbidden outright; beyond that, only a few new content words are tolerated.
 */
function checkDraft(out: string, draft: string, knownTerms: string[], student = ''): string[] {
  const problems: string[] = []
  if (paragraphs(out) < paragraphs(draft)) problems.push('it merged paragraphs; keep the same paragraph breaks as the draft')

  const back = knownTerms.filter((t) => !norm(draft).includes(norm(t)) && norm(out).includes(norm(t)))
  if (back.length) problems.push(`it put back details the instructor removed: ${back.join(', ')}`)

  // A corrected spelling counts as the same word, so fixing typos is never "new content".
  const have = wordsOf(draft)
  // The student's name replaces "he", "his" and the like, so it is never new content.
  const name = student.toLowerCase()
  const novel = [...new Set(wordsOf(out.replace(/["“][^"”]+["”]/g, ' ')))].filter(
    (w) => !(name && w.startsWith(name)) && !have.some((h) => near(w, h)),
  )
  const allowed = Math.max(2, Math.floor(have.length * 0.1))
  if (novel.length > allowed) problems.push(`it added content that is not in the draft: ${novel.join(', ')}`)
  return problems
}

const STOP = new Set(
  'that this with from have they them their there then than were what when which would could should about into also just very much some more over only will been being after before while your ours does done made'.split(' '),
)

/** Same word, allowing a plural, a tense change, or a corrected spelling. */
function near(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true
  return editDistance(a, b) <= (Math.max(a.length, b.length) >= 6 ? 2 : 1)
}

/** Share of a sentence's content words that must survive; below 1 so a synonym or two does not sink a good edit. */
const KEEP_RATIO = 0.6

const contentWords = (s: string) => [...new Set(wordsOf(s))].filter((w) => !STOP.has(w))
const sentencesOf = (s: string) => s.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean)
const FIRST_PERSON = /\b(we|our|us|we're|we'll)\b/i

/**
 * Details the instructor wrote must survive: every number, and every sentence (most of its content words). A
 * sentence about what "we" did must still say "we" rather than switch to a name or "they".
 */
function checkCoverage(out: string, sources: string[]): string[] {
  const problems: string[] = []
  const src = sources.join(' ')
  const outWords = wordsOf(out)

  const numbers = [...new Set(src.match(/\d+(?:\.\d+)?/g) ?? [])].filter((n) => !new RegExp(`(?<![\\d.])${n}(?![\\d])`).test(out))
  if (numbers.length) problems.push(`it dropped numbers from the source: ${numbers.join(', ')}`)

  const outSentences = sentencesOf(out)
  for (const sentence of sources.flatMap(sentencesOf)) {
    const words = contentWords(sentence)
    if (words.length < 2) continue
    const hit = (s: string) => words.filter((w) => wordsOf(s).some((o) => near(w, o))).length
    if (words.filter((w) => outWords.some((o) => near(w, o))).length < Math.ceil(words.length * KEEP_RATIO)) {
      problems.push(`it dropped or rewrote a detail: "${sentence.slice(0, 80)}" (keep every detail)`)
      continue
    }
    if (FIRST_PERSON.test(sentence)) {
      const best = outSentences.reduce((a, b) => (hit(b) > hit(a) ? b : a), '')
      if (best && !FIRST_PERSON.test(best)) problems.push(`it changed "we" to a name or "they" in: "${sentence.slice(0, 80)}"`)
    }
  }
  return problems
}

/**
 * Puts back paragraph breaks the model folded away. Each later paragraph of the source is located in the output by
 * its first sentence, and a break is inserted before the sentence that matches best.
 */
export function restoreParagraphs(out: string, starts: string[]): string {
  if (!starts.length || paragraphs(out) > starts.length) return out
  const parts = out.split(/(?<=[.!?])(\s+)/) // sentence, separator, sentence, ...
  for (const start of starts) {
    const words = contentWords(sentencesOf(start)[0] ?? '')
    if (words.length < 2) continue
    let best = -1
    let bestHit = 0
    for (let i = 2; i < parts.length; i += 2) {
      const have = wordsOf(parts[i])
      const hit = words.filter((w) => have.some((h) => near(w, h))).length
      if (hit > bestHit) [best, bestHit] = [i, hit]
    }
    if (best > 0 && bestHit >= Math.ceil(words.length * KEEP_RATIO) && !/\n\s*\n/.test(parts[best - 1])) parts[best - 1] = '\n\n'
  }
  return parts.join('')
}

/** Where the later paragraphs of the source begin: the extra paragraphs of a draft, or the instructor's notes. */
export function paragraphStarts(facts: string[], draft?: string): string[] {
  if (draft) return draft.split(/\n+/).map((p) => p.trim()).filter(Boolean).slice(1)
  const notes = facts.find((f) => f.startsWith("Instructor's notes:"))
  return notes ? [notes.replace(/^Instructor's notes:\s*/, '')] : []
}

/** The parts of the facts that are the instructor's own words, as opposed to lines built by the template. */
const freeText = (facts: string[]) =>
  facts
    .filter((f) => !/^(Activity|Concepts covered):/.test(f))
    .filter((f) => !/\b(handled .+ with ease|worked independently on|needed some support with|found .+ challenging)/.test(f))
    .map((f) => f.replace(/^(About [^:]+|Instructor's notes|Plan for next week|Instructor's draft): /, ''))

/** Returns a list of problems with a polished section; an empty list means it is acceptable. */
export function checkPolish(
  output: string,
  facts: string[],
  required: string[],
  /** Set when the instructor's own text is being edited: nothing may be put back that they took out. */
  draft?: { text: string; knownTerms: string[]; student?: string },
  /** The student's first name, which the model may use freely. */
  student = draft?.student ?? '',
): string[] {
  const problems: string[] = []
  const out = output.trim()
  if (!out) return ['the output was empty']
  if (draft) problems.push(...checkDraft(out, draft.text, draft.knownTerms, draft.student))

  const factText = facts.join(' ')
  problems.push(...checkCoverage(out, draft ? [draft.text] : freeText(facts)))
  // From the lesson facts the model may only restate them: a sentence mostly made of words the facts never use is invented.
  if (!draft) {
    const name = student.toLowerCase()
    const have = wordsOf(factText)
    for (const sentence of sentencesOf(out)) {
      const words = contentWords(sentence).filter((w) => !(name && w.startsWith(name)))
      if (words.length >= 3 && words.filter((w) => have.some((h) => near(w, h))).length < Math.ceil(words.length * 0.5)) {
        problems.push(`it added a sentence that is not in the facts: "${sentence.slice(0, 80)}"`)
      }
    }
  }
  // The template puts the instructor's notes in their own paragraph; a polish must not fold them into the summary.
  if (!draft && facts.some((f) => f.startsWith("Instructor's notes:")) && paragraphs(out) < 2) {
    problems.push("it put the instructor's notes in the same paragraph; start them in a new paragraph after a blank line")
  }
  const missing = required.filter((t) => !norm(out).includes(norm(t)))
  if (missing.length) problems.push(`it left out: ${missing.join(', ')}`)

  const filler = [...new Set((out.match(FILLER) ?? []).map((w) => w.toLowerCase()))].filter(
    (w) => !new RegExp(`\\b${w}`, 'i').test(factText),
  )
  if (filler.length) problems.push(`it added filler words not in the facts: ${filler.join(', ')}`)

  const pronouns = [...new Set((out.match(GENDERED) ?? []).map((w) => w.toLowerCase()))]
  if (pronouns.length) problems.push(`it used gendered pronouns (${pronouns.join(', ')}); use the student's name instead`)

  // Activity names may have an obvious typo fixed, but must not be reworded.
  const names = draft ? quoted(draft.text) : activityNames(facts)
  const inOutput = quoted(out)
  for (const name of names) {
    if (!inOutput.some((q) => editDistance(squash(q), squash(name)) <= MAX_NAME_EDITS)) {
      problems.push(`it changed or dropped the activity name "${name}" (keep it in quotes, fixing at most a one or two letter typo)`)
    }
  }
  // For an edited draft, only text the instructor already put in quotes may be quoted.
  const stray = inOutput.filter(
    (q) => !names.some((n) => editDistance(squash(q), squash(n)) <= MAX_NAME_EDITS) && (draft || !squash(factText).includes(squash(q))),
  )
  if (stray.length) problems.push(`it put text in quotes that is not an activity name: ${stray.map((q) => `"${q}"`).join(', ')}`)

  const words = (s: string) => s.split(/\s+/).filter(Boolean).length
  if (words(out) > words(factText) * 2 + 25) problems.push('it was much longer than the facts justify')

  return problems
}
