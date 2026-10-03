import { beforeEach, describe, expect, it } from 'vitest'
import { getSavedModelId, MODELS, modelForAdapter, recommendedModelId, setModelId, type AdapterLike } from './llm'

const [STANDARD, HIGH] = [MODELS[0].id, MODELS[1].id]
const GIB = 1024 ** 3

const adapter = (over: { f16?: boolean; maxBuffer?: number } = {}): AdapterLike => ({
  features: { has: (n) => n === 'shader-f16' && (over.f16 ?? true) },
  limits: { maxBufferSize: over.maxBuffer ?? 4 * GIB },
})

describe('modelForAdapter', () => {
  it('recommends the 7B when the GPU has f16 and room for a 4 GiB buffer', () => {
    expect(modelForAdapter(adapter())).toBe(HIGH)
    expect(modelForAdapter(adapter({ maxBuffer: 8 * GIB }))).toBe(HIGH)
  })

  it('accepts the value a real GPU reports for its 4 GiB limit (a few bytes short)', () => {
    expect(modelForAdapter(adapter({ maxBuffer: 4294967292 }))).toBe(HIGH)
  })

  it('falls back to the 3B for small buffers, no f16, or no adapter', () => {
    expect(modelForAdapter(adapter({ maxBuffer: 3.5 * GIB }))).toBe(STANDARD)
    expect(modelForAdapter(adapter({ maxBuffer: 2 * GIB }))).toBe(STANDARD)
    expect(modelForAdapter(adapter({ maxBuffer: 256 * 1024 ** 2 }))).toBe(STANDARD)
    expect(modelForAdapter(adapter({ f16: false }))).toBe(STANDARD)
    expect(modelForAdapter(null)).toBe(STANDARD)
    expect(modelForAdapter(undefined)).toBe(STANDARD)
  })
})

describe('recommendedModelId', () => {
  it('is the 3B when WebGPU is unavailable', async () => {
    expect(await recommendedModelId()).toBe(STANDARD)
  })
})

describe('saved model choice', () => {
  beforeEach(() => localStorage.clear())

  it('is null until the user picks one, then remembered', () => {
    expect(getSavedModelId()).toBeNull()
    setModelId(HIGH)
    expect(getSavedModelId()).toBe(HIGH)
  })

  it('ignores unknown ids', () => {
    localStorage.setItem('lesson-notes:model', 'not-a-model')
    expect(getSavedModelId()).toBeNull()
  })
})
