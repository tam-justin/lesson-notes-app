import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import {
  checkPolish, DRAFT_EXAMPLES, DRAFT_SYSTEM, draftMessage, EXAMPLES, factsMessage, neutralizePronouns, paragraphStarts, parseReview,
  restoreParagraphs, REVIEW_SYSTEM, reviewMessage, SYSTEM,
} from './polish'

export const MODELS = [
  { id: 'Qwen3-8B-q4f16_1-MLC', label: 'Qwen3 8B, 5.7 GB' },
  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC', label: 'Llama 3.1 8B, 5 GB' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Low memory (Qwen2.5 3B, 2.5 GB)' },
] as const

/** The default on a capable GPU, used until the user picks one. */
export const DEFAULT_MODEL = MODELS[0].id
export const LOW_MEMORY_MODEL = MODELS[2].id

/** Shown when the low-memory model is selected. */
export const LOW_MEMORY_NOTE =
  'The low-memory model is less accurate: it can drop verbs, reword activity names, or blur ratings. Read each section carefully before copying.'

/** Qwen3 "thinks" aloud by default; the note must contain only the prose. */
const needsThinkingOff = (modelId: string) => modelId.startsWith('Qwen3')

const MODEL_KEY = 'lesson-notes:model'

/** The model the user picked explicitly, if any. */
export function getSavedModelId(): string | null {
  try {
    const saved = localStorage.getItem(MODEL_KEY)
    if (saved && MODELS.some((m) => m.id === saved)) return saved
  } catch {
    /* storage unavailable */
  }
  return null
}

const REVIEW_KEY = 'lesson-notes:review'

/** Whether to double-check polished text with a review pass. Off until the user turns it on. */
export function getReviewEnabled(): boolean {
  try {
    return localStorage.getItem(REVIEW_KEY) === 'on'
  } catch {
    return false
  }
}

export function setReviewEnabled(on: boolean) {
  try {
    localStorage.setItem(REVIEW_KEY, on ? 'on' : 'off')
  } catch {
    /* storage unavailable */
  }
}

export interface AdapterLike {
  features: { has(name: string): boolean }
  limits: { maxBufferSize: number }
}

const GIB = 1024 ** 3

/** Real GPUs report their 4 GiB limit a few bytes short (an Apple GPU gives 4294967292), so allow some slack. */
const MIN_BUFFER = 4 * GIB - 4096

/** The 8B models need half-precision support and room for a 4 GiB buffer (about 5 GB of GPU memory); otherwise use the 3B. */
export function modelForAdapter(adapter: AdapterLike | null | undefined): string {
  if (adapter?.features.has('shader-f16') && adapter.limits.maxBufferSize >= MIN_BUFFER) return DEFAULT_MODEL
  return LOW_MEMORY_MODEL
}

export async function recommendedModelId(): Promise<string> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<AdapterLike | null> } }).gpu
    return modelForAdapter(await gpu?.requestAdapter())
  } catch {
    return LOW_MEMORY_MODEL
  }
}

export function setModelId(id: string) {
  try {
    localStorage.setItem(MODEL_KEY, id)
  } catch {
    /* storage unavailable */
  }
}

export const webgpuAvailable = () => typeof navigator !== 'undefined' && 'gpu' in navigator

let current: { id: string; engine: Promise<MLCEngineInterface> } | null = null

/** Loads (or reuses) the engine for a model. Only one model is kept in memory at a time. */
export function loadEngine(modelId: string, onProgress: (fraction: number, text: string) => void) {
  if (current?.id === modelId) return current.engine
  const previous = current
  const engine = (async () => {
    if (previous) await previous.engine.then((e) => e.unload()).catch(() => {})
    const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
    return CreateWebWorkerMLCEngine(new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' }), modelId, {
      initProgressCallback: (r) => onProgress(r.progress, r.text),
    })
  })()
  current = { id: modelId, engine }
  engine.catch(() => {
    if (current?.engine === engine) current = null
  })
  return engine
}

