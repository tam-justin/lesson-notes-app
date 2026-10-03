import { Component, type ErrorInfo, type ReactNode } from 'react'

const KEY = 'lesson-notes:v1'

function downloadRawData() {
  let raw = ''
  try {
    raw = localStorage.getItem(KEY) ?? ''
  } catch {
    /* storage unavailable */
  }
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([raw || '{}'], { type: 'application/json' })),
    download: `lesson-notes-raw-${new Date().toLocaleDateString('en-CA')}.json`,
  })
  a.click()
  URL.revokeObjectURL(a.href)
}

interface State {
  error: Error | null
  confirmClear: boolean
}

/**
 * Last line of defence: if rendering crashes (for example on corrupt saved data), show a way out that keeps the
 * user's data recoverable instead of a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, confirmClear: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lesson Notes crashed', error, info.componentStack)
  }

  clearAndReload = () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* storage unavailable */
    }
    location.hash = '#/'
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    const btn = 'inline-flex h-11 items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2'
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="mb-2 text-3xl font-bold">Something went wrong</h1>
        <p className="mb-6 text-muted">
          The app hit an error, possibly because of damaged saved data. Your notes are still on this device. Download a copy first, then try again.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={`${btn} !border-transparent !bg-ink !text-on-ink`} onClick={downloadRawData}>Download my data</button>
          <button className={btn} onClick={() => location.reload()}>Reload</button>
        </div>
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer text-muted">Still broken?</summary>
          <p className="mt-2 text-muted">
            Clearing removes everything saved in this browser. Only do this after downloading your data.
          </p>
          {this.state.confirmClear ? (
            <button className={`${btn} mt-3 text-danger`} onClick={this.clearAndReload}>Yes, erase everything and restart</button>
          ) : (
            <button className={`${btn} mt-3 text-danger`} onClick={() => this.setState({ confirmClear: true })}>Clear saved data…</button>
          )}
        </details>
        <p className="mt-8 font-mono text-xs text-muted">{this.state.error.message}</p>
      </main>
    )
  }
}
