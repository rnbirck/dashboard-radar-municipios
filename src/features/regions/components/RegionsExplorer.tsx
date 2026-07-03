import { ArrowRight, CalendarDays, Map, Network, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { LoadingState } from '../../../components/ui/LoadingState'
import { MetricCard } from '../../../components/ui/MetricCard'
import { formatInteger, missingValue } from '../../../data/formatters'
import type { RegionsData } from '../../../types/domain'

type RegionsExplorerProps = {
  data: RegionsData | null
  status: 'loading' | 'ready' | 'empty' | 'error'
  year: number | null
  title: string
  description: string
  showHint?: boolean
}

export function RegionsExplorer({ data, status, year, title, description, showHint = false }: RegionsExplorerProps) {
  const totalMunicipalities = data?.totals.municipalities ?? null
  const totalCoredes = data?.totals.coredes ?? null
  const totalRegions = data?.totals.regions ?? null

  return (
    <>
      <section className="region-hero">
        <div className="region-hero__copy">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className="region-hero__icon" aria-hidden="true"><Map size={36} strokeWidth={1.6} /></span>
      </section>

      <section className="metric-grid metric-grid--compact" aria-label="Resumo das regiões">
        <MetricCard icon={Map} value={totalRegions === null ? missingValue() : formatInteger(totalRegions)} label="regiões funcionais" note="recortes de planejamento" />
        <MetricCard icon={Users} value={totalMunicipalities === null ? missingValue() : formatInteger(totalMunicipalities)} label="municípios" note="em todo o estado" />
        <MetricCard icon={Network} value={totalCoredes === null ? missingValue() : formatInteger(totalCoredes)} label="Coredes" note="conselhos regionais" />
        <MetricCard icon={CalendarDays} value={year === null ? missingValue() : String(year)} label="ano mais recente" note="dados estáticos reais" />
      </section>

      <section className="placeholder-panel">
        <div className="placeholder-panel__heading"><Map size={19} aria-hidden="true" /><h2>Explore as regiões funcionais</h2></div>
        {status === 'loading' ? (
          <div className="panel-body"><LoadingState /></div>
        ) : status === 'error' ? (
          <div className="panel-body">
            <ErrorState title="Não foi possível carregar os dados" description="Não foi possível carregar os dados. Tente novamente." />
          </div>
        ) : status === 'empty' || !data ? (
          <div className="panel-body">
            <EmptyState title="Sem dados regionais" description="Não há dados regionais para o ano selecionado." />
          </div>
        ) : (
          <div className="region-explore-list">
            {data.regions.map((region) => (
              <Link
                key={region.id}
                className="region-explore-card"
                to={`/municipios?ano=${year ?? ''}&regiao=${encodeURIComponent(region.id)}`}
                title={`Explorar ${region.name}`}
              >
                <span className="region-explore-col region-explore-col--badge"><span className="region-explore-badge">{region.id}</span></span>
                <span className="region-explore-col region-explore-col--metric"><span className="region-explore-metric-value">{region.municipalityCount}</span><span className="region-explore-metric-label">municípios</span></span>
                <span className="region-explore-col region-explore-col--metric"><span className="region-explore-metric-value">{region.coredeCount}</span><span className="region-explore-metric-label">Coredes</span></span>
                <span className="region-explore-col region-explore-col--coredes"><span className="region-explore-coredes-label">Coredes</span><span className="region-explore-coredes-text">{region.coredeNames.join(', ')}</span></span>
                <span className="region-explore-col region-explore-col--cta"><span className="region-explore-cta">Explorar região<ArrowRight size={14} aria-hidden="true" /></span></span>
              </Link>
            ))}
          </div>
        )}
        {showHint ? <p className="region-explore-hint"><Map size={15} aria-hidden="true" /> Selecione uma região funcional ou um município para explorar rankings, indicadores e detalhes.</p> : null}
      </section>
    </>
  )
}
