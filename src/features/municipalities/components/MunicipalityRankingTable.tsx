import { CircleHelp, ListFilter } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { CatalogData, RegionalRankingData } from '../../../types/domain'
import { DIMENSION_IDS, DIMENSION_RANK_KEYS, formatPosition, performanceShortLabel, rankTone } from './municipalityUi'

type Props = { ranking: RegionalRankingData; catalog: CatalogData; coredeId?: string }

export function MunicipalityRankingTable({ ranking, catalog, coredeId }: Props) {
  const navigate = useNavigate()
  const dimensions = DIMENSION_IDS.map((id) => catalog.dimensions.find((item) => item.id === id)).filter(Boolean)
  const rows = coredeId ? ranking.municipalities.filter((item) => item.coredeId === coredeId) : ranking.municipalities

  return (
    <section className="municipality-list-panel">
      <div className="municipality-list-panel__heading">
        <div><h2><ListFilter size={17} /> Ranking dos municípios</h2><p>As posições e as cores consideram sempre os {ranking.municipalityCount} municípios da Região Funcional.</p></div>
        <span>{rows.length} município{rows.length === 1 ? '' : 's'} exibido{rows.length === 1 ? '' : 's'}</span>
      </div>
      <div className="municipality-table-guide">
        <div className="position-legend"><strong>Cores das posições</strong><span><i className="legend-dot legend-dot--good" />Melhores posições</span><span><i className="legend-dot legend-dot--middle" />Intermediárias</span><span><i className="legend-dot legend-dot--low" />Posições mais baixas</span></div>
        <p>O filtro de Corede altera somente os municípios exibidos, não a regra das cores.</p>
      </div>
      <div className="data-table-wrap municipality-ranking-scroll">
        <table className="data-table municipality-ranking-table">
          <thead><tr><th>Geral</th><th>Município</th><th>Corede</th><th><span className="performance-heading" title="Compara a posição observada do município com o desempenho esperado para seu porte populacional.">Desempenho no porte populacional <CircleHelp size={13} aria-hidden="true" /></span></th>{dimensions.map((dimension) => <th key={dimension!.id}>{dimension!.name}</th>)}</tr></thead>
          <tbody>{rows.map((entry) => (
            <tr
              key={entry.municipalityId}
              className="municipality-ranking-row"
              tabIndex={0}
              aria-label={`Abrir análise de ${entry.municipalityName}`}
              onClick={() => navigate(`/municipios?ano=${ranking.year}&regiao=${ranking.regionId}&corede=${entry.coredeId}&municipio=${entry.municipalityId}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/municipios?ano=${ranking.year}&regiao=${ranking.regionId}&corede=${entry.coredeId}&municipio=${entry.municipalityId}`)
                }
              }}
            >
              <td><span className={`position-badge position-badge--${rankTone(entry.overallRank, ranking.municipalityCount)}`}>{formatPosition(entry.overallRank)}</span></td>
              <td><Link onClick={(event) => event.stopPropagation()} to={`/municipios?ano=${ranking.year}&regiao=${ranking.regionId}&corede=${entry.coredeId}&municipio=${entry.municipalityId}`}>{entry.municipalityName}</Link></td>
              <td>{entry.coredeName}</td>
              <td><span className={`performance-badge performance-badge--${entry.populationPerformance.code}`}>{performanceShortLabel(entry.populationPerformance.code)}</span></td>
              {DIMENSION_IDS.map((dimensionId) => {
                const rank = entry.dimensionRanks[DIMENSION_RANK_KEYS[dimensionId]]
                return <td key={dimensionId}><span className={`position-badge position-badge--${rankTone(rank, ranking.municipalityCount)}`}>{formatPosition(rank)}</span></td>
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  )
}
