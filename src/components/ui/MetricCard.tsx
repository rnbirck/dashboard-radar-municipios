import type { LucideIcon } from 'lucide-react'

type MetricCardProps = {
  icon: LucideIcon
  value: string
  label: string
  note: string
  accent?: boolean
}

export function MetricCard({ icon: Icon, value, label, note, accent = false }: MetricCardProps) {
  return (
    <article className={accent ? 'metric-card metric-card--accent' : 'metric-card'}>
      <span className="metric-card__icon"><Icon size={27} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="metric-card__copy">
        <strong>{value}</strong>
        <b>{label}</b>
        <small>{note}</small>
      </span>
    </article>
  )
}
