import { CircleHelp } from 'lucide-react'

export function PopulationPerformanceTooltip() {
  return (
    <span className="performance-heading">
      <span className="performance-heading__label">{'Desempenho no porte populacional'}</span>
      <span className="performance-tooltip-control">
        <button
          className="performance-tooltip-trigger"
          type="button"
          aria-label="Mostrar legenda do desempenho no porte populacional"
          aria-describedby="performance-population-tooltip"
        >
          <CircleHelp size={13} aria-hidden="true" />
        </button>
        <span id="performance-population-tooltip" className="performance-tooltip" role="tooltip">
          <strong>{'Desempenho no porte populacional'}</strong>
          <span className="performance-tooltip__intro">{'Classifica o munic\u00edpio considerando seu desempenho em rela\u00e7\u00e3o ao seu tamanho populacional.'}</span>
          <span className="performance-tooltip__divider" aria-hidden="true" />
          <TooltipItem tone="above" label="ACIMA" description="Desempenho acima do esperado para o porte populacional." />
          <TooltipItem tone="expected" label="NO INTERVALO" description="Desempenho no intervalo esperado para o porte populacional." />
          <TooltipItem tone="below" label="ABAIXO" description="Desempenho abaixo do esperado para o porte populacional." />
        </span>
      </span>
    </span>
  )
}

function TooltipItem({ tone, label, description }: { tone: 'above' | 'expected' | 'below'; label: string; description: string }) {
  return (
    <span className="performance-tooltip__item">
      <i className={`performance-tooltip__dot performance-tooltip__dot--${tone}`} aria-hidden="true" />
      <span>
        <b>{label}</b>
        <small>{description}</small>
      </span>
    </span>
  )
}
