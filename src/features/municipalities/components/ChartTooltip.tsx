import type { TooltipRow } from './municipalityChartUtils'

export function ChartTooltip({ title, rows, left, top }: { title: string; rows: TooltipRow[]; left: number; top: number }) {
  return (
    <div className={`chart-tooltip${left > 74 ? ' chart-tooltip--right' : ''}`} style={{ left: `${left}%`, top: `${top}%` }}>
      <strong>{title}</strong>
      {rows.map((row) => (
        <span key={row.label} className={`chart-tooltip__row chart-tooltip__row--${row.tone}`}>
          <i />
          <b>{row.label}</b>
          <em>{row.value}</em>
        </span>
      ))}
    </div>
  )
}
