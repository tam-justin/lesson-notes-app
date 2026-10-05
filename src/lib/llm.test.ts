import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MODEL, getSavedModelId, LOW_MEMORY_MODEL, MODELS, modelForAdapter, recommendedModelId, setModelId, type AdapterLike,
} from './llm'

const GIB = 1024 ** 3

const adapter = (over: { f16?: boolean; maxBuffer?: number } = {}): AdapterLike => ({
  features: { has: (n) => n === 'shader-f16' && (over.f16 ?? true) },
  limits: { maxBufferSize: over.maxBuffer ?? 4 * GIB },
})

describe('modelForAdapter', () => {
  it('recommends the 8B when the GPU has f16 and room for a 4 GiB buffer', () => {
    expect(modelForAdapter(adapter())).toBe(DEFAULT_MODEL)
    expect(modelForAdapter(adapter({ maxBuffer: 8 * GIB }))).toBe(DEFAULT_MODEL)
  })

  it('accepts the value a real GPU reports for its 4 GiB limit (a few bytes short)', () => {
    expect(modelForAdapter(adapter({ maxBuffer: 4294967292 }))).toBe(DEFAULT_MODEL)
  })

  it('falls back to the low-memory model for small buffers, no f16, or no adapter', () => {
    expect(modelForAdapter(adapter({ maxBuffer: 3.5 * GIB }))).toBe(LOW_MEMORY_MODEL)
    expect(modelForAdapter(adapter({ maxBuffer: 256 * 1024 ** 2 }))).toBe(LOW_MEMORY_MODEL)
    expect(modelForAdapter(adapter({ f16: false }))).toBe(LOW_MEMORY_MODEL)
    expect(modelForAdapter(null)).toBe(LOW_MEMORY_MODEL)
    expect(modelForAdapter(undefined)).toBe(LOW_MEMORY_MODEL)
  })
})

describe('recommendedModelId', () => {
  it('is the low-memory model when WebGPU is unavailable', async () => {
    expect(await recommendedModelId()).toBe(LOW_MEMORY_MODEL)
  })
})

describe('saved model choice', () => {
  beforeEach(() => localStorage.clear())

  it('is null until the user picks one, then remembered', () => {
    expect(getSavedModelId()).toBeNull()
    setModelId(MODELS[1].id)
    expect(getSavedModelId()).toBe(MODELS[1].id)
  })

  it('ignores unknown ids, such as a model that was removed', () => {
    localStorage.setItem('lesson-notes:model', 'Qwen2.5-7B-Instruct-q4f16_1-MLC')
    expect(getSavedModelId()).toBeNull()
  })
})
