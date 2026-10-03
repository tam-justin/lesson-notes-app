import { Download, Monitor, Moon, Sun, Upload, type LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, ConfirmDialog, PageHeader } from '../components/ui'
import { migrate } from '../lib/migrate'
import { useStore } from '../store'
import type { AppData, Theme } from '../types'

const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export function SettingsPage() {
  const { data, setTheme, importData, markBackup } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<AppData | null>(null)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `lesson-notes-backup-${new Date().toLocaleDateString('en-CA')}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
    markBackup()
  }

  const onImport = async (f: File) => {
    try {
      const raw: unknown = JSON.parse(await f.text())
      const o = (raw ?? {}) as { students?: unknown; lessons?: unknown }
      if (!Array.isArray(o.students) || !Array.isArray(o.lessons)) throw new Error('Not a Lesson Notes backup')
      // Clean it up front so the counts below describe what will actually be restored.
      setMsg('')
      setPending(migrate(raw))
    } catch (e) {
      setMsg(`Could not import: ${e instanceof Error ? e.message : 'invalid file'}`)
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-xl space-y-6">
        <section aria-labelledby="theme" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="theme" className="mb-3 text-xl font-semibold">Appearance</h2>
          {/* Native radios: arrow keys, grouping and screen-reader semantics come for free. */}
          <div role="radiogroup" aria-labelledby="theme" className="inline-flex overflow-hidden rounded-md border border-line bg-surface">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <label key={value} className="relative cursor-pointer border-r border-line last:border-r-0">
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={data.theme === value}
                  onChange={() => setTheme(value)}
                  className="peer sr-only"
                />
                <span className="flex h-11 items-center gap-2 px-4 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 peer-checked:bg-ink peer-checked:text-on-ink peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-focus md:h-10">
                  <Icon size={16} aria-hidden /> {label}
                </span>
              </label>
            ))}
          </div>
        </section>
        <section aria-labelledby="backup" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="backup" className="mb-1 text-xl font-semibold">Backup</h2>
          <p className="mb-3 text-sm text-muted">
            Your data lives only in this browser. Clearing site data would erase it, so export a backup now and then.
            {' '}Last backup: {data.lastBackup ? new Date(data.lastBackup).toLocaleString() : 'never'}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={exportJson}><Download size={16} />Export JSON</Button>
            <Button onClick={() => file.current?.click()}><Upload size={16} />Import JSON</Button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
          </div>
          {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
        </section>
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Replace everything on this device?"
        description={`This restores ${pending?.students.length ?? 0} students and ${pending?.lessons.length ?? 0} lessons from the backup and removes what is here now.`}
        confirmLabel="Replace"
        onConfirm={() => {
          if (pending) importData(pending)
          setMsg('Backup restored.')
        }}
      />
    </>
  )
}
