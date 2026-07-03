import type { LucideIcon } from 'lucide-react'

type MetricCardProps = {
  icon: LucideIcon
  value: string
  label: string
  note: string
  accent?: boolean
  loading?: boolean
}

export function MetricCard({ icon: Icon, value, label, note, accent = false, loading = false }: MetricCardProps) {
  return (
    <article className={accent ? 'metric-card metric-card--accent' : 'metric-card'} aria-busy={loading || undefined}>
      <span className="metric-card__icon"><Icon size={27} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="metric-card__copy">
        {loading ? <span className="metric-card__skeleton" aria-hidden="true" /> : <strong>{value}</strong>}
        <b>{label}</b>
        <small>{note}</small>
      </span>
    </article>
  )
}
