export const SYSTEM = `You edit lesson notes that a coding instructor sends to parents.
Turn the FACTS into smooth, correct prose.

Voice: first-person plural ("we"), formal and warm. Past tense for what happened, future tense for plans.

Rules:
1. Use every fact. Add nothing: no reasons, goals, praise, evaluations, or background that is not in the FACTS.
2. Do not use filler such as "introductory", "foundational", "reinforce", "solidify", "demonstrate", "great", or "excellent".
3. Say how the student did only as the FACTS say. Never blur different ratings together.
4. Refer to the student by first name. Never use he, she, him, her, his, or hers. Use "they" or "their" sparingly, or repeat the name.
5. Put activity names in quotes and fix obvious spelling mistakes in them. Keep concept names as written.
6. Write 2 to 4 sentences. No lists, no headings, no greeting, no sign-off. Output only the note text.`

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
      'Concepts covered: strings, loops',
      'Maya breezed through strings and worked independently on loops.',
      "Instructor's notes: tried slicing first then wrote a for loop herself",
    ],
    text: 'We began with the warmup activity "Reverse a String", which covered strings and loops. Maya breezed through strings and worked independently on loops. Maya tried slicing first and then wrote a for loop without help.',
  },
  {
    heading: 'Main activity',
    student: 'Sam',
    facts: [
      'Activity: "Pong Game"',
      'Concepts covered: functions, conditionals',
      'Sam worked independently on conditionals and found functions challenging and needed significant guidance.',
      "Instructor's notes: got the paddle moving, ball bounce logic not finished",
    ],
    text: 'For the main activity, we worked on "Pong Game", which covered functions and conditionals. Sam worked independently on conditionals but found functions challenging and needed significant guidance. Sam got the paddle moving, and the ball bounce logic is not yet finished.',
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

const FILLER = /\b(introductory|foundational|reinforc\w*|solidif\w*|demonstrat\w*|excellent|great|impressive|wonderful|fantastic|strong)\b/gi
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

/** Returns a list of problems with a polished section; an empty list means it is acceptable. */
export function checkPolish(output: string, facts: string[], required: string[]): string[] {
  const problems: string[] = []
  const out = output.trim()
  if (!out) return ['the output was empty']

  const factText = facts.join(' ')
  const missing = required.filter((t) => !norm(out).includes(norm(t)))
  if (missing.length) problems.push(`it left out: ${missing.join(', ')}`)

  const filler = [...new Set((out.match(FILLER) ?? []).map((w) => w.toLowerCase()))].filter(
    (w) => !new RegExp(`\\b${w}`, 'i').test(factText),
  )
  if (filler.length) problems.push(`it added filler words not in the facts: ${filler.join(', ')}`)

  const pronouns = [...new Set((out.match(GENDERED) ?? []).map((w) => w.toLowerCase()))]
  if (pronouns.length) problems.push(`it used gendered pronouns (${pronouns.join(', ')}); use the student's name instead`)

  // Activity names may have an obvious typo fixed, but must not be reworded.
  const names = activityNames(facts)
  const inOutput = quoted(out)
  for (const name of names) {
    if (!inOutput.some((q) => editDistance(squash(q), squash(name)) <= MAX_NAME_EDITS)) {
      problems.push(`it changed or dropped the activity name "${name}" (keep it in quotes, fixing at most a one or two letter typo)`)
    }
  }
  const stray = inOutput.filter(
    (q) => !names.some((n) => editDistance(squash(q), squash(n)) <= MAX_NAME_EDITS) && !squash(factText).includes(squash(q)),
  )
  if (stray.length) problems.push(`it put text in quotes that is not an activity name: ${stray.map((q) => `"${q}"`).join(', ')}`)

  const words = (s: string) => s.split(/\s+/).filter(Boolean).length
  if (words(out) > words(factText) * 2 + 25) problems.push('it was much longer than the facts justify')

  return problems
}
