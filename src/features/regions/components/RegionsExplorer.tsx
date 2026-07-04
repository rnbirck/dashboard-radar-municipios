import { ArrowRight, Map } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { LoadingState } from '../../../components/ui/LoadingState'
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
      <section className="context-panel regions-context-panel" aria-labelledby="regions-context-title">
        <div className="context-panel__identity">
          <span className="context-badge"><Map size={13} aria-hidden="true" /> Contexto regional</span>
          <h1 id="regions-context-title" className="context-panel__title">{title}</h1>
          {showHint ? (
            <div className="context-panel__meta" aria-label="Metadados do recorte estadual">
              <span className="context-chip">Entrada por Região Funcional ou município</span>
            </div>
          ) : null}
          <p className="context-panel__copy">{description}</p>
        </div>
        <div className="context-panel__summary" aria-label="Resumo das regiões">
          <span className="context-panel__metric context-panel__secondary-metric"><span>Ano de referência</span><strong>{year === null ? missingValue() : String(year)}</strong></span>
          <span className="context-panel__metric context-panel__primary-metric"><span>Regiões Funcionais</span><strong>{totalRegions === null ? missingValue() : formatInteger(totalRegions)}</strong></span>
          <span className="context-panel__metric"><span>Municípios</span><strong>{totalMunicipalities === null ? missingValue() : formatInteger(totalMunicipalities)}</strong></span>
          <span className="context-panel__metric"><span>Coredes</span><strong>{totalCoredes === null ? missingValue() : formatInteger(totalCoredes)}</strong></span>
        </div>
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
                <span className="region-explore-col region-explore-col--identity">
                  <span className="region-explore-badge">{region.id}</span>
                  <span className="region-explore-summary">
                    <strong>{region.municipalityCount} municípios</strong>
                    <span aria-hidden="true">·</span>
                    <strong>{region.coredeCount} Corede{region.coredeCount === 1 ? '' : 's'}</strong>
                  </span>
                </span>
                <span className="region-explore-col region-explore-col--coredes" aria-label={`Coredes: ${region.coredeNames.join(', ')}`}><span className="region-explore-coredes-text">{region.coredeNames.join(', ')}</span></span>
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
