import { useNavigate } from 'react-router-dom'
import type { CatalogData, RegionalRankingData } from '../../../types/domain'
import { DIMENSION_IDS } from './municipalityUi'
import { MunicipalityRankingContext } from './MunicipalityRankingContext'
import { MunicipalityRankingTableView } from './MunicipalityRankingTableView'

type Props = { ranking: RegionalRankingData; catalog: CatalogData; coredeId?: string }

export function MunicipalityRankingTable({ ranking, catalog, coredeId }: Props) {
  const navigate = useNavigate()
  const dimensions = DIMENSION_IDS
    .map((id) => catalog.dimensions.find((item) => item.id === id))
    .filter((dimension): dimension is CatalogData['dimensions'][number] => Boolean(dimension))
  const rows = coredeId ? ranking.municipalities.filter((item) => item.coredeId === coredeId) : ranking.municipalities
  const coredes = new Map(ranking.municipalities.map((item) => [item.coredeId, item.coredeName]))
  const coredeNames = [...coredes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const coredeList = coredeNames.join(', ')

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
        filterLabel={coredeId ? coredes.get(coredeId) : undefined}
        getMunicipalityUrl={(entry) => municipalityDetailUrl(ranking, entry)}
        ranking={ranking}
        rows={rows}
        onOpenMunicipality={(entry) => navigate(municipalityDetailUrl(ranking, entry))}
      />
    </>
  )
}

function municipalityDetailUrl(ranking: RegionalRankingData, entry: RegionalRankingData['municipalities'][number]) {
  return `/municipios?ano=${ranking.year}&regiao=${ranking.regionId}&corede=${entry.coredeId}&municipio=${entry.municipalityId}`
}
