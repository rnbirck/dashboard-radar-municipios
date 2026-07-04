import { CircleHelp, ListFilter } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { CatalogData, RegionalRankingData } from '../../../types/domain'
import { DIMENSION_IDS, DIMENSION_RANK_KEYS, formatPosition, performanceShortLabel, rankTone } from './municipalityUi'

type Props = { ranking: RegionalRankingData; catalog: CatalogData; coredeId?: string }

export function MunicipalityRankingTable({ ranking, catalog, coredeId }: Props) {
  const navigate = useNavigate()
  const dimensions = DIMENSION_IDS.map((id) => catalog.dimensions.find((item) => item.id === id)).filter(Boolean)
  const rows = coredeId ? ranking.municipalities.filter((item) => item.coredeId === coredeId) : ranking.municipalities
  const coredes = new Map(ranking.municipalities.map((item) => [item.coredeId, item.coredeName]))
  const coredeNames = [...coredes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const coredeList = coredeNames.join(', ')

  return (
    <section className="municipality-list-panel content-panel regional-ranking-panel" aria-labelledby="regional-ranking-title">
      <header className="content-panel__header regional-ranking-header">
        <div className="regional-ranking-header__main">
          <span className="context-panel__eyebrow">Região Funcional selecionada</span>
          <h2 id="regional-ranking-title" className="content-panel__title regional-ranking-title"><ListFilter size={18} /> Ranking dos municípios — {ranking.regionName}</h2>
          <div className="context-panel__meta regional-ranking-meta" aria-label="Contexto regional">
            <span className="context-chip context-chip--strong">{ranking.municipalityCount} municípios ranqueados</span>
            <span className="context-chip">{coredes.size} Corede{coredes.size === 1 ? '' : 's'}</span>
            <span className="context-chip context-chip--muted">Ano de referência {ranking.year}</span>
          </div>
          <div className="content-panel__subtitle regional-ranking-copy">
            <span>Ranking calculado no universo da Região Funcional.</span>
            {coredeList ? (
              <span className="regional-ranking-coredes" title={coredeList} aria-label={`Coredes: ${coredeList}`}>
                <span className="regional-ranking-coredes__label">Coredes incluídos:</span>
                <span className="regional-ranking-coredes__list">
                  {coredeNames.map((name) => <span className="regional-ranking-corede-pill" key={name}>{name}</span>)}
                </span>
              </span>
            ) : null}
          </div>
        </div>
        <aside className="regional-ranking-reading" aria-label="Como ler o ranking">
          <strong>Leitura do ranking</strong>
          <ul>
            <li>As posições são calculadas dentro da Região Funcional.</li>
            <li>O filtro de Corede altera apenas os municípios exibidos, não a regra do ranking.</li>
          </ul>
          <div className="regional-ranking-color-key" aria-label="Legenda das cores">
            <span><i className="legend-dot legend-dot--good" />Colocações mais altas</span>
            <span><i className="legend-dot legend-dot--middle" />Faixa intermediária</span>
            <span><i className="legend-dot legend-dot--low" />Colocações mais baixas</span>
          </div>
        </aside>
      </header>
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
              <td><span className={`position-badge position-badge--ranking position-badge--${rankTone(entry.overallRank, ranking.municipalityCount)}`}>{formatPosition(entry.overallRank)}</span></td>
              <td><Link className="municipality-ranking-name" onClick={(event) => event.stopPropagation()} to={`/municipios?ano=${ranking.year}&regiao=${ranking.regionId}&corede=${entry.coredeId}&municipio=${entry.municipalityId}`}>{entry.municipalityName}</Link></td>
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