export interface PolishInput {
  student: string
  heading: string
  facts: string[]
  /** The instructor's own text for a hand-edited section; when set, it is lightly edited instead of rebuilt from facts. */
  draft?: string
  /** All concept names in the lesson section; any the draft omits must stay out of the polished text. */
  knownTerms?: string[]
  /** Run a second, reviewing pass over the polished text. */
  review?: boolean
  /** Terms (concept names) that must survive into the output. */
  required: string[]
  /** The model in use, for per-model request options. */
  modelId?: string
}

export interface PolishResult {
  text: string
  ok: boolean
  problems: string[]
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * Turns a section's facts into prose. The output is checked against the facts; one retry is made with the
 * problems spelled out, and if it still fails the caller should keep its own draft (ok is false).
 */
export async function polishSection(e: Pick<MLCEngineInterface, 'chat'>, input: PolishInput): Promise<PolishResult> {
  const plain = (s: string) => neutralizePronouns(s, input.student)
  const sentFacts = input.facts.map(plain)
  const sentDraft = input.draft && plain(input.draft)
  const messages: Message[] = sentDraft
    ? [
        { role: 'system', content: DRAFT_SYSTEM },
        ...DRAFT_EXAMPLES.flatMap<Message>((x) => [
          { role: 'user', content: draftMessage(x.student, x.heading, x.facts[0]) },
          { role: 'assistant', content: x.text },
        ]),
        { role: 'user', content: draftMessage(input.student, input.heading, sentDraft) },
      ]
    : [
        { role: 'system', content: SYSTEM },
        ...EXAMPLES.flatMap<Message>((x) => [
          { role: 'user', content: factsMessage(x.student, x.heading, x.facts) },
          { role: 'assistant', content: x.text },
        ]),
        { role: 'user', content: factsMessage(input.student, input.heading, sentFacts) },
      ]

  const ask = async (msgs: Message[], temperature = 0.2, maxTokens = 300) => {
    const res = await e.chat.completions.create({
      messages: msgs,
      temperature,
      top_p: 0.9,
      max_tokens: maxTokens,
      ...(input.modelId && needsThinkingOff(input.modelId) ? { extra_body: { enable_thinking: false } } : {}),
    })
    return (res.choices[0]?.message?.content ?? '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/([^\n])\n(?!\n)/g, '$1\n\n')
      .replace(/(\S) {2,}/g, '$1 ')
      .trim()
  }

  const draft = input.draft ? { text: input.draft, knownTerms: input.knownTerms ?? [], student: input.student } : undefined
  const check = (t: string) => checkPolish(t, input.facts, input.required, draft, input.student)
  // Models fold paragraphs together; put the source's breaks back before judging the text.
  const starts = paragraphStarts(input.facts, input.draft)
  const askNote = async (msgs: Message[]) => restoreParagraphs(await ask(msgs), starts)

  let text = await askNote(messages)
  let problems = check(text)
  if (problems.length) {
    text = await askNote([
      ...messages,
      { role: 'assistant', content: text },
      { role: 'user', content: `That was rejected: ${problems.join('; ')}. Rewrite it following every rule. Output only the note text.` },
    ])
    problems = check(text)
  }

  // Second pass: a reviewer lists what changed in meaning against the source. Any finding earns one more rewrite,
  // which must pass the same code checks; otherwise the caller keeps its own draft.
  if (input.review && problems.length === 0) {
    const before = sentDraft || sentFacts.join('\n')
    const found = parseReview(await ask([
      { role: 'system', content: REVIEW_SYSTEM },
      { role: 'user', content: reviewMessage(before, text) },
    ], 0, 200))
    if (found.length) {
      const rewrite = await askNote([
        ...messages,
        { role: 'assistant', content: text },
        { role: 'user', content: `A reviewer compared that with the source and found: ${found.join('; ')}. Rewrite it so none of these remain. Output only the note text.` },
      ])
      // The reviewer is advisory and a small model: use the rewrite only if it passes every check. Otherwise keep the
      // polish that already passed, rather than throwing it away for the draft.
      if (check(rewrite).length === 0) text = rewrite
    }
  }
  return { text, ok: problems.length === 0, problems }
}
