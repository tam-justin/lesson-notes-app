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
  4: (c) => `breezed through ${c}`,
  3: (c) => `worked independently on ${c}`,
  2: (c) => `needed some support with ${c}`,
  1: (c) => `found ${c} challenging and needed significant guidance`,
}

function ratingSentence(first: string, concepts: ConceptEntry[]) {
  const parts = ([4, 3, 2, 1] as Rating[])
    .map((r) => {
      const names = concepts.filter((c) => c.rating === r).map((c) => c.name)
      return names.length ? PHRASE[r](list(names)) : ''
    })
    .filter(Boolean)
  return parts.length ? `${first} ${list(parts)}.` : ''
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
  return [
    p.name && `${lead} "${p.name}".`,
    p.concepts.length && `This activity covered ${list(p.concepts)}.`,
    p.rating,
    ...p.comments.map((c) => `On ${c.concept}: ${sentence(c.text)}`),
    p.details && sentence(p.details),
  ]
    .filter(Boolean)
    .join(' ')
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
    { heading: 'Warmup', body: activityText(first, lesson.warmup, 'We started with the warmup activity') },
    { heading: 'Main activity', body: activityText(first, lesson.main, 'For the main activity, we worked on') },
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
