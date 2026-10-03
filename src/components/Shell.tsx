import { Home, Settings, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { clock } from '../lib/format'
import { useStore } from '../store'

const NAV: { to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { to: '/', label: 'Dashboard', icon: Home, match: (p) => p === '/' || p.startsWith('/lessons') },
  { to: '/students', label: 'Students', icon: Users, match: (p) => p.startsWith('/students') },
  { to: '/settings', label: 'Settings', icon: Settings, match: (p) => p === '/settings' },
]

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { saved } = useStore()
  return (
    <div className="min-h-dvh md:pl-16 lg:pl-60">
      {saved.error && (
        <div role="alert" className="fixed inset-x-0 top-0 z-40 border-b border-danger bg-surface px-4 py-2 text-center text-sm text-danger md:pl-20 lg:pl-64">
          Couldn't save to this device. Storage may be full. Export a backup in Settings so nothing is lost.
        </div>
      )}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink">
        Skip to content
      </a>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:w-16 md:flex-col md:border-r md:border-t-0 md:pb-0 lg:w-60"
      >
        <div className="hidden items-center gap-2.5 px-4 py-5 md:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-hilite font-display text-sm font-bold text-[#1b2224]">LN</span>
          <span className="hidden font-display text-lg font-bold lg:block">Lesson Notes</span>
        </div>
        <ul className="flex flex-1 md:block md:space-y-1 md:px-2">
          {NAV.map(({ to, label, icon: Icon, match }) => {
            const on = match(path)
            return (
              <li key={to} className="flex-1 md:flex-none">
                <a
                  href={`#${to}`}
                  aria-current={on ? 'page' : undefined}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium md:h-10 md:flex-row md:justify-center md:gap-3 md:rounded-md md:text-sm lg:justify-start lg:px-3 ${on ? 'font-semibold text-fg max-md:border-t-2 max-md:border-ink md:bg-hilite-soft' : 'text-muted hover:text-fg max-md:border-t-2 max-md:border-transparent md:hover:bg-surface-2'}`}
                >
                  <Icon size={20} aria-hidden />
                  <span className="md:sr-only lg:not-sr-only">{label}</span>
                </a>
              </li>
            )
          })}
        </ul>
        <p className="hidden px-4 py-4 text-xs text-muted lg:block">
          Stored on this device
          <br />
          <span className="font-mono">Saved {clock(saved.at)}</span>
        </p>
      </nav>
      <main id="main" className="mx-auto max-w-[1120px] px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8 lg:pt-10">
        {children}
      </main>
    </div>
  )
}
