import type { LucideIcon } from 'lucide-react'
import { MapPinned } from 'lucide-react'

type EmptyStateProps = { title: string; description: string; icon?: LucideIcon }

export function EmptyState({ title, description, icon: Icon = MapPinned }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-live="polite">
      <span className="empty-state__icon"><Icon size={36} strokeWidth={1.6} aria-hidden="true" /></span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  )
}
