import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'

type ErrorStateProps = {
  title: string
  description: string
  icon?: LucideIcon
  onRetry?: () => void
}

/**
 * Estado de erro de carregamento de dados. Diferencia-se do EmptyState por
 * indicar falha de leitura (HTTP/contrato/versão) e, opcionalmente, oferecer
 * nova tentativa. Detalhes técnicos só aparecem em desenvolvimento.
 */
export function ErrorState({ title, description, icon: Icon = AlertTriangle, onRetry }: ErrorStateProps) {
  return (
    <section className="error-state" role="alert" aria-live="assertive">
      <span className="error-state__icon"><Icon size={36} strokeWidth={1.6} aria-hidden="true" /></span>
      <div className="error-state__copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {onRetry ? (
        <button type="button" className="error-state__retry" onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
    </section>
  )
}