import { act } from '@testing-library/react'

/** Saves are batched; the app also writes immediately when the page is hidden, which is what this triggers. */
export const flushSave = () => act(() => window.dispatchEvent(new Event('pagehide')))
