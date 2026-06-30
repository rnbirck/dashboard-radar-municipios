import { Building2, ListFilter } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export function MunicipalitiesPage() {
  return (
    <div className="page-stack">
      <EmptyState
        icon={Building2}
        title="Encontre um município"
        description="Selecione primeiro a região funcional e, se desejar, refine por Corede antes de escolher um município."
      />
      <section className="placeholder-panel placeholder-panel--large">
        <div className="placeholder-panel__heading"><ListFilter size={19} aria-hidden="true" /><h2>Municípios da região</h2></div>
        <div className="table-placeholder" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
        <p className="sr-only">A tabela de municípios será exibida quando os dados estáticos estiverem disponíveis.</p>
      </section>
    </div>
  )
}
