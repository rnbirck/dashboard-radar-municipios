import { CalendarDays, Map, Network, Users } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { MetricCard } from '../../components/ui/MetricCard'

export function RegionsPage() {
  return (
    <div className="page-stack">
      <EmptyState
        icon={Map}
        title="Selecione uma região funcional"
        description="Escolha uma região funcional no filtro acima para abrir o ranking dos municípios, os indicadores regionais e os detalhes por município."
      />
      <section className="metric-grid metric-grid--compact" aria-label="Resumo das regiões">
        <MetricCard icon={Map} value="9" label="regiões funcionais" note="recortes de planejamento" />
        <MetricCard icon={Users} value="497" label="municípios" note="em todo o estado" />
        <MetricCard icon={Network} value="28" label="Coredes" note="conselhos regionais" />
        <MetricCard icon={CalendarDays} value="2025" label="ano mais recente" note="dados mockados" accent />
      </section>
      <section className="placeholder-panel">
        <div className="placeholder-panel__heading"><Map size={19} aria-hidden="true" /><h2>Explore as regiões funcionais</h2></div>
        <p>A lista de regiões será preenchida pelos JSONs estáticos na próxima fase.</p>
      </section>
    </div>
  )
}
