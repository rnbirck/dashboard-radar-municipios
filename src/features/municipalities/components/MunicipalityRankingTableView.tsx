import { TableProperties } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CatalogData, RegionalRankingData } from '../../../types/domain'
import { DIMENSION_IDS, DIMENSION_RANK_KEYS, formatPosition, performanceShortLabel, rankTone } from './municipalityUi'
import { PopulationPerformanceTooltip } from './PopulationPerformanceTooltip'

type RankingEntry = RegionalRankingData['municipalities'][number]

type MunicipalityRankingTableViewProps = {
  dimensions: CatalogData['dimensions']
  filterLabel?: string
  getMunicipalityUrl: (entry: RankingEntry) => string
  ranking: RegionalRankingData
  rows: RankingEntry[]
  onOpenMunicipality: (entry: RankingEntry) => void
}

export function MunicipalityRankingTableView({ dimensions, filterLabel, getMunicipalityUrl, ranking, rows, onOpenMunicipality }: MunicipalityRankingTableViewProps) {
  return (
    <section className="municipality-list-panel placeholder-panel" aria-labelledby="municipality-ranking-table-title">
      <div className="placeholder-panel__heading">
        <TableProperties size={19} aria-hidden="true" />
        <h2 id="municipality-ranking-table-title">Tabela de ranking</h2>
        <span className="municipality-table-count">
          {filterLabel ? `${rows.length} de ${ranking.municipalityCount} municípios · ${filterLabel}` : `${rows.length} municípios`}
        </span>
      </div>
      <p className="section-description">{'Munic\u00edpios classificados na Regi\u00e3o Funcional, com Corede e posi\u00e7\u00f5es por dimens\u00e3o.'}</p>
      <div className="data-table-wrap municipality-ranking-scroll">
        <table className="data-table municipality-ranking-table">
          <caption className="sr-only">Ranking dos municípios da {ranking.regionName}</caption>
          <thead>
            <tr>
              <th>Geral</th>
              <th>{'Munic\u00edpio'}</th>
              <th>Corede</th>
              <th><PopulationPerformanceTooltip /></th>
              {dimensions.map((dimension) => <th key={dimension.id}>{dimension.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <MunicipalityRankingRow key={entry.municipalityId} entry={entry} ranking={ranking} getMunicipalityUrl={getMunicipalityUrl} onOpenMunicipality={onOpenMunicipality} />
            ))}
          </tbody>
        </table>
      </div>
      <RankingReadingGuide />
    </section>
  )
}

function MunicipalityRankingRow({ entry, getMunicipalityUrl, ranking, onOpenMunicipality }: { entry: RankingEntry; getMunicipalityUrl: (entry: RankingEntry) => string; ranking: RegionalRankingData; onOpenMunicipality: (entry: RankingEntry) => void }) {
  const url = getMunicipalityUrl(entry)

  return (
    <tr
      className="municipality-ranking-row"
      tabIndex={0}
      aria-label={`Abrir an\u00e1lise de ${entry.municipalityName}`}
      onClick={() => onOpenMunicipality(entry)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenMunicipality(entry)
        }
      }}
    >
      <td><span className={`position-badge position-badge--ranking position-badge--${rankTone(entry.overallRank, ranking.municipalityCount)}`}>{formatPosition(entry.overallRank)}</span></td>
      <td><Link className="municipality-ranking-name" onClick={(event) => event.stopPropagation()} to={url}>{entry.municipalityName}</Link></td>
      <td>{entry.coredeName}</td>
      <td><span className={`performance-badge performance-badge--${entry.populationPerformance.code}`}>{performanceShortLabel(entry.populationPerformance.code)}</span></td>
      {DIMENSION_IDS.map((dimensionId) => {
        const rank = entry.dimensionRanks[DIMENSION_RANK_KEYS[dimensionId]]
        return <td key={dimensionId}><span className={`position-badge position-badge--${rankTone(rank, ranking.municipalityCount)}`}>{formatPosition(rank)}</span></td>
      })}
    </tr>
  )
}

function RankingReadingGuide() {
  return (
    <aside className="regional-ranking-reading municipality-ranking-reading" aria-label="Como ler o ranking">
      <strong>{'Leitura do ranking'}</strong>
      <ul>
        <li>{'As posi\u00e7\u00f5es s\u00e3o calculadas dentro da Regi\u00e3o Funcional.'}</li>
        <li>{'Os filtros de Corede e porte populacional alteram apenas os munic\u00edpios exibidos, n\u00e3o a regra do ranking.'}</li>
      </ul>
      <div className="regional-ranking-color-key" aria-label="Legenda das cores">
        <span><i className="legend-dot legend-dot--good" />{'1\u00aa metade do ranking'}</span>
        <span><i className="legend-dot legend-dot--middle" />{'Entre 50% e 75%'}</span>
        <span><i className="legend-dot legend-dot--low" />{'25% finais'}</span>
      </div>
    </aside>
  )
}
