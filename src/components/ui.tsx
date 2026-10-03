import * as RDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-on-ink hover:opacity-90',
  outline: 'border border-line bg-surface hover:bg-surface-2',
  ghost: 'hover:bg-surface-2',
  danger: 'border border-line text-danger hover:bg-surface-2',
}

export function Button({
  variant = 'outline',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 ${variants[variant]} ${className}`}
    />
  )
}

const field =
  'rounded-md border border-line bg-surface-2 px-3 py-2 text-base placeholder:text-muted focus:bg-surface md:text-[15px]'

// Every single-line control shares one height (44px on touch, 40px on desktop) so rows of them line up.
const control = 'h-11 md:h-10'

// "fill" (index.css) makes a control full width as a low-priority default, so any w-* class a caller passes wins.
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`fill ${field} ${control} ${p.className ?? ''}`} />
}

export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={`fill ${field} ${control} pr-8 ${p.className ?? ''}`} />
}

export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`fill area ${field} resize-y leading-relaxed ${p.className ?? ''}`} />
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  children: ReactNode
  wide?: boolean
}) {
  // These dialogs are opened by state, not a Radix Trigger, so Radix has nothing to return focus to. Remember
  // whatever had focus when the dialog opened and put focus back there when it closes.
  const opener = useRef<HTMLElement | null>(null)
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <RDialog.Content
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            opener.current?.focus()
          }}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={`fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden border border-line bg-surface shadow-[0_8px_24px_rgb(0_0_0/0.12)] max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-lg max-md:pb-[env(safe-area-inset-bottom)] md:left-1/2 md:top-1/2 md:w-[calc(100%-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg ${wide ? 'md:max-w-3xl' : 'md:max-w-md'}`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <RDialog.Title className="font-display text-xl font-semibold">{title}</RDialog.Title>
              {description && <RDialog.Description className="mt-0.5 text-sm text-muted">{description}</RDialog.Description>}
            </div>
            <RDialog.Close className="-mr-2 grid size-11 place-items-center rounded-md hover:bg-surface-2 md:size-10" aria-label="Close">
              <X size={18} />
            </RDialog.Close>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** In-app replacement for window.confirm, so destructive actions look and behave like the rest of the app. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  /** Red styling for actions that lose data for good; pass false for reversible ones such as a reset. */
  destructive?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button
          className="flex-1"
          variant={destructive ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}

const HUES = ['#5f7344', '#3f7a70', '#566c96', '#84608f', '#8a6a3a', '#96503f']

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const hue = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-display font-semibold text-white"
      style={{ width: size, height: size, background: hue, fontSize: size * 0.42 }}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {actions}
    </div>
  )
}
