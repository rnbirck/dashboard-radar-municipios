import { useNavigate } from 'react-router-dom'
import type { CatalogData, RegionalRankingData } from '../../../types/domain'
import { DIMENSION_IDS } from './municipalityUi'
import { MunicipalityRankingContext } from './MunicipalityRankingContext'
import { MunicipalityRankingTableView } from './MunicipalityRankingTableView'
import { matchesPopulationFilter, populationFilterLabel, type PopulationFilterId } from '../populationFilter'

type Props = { ranking: RegionalRankingData; catalog: CatalogData; coredeId?: string; populationFilter?: PopulationFilterId | '' }

export function MunicipalityRankingTable({ ranking, catalog, coredeId, populationFilter = '' }: Props) {
  const navigate = useNavigate()
  const dimensions = DIMENSION_IDS
    .map((id) => catalog.dimensions.find((item) => item.id === id))
    .filter((dimension): dimension is CatalogData['dimensions'][number] => Boolean(dimension))
  const municipalityCatalogById = new Map(catalog.municipalities.map((item) => [item.id, item]))
  const rows = ranking.municipalities.filter((item) => {
    if (coredeId && item.coredeId !== coredeId) return false
    const population = municipalityCatalogById.get(item.municipalityId)?.populationByYear[String(ranking.year)]
    return matchesPopulationFilter(population, populationFilter)
  })
  const coredes = new Map(ranking.municipalities.map((item) => [item.coredeId, item.coredeName]))
  const coredeNames = [...coredes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const coredeList = coredeNames.join(', ')
  const filterLabel = [
    coredeId ? coredes.get(coredeId) : '',
    populationFilter ? populationFilterLabel(populationFilter) : '',
  ].filter(Boolean).join(' · ')

  return (
    <>
      <MunicipalityRankingContext
        ranking={ranking}
        coredeCount={coredes.size}
        coredeList={coredeList}
        coredeNames={coredeNames}
      />
      <MunicipalityRankingTableView
        dimensions={dimensions}
        filterLabel={filterLabel || undefined}
        getMunicipalityUrl={(entry) => municipalityDetailUrl(ranking, entry, populationFilter)}
        ranking={ranking}
        rows={rows}
        onOpenMunicipality={(entry) => navigate(municipalityDetailUrl(ranking, entry, populationFilter))}
      />
    </>
  )
}

function municipalityDetailUrl(ranking: RegionalRankingData, entry: RegionalRankingData['municipalities'][number], populationFilter: PopulationFilterId | '') {
  const params = new URLSearchParams({
    ano: String(ranking.year),
    regiao: ranking.regionId,
    corede: entry.coredeId,
    municipio: entry.municipalityId,
  })
  if (populationFilter) params.set('populacao', populationFilter)
  return `/municipios?${params.toString()}`
}
