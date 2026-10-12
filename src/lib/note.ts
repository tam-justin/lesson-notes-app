import type { Activity, ConceptEntry, Lesson, NoteSection, Rating, Student } from '../types'

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : items.length === 2
      ? `${items[0]} and ${items[1]}`
      : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`

const sentence = (s: string) => {
  const t = s.trim()
  if (!t) return ''
  const cap = t[0].toUpperCase() + t.slice(1)
  return /[.!?]$/.test(cap) ? cap : `${cap}.`
}

const PHRASE: Record<Rating, (c: string) => string> = {
  4: (c) => `handled ${c} with ease`,
  3: (c) => `worked independently on ${c}`,
  2: (c) => `needed some support with ${c}`,
  1: (c) => `found ${c} challenging and needed a lot of guidance`,
}

/** Rating groups, best first, as clauses like "worked independently on loops". */
function ratingClauses(concepts: ConceptEntry[]) {
  return ([4, 3, 2, 1] as Rating[])
    .map((r) => {
      const names = concepts.filter((c) => c.rating === r).map((c) => c.name)
      return names.length ? PHRASE[r](list(names)) : ''
    })
    .filter(Boolean)
}

/** One sentence for the facts the AI sees. */
function ratingSentence(first: string, concepts: ConceptEntry[]) {
  const parts = ratingClauses(concepts)
  return parts.length ? `${first} ${list(parts)}.` : ''
}

/** For the note itself: at most two clauses per sentence, so three or four ratings do not become one run-on. */
function ratingSentences(first: string, concepts: ConceptEntry[]) {
  const parts = ratingClauses(concepts)
  const out: string[] = []
  for (let i = 0; i < parts.length; i += 2) out.push(`${first} ${list(parts.slice(i, i + 2))}.`)
  return out
}

const VERB_FIRST = /^(\w+ed|got|had|made|ran|wrote|took|found|did|forgot|kept|knew|saw|said|asked)\b/i

/**
 * A comment is the instructor's fragment. One that starts with a verb ("forgot to reset the index") gets the student
 * as its subject; anything else ("indexing was tricky") stands on its own after "Regarding <concept>,".
 */
function commentSentence(first: string, concept: string, text: string) {
  const end = /[.!?]$/.test(text) ? '' : '.'
  if (VERB_FIRST.test(text)) return `With ${concept}, ${first} ${text[0].toLowerCase()}${text.slice(1)}${end}`
  const keep = text.split(/\s/)[0] === first || /^[A-Z]{2,}|^I\b/.test(text)
  return `Regarding ${concept}, ${keep ? text : text[0].toLowerCase() + text.slice(1)}${end}`
}

/** What an activity says, in one place: both the template note and the AI's facts are built from this. */
function activityParts(first: string, a: Activity) {
  return {
    name: a.name.trim(),
    concepts: a.concepts.map((c) => c.name),
    rating: ratingSentence(first, a.concepts),
    comments: a.concepts.filter((c) => c.comment.trim()).map((c) => ({ concept: c.name, text: c.comment.trim() })),
    details: a.details.trim(),
  }
}

function activityText(first: string, a: Activity, lead: string) {
  const p = activityParts(first, a)
  // Every concept carries a rating, so the rating sentences already name them all.
  const summary = [
    p.name && `${lead} "${p.name}".`,
    ...ratingSentences(first, a.concepts),
    ...p.comments.map((c) => commentSentence(first, c.concept, c.text)),
  ]
    .filter(Boolean)
    .join(' ')
  return [summary, p.details && sentence(p.details)].filter(Boolean).join('\n\n')
}

/** The raw facts behind a section, one per line, for the AI to turn into prose. */
export function sectionFacts(student: Pick<Student, 'firstName'>, lesson: Lesson, heading: string): string[] {
  if (heading === 'Plan for next week') {
    return lesson.nextPlan.trim() ? [`Plan for next week: ${lesson.nextPlan.trim()}`] : []
  }
  const p = activityParts(student.firstName, heading === 'Warmup' ? lesson.warmup : lesson.main)
  return [
    p.name && `Activity: "${p.name}"`,
    p.concepts.length && `Concepts covered: ${list(p.concepts)}`,
    p.rating,
    ...p.comments.map((c) => `About ${c.concept}: ${c.text}`),
    p.details && `Instructor's notes: ${p.details}`,
  ].filter((f): f is string => typeof f === 'string' && f !== '')
}

/** Concept names that must appear in a polished version of the section. */
export function requiredTerms(lesson: Lesson, heading: string): string[] {
  if (heading === 'Warmup') return lesson.warmup.concepts.map((c) => c.name)
  if (heading === 'Main activity') return lesson.main.concepts.map((c) => c.name)
  return []
}

export function templateNote(student: Pick<Student, 'firstName'>, lesson: Lesson): NoteSection[] {
  const first = student.firstName
  return [
    { heading: 'Warmup', body: activityText(first, lesson.warmup, 'We started with') },
    { heading: 'Main activity', body: activityText(first, lesson.main, 'Our main activity was') },
    { heading: 'Plan for next week', body: lesson.nextPlan.trim() ? sentence(lesson.nextPlan) : '' },
  ]
}

export interface ResolvedSection extends NoteSection {
  /** What the template generates from the lesson right now. */
  generated: string
  /** The section has a hand-edited or polished override. */
  edited: boolean
  /** The lesson changed after the override was made, so the override may be out of date. */
  stale: boolean
}

/** The live note: generated text, except where the user has overridden a section. */
export function resolveNote(student: Pick<Student, 'firstName'>, lesson: Lesson): ResolvedSection[] {
  return templateNote(student, lesson).map(({ heading, body: generated }) => {
    const edit = lesson.noteEdits[heading]
    return {
      heading,
      body: edit ? edit.text : generated,
      generated,
      edited: !!edit,
      stale: !!edit && edit.baseline !== generated,
    }
  })
}

export const blankSections =(note: NoteSection[]) => note.filter((s) => !s.body.trim()).map((s) => s.heading)

export const toPlain = (note: NoteSection[]) =>
  note.filter((s) => s.body.trim()).map((s) => `${s.heading}\n${s.body.trim()}`).join('\n\n')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const toHtml = (note: NoteSection[]) =>
  note
    .filter((s) => s.body.trim())
    .map((s) => `<h2>${esc(s.heading)}</h2>${s.body.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}`)
    .join('')
