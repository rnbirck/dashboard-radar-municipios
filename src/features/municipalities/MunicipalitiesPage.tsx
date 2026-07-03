import { Building2, CalendarDays, MousePointerClick, Network, Trophy, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import {
  DataNotFoundError,
  loadCatalog,
  loadManifest,
  loadMunicipalityDimension,
  loadMunicipalitySummary,
  loadRankingByRegion,
  loadRegions,
} from '../../data/repository'
import type { CatalogData, MunicipalityDimensionData, MunicipalitySummaryData, RegionalRankingData, RegionsData } from '../../types/domain'
import { RegionsExplorer } from '../regions/components/RegionsExplorer'
import { MunicipalityDetail } from './components/MunicipalityDetail'
import { MunicipalityRankingTable } from './components/MunicipalityRankingTable'
import { DIMENSION_IDS } from './components/municipalityUi'

type Status = 'idle' | 'loading' | 'ready' | 'partial' | 'error'

export function MunicipalitiesPage() {
  const [params] = useSearchParams()
  const regionId = params.get('regiao') ?? ''
  const coredeId = params.get('corede') ?? ''
  const municipalityId = params.get('municipio') ?? ''
  const requestedYear = Number(params.get('ano'))
  const [catalog, setCatalog] = useState<CatalogData | null>(null)
  const [ranking, setRanking] = useState<RegionalRankingData | null>(null)
  const [regionsData, setRegionsData] = useState<RegionsData | null>(null)
  const [summary, setSummary] = useState<MunicipalitySummaryData | null>(null)
  const [dimensions, setDimensions] = useState<MunicipalityDimensionData[]>([])
  const [displayYear, setDisplayYear] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const requestId = useRef(0)

  useEffect(() => {
    const currentId = ++requestId.current
    setRanking(null)
    setRegionsData(null)
    setSummary(null)
    setDimensions([])
    setStatus(regionId || municipalityId ? 'loading' : 'idle')

    void (async () => {
      try {
        const [manifest, nextCatalog] = await Promise.all([loadManifest(), loadCatalog()])
        const year = manifest.availableYears.includes(requestedYear) ? requestedYear : manifest.defaultYear
        setDisplayYear(year)
        const [nextRanking, nextSummary, nextRegions] = await Promise.all([
          regionId ? loadRankingByRegion(year, regionId) : Promise.resolve(null),
          municipalityId ? loadMunicipalitySummary(municipalityId) : Promise.resolve(null),
          !regionId && !municipalityId ? loadRegions(year) : Promise.resolve(null),
        ])
        if (currentId !== requestId.current) return
        setCatalog(nextCatalog)
        setRanking(nextRanking)
        setSummary(nextSummary)
        setRegionsData(nextRegions)

        if (!municipalityId) {
          setStatus(regionId ? 'ready' : 'idle')
          return
        }

        const nextDimensions = await Promise.all(DIMENSION_IDS.map((dimension) => loadMunicipalityDimension(municipalityId, dimension)))
        if (currentId !== requestId.current) return
        setDimensions(nextDimensions)
        setStatus('ready')
      } catch (error) {
        if (currentId !== requestId.current) return
        if (error instanceof DataNotFoundError && municipalityId) {
          setStatus('partial')
          return
        }
        setStatus('error')
      }
    })()
  }, [municipalityId, regionId, requestedYear])

  return (
    <div className="page-stack municipalities-page">
      {status === 'loading' ? <LoadingState /> : null}
      {status === 'error' ? <ErrorState title="Não foi possível carregar os dados" description="Confira os filtros e tente novamente." /> : null}
      {status === 'partial' ? <EmptyState icon={Building2} title="Município não encontrado" description="Não encontramos o detalhamento deste município para a seleção atual. Confira os filtros e tente novamente." /> : null}

      {!municipalityId && !regionId ? (
        <RegionsExplorer
          data={regionsData}
          status={status === 'error' ? 'error' : regionsData ? 'ready' : 'loading'}
          year={displayYear}
          title="Selecione uma região funcional ou um município"
          description="Escolha uma região funcional para explorar o ranking regional ou selecione diretamente um município no filtro acima para abrir seus detalhes."
          showHint
        />
      ) : null}
      {!municipalityId && ranking ? <RegionalMunicipalitiesOverview ranking={ranking} /> : null}
      {!municipalityId && ranking && catalog ? <MunicipalityRankingTable ranking={ranking} catalog={catalog} coredeId={coredeId} /> : null}
      {municipalityId && summary && catalog && dimensions.length === DIMENSION_IDS.length ? <MunicipalityDetail summary={summary} dimensions={dimensions} catalog={catalog} selectedYear={displayYear ?? undefined} /> : null}
    </div>
  )
}

function RegionalMunicipalitiesOverview({ ranking }: { ranking: RegionalRankingData }) {
  const coredes = new Set(ranking.municipalities.map((item) => item.coredeId))
  const best = ranking.municipalities.find((item) => item.overallRank === 1) ?? ranking.municipalities[0]
  return <section className="regional-municipalities-overview">
    <div className="regional-municipalities-overview__heading">
      <div><h1>Municípios da {ranking.regionName}</h1><p>{ranking.municipalityCount} municípios avaliados no ranking de {ranking.year}.</p></div>
      <span><MousePointerClick size={16} /> Clique em uma linha da tabela para abrir a análise completa do município.</span>
    </div>
    <div className="regional-overview-metrics">
      <article><Users size={18} /><div><strong>{ranking.municipalityCount}</strong><span>municípios da RF</span></div></article>
      <article><Network size={18} /><div><strong>{coredes.size}</strong><span>Coredes</span></div></article>
      <article><Trophy size={18} /><div><strong>{best?.municipalityName ?? '—'}</strong><span>1º colocado</span></div></article>
      <article><CalendarDays size={18} /><div><strong>{ranking.year}</strong><span>ano de referência</span></div></article>
    </div>
  </section>
}
