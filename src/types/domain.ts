/**
 * Contrato de dados estáticos da Fase 1.
 *
 * Estes tipos espelham os JSONs versionados em /public/data. A apresentação
 * (formatação de moeda, percentual, ordinais etc.) pertence ao frontend, então
 * os tipos de transporte mantêm apenas valores primitivos e ausência como null.
 */

export type DimensionId =
  | 'educacao'
  | 'financas'
  | 'meio_ambiente'
  | 'saude'
  | 'seguranca'
  | 'socioeconomico'

type IndicatorDirection =
  | 'higher_is_better'
  | 'lower_is_better'
  | 'neutral'

type IndicatorFormat = 'number' | 'percent' | 'currency' | 'integer'

export type PopulationPerformanceCode =
  | 'above'
  | 'expected'
  | 'below'
  | 'unknown'


/** Envelope obrigatório em todo JSON versionado (exceto o manifest). */
export type StaticDataEnvelope<T> = {
  schemaVersion: string
  dataVersion: string
  generatedAt: string
  data: T
}

/** Manifesto de entrada, sem envelope adicional. */
export type DashboardManifest = {
  schemaVersion: string
  activeDataVersion: string
  generatedAt: string
  defaultYear: number
  availableYears: number[]
  yearRange: { start: number; end: number }
  totals: {
    municipalities: number
    regions: number
    coredes: number
  }
  files: {
    catalog: string
    regionsPattern: string
    regionalRankingPattern: string
    municipalitySummaryPattern: string
    municipalityDimensionPattern: string
  }
}

type RegionCatalogEntry = {
  id: string
  slug: string
  name: string
  order: number
}

type CoredeCatalogEntry = {
  id: string
  name: string
  regionId: string
}

type MunicipalityCatalogEntry = {
  id: string
  name: string
  searchName: string
  regionId: string
  coredeId: string
  populationByYear: Record<string, number | null>
}

type DimensionCatalogEntry = {
  id: DimensionId
  name: string
  order: number
}

export type IndicatorCatalogEntry = {
  id: string
  dimensionId: DimensionId
  name: string
  shortName: string | null
  description: string | null
  source: string
  unit: string | null
  format: IndicatorFormat
  decimalPlaces: number
  multiplier: number
  direction: IndicatorDirection
  order: number
  /** Ano real do dado quando ele difere do ano de referência usado na nota. */
  dataYearByReferenceYear?: Record<string, number>
  /** Mediana do valor original entre todos os municípios do RS, por ano de referência. */
  stateMedianOriginalValueByReferenceYear?: Record<string, number | null>
  /** Mediana do valor original por Região Funcional e ano de referência. */
  regionalMedianOriginalValueByRegionAndReferenceYear?: Record<string, Record<string, number | null>>
}

export type IndicatorMedianEntry = {
  medianOriginalValue: number | null
  sampleSize: number
  municipalityCount: number
}

export type IndicatorMedianComparison = {
  state: IndicatorMedianEntry
  regions: Record<string, IndicatorMedianEntry>
}

export type CatalogData = {
  regions: RegionCatalogEntry[]
  coredes: CoredeCatalogEntry[]
  municipalities: MunicipalityCatalogEntry[]
  dimensions: DimensionCatalogEntry[]
  indicators: IndicatorCatalogEntry[]
  /** Medianas dos valores observados, sem valores imputados, por ano de referência. */
  indicatorMediansByReferenceYear?: Record<string, Record<string, IndicatorMedianComparison>>
}

type RegionSummary = {
  id: string
  name: string
  order: number
  municipalityCount: number
  coredeCount: number
  coredeIds: string[]
  coredeNames: string[]
  averageFinalScore: number | null
}

export type RegionsData = {
  year: number
  totals: {
    municipalities: number
    regions: number
    coredes: number
  }
  regions: RegionSummary[]
}

type PopulationPerformance = {
  code: PopulationPerformanceCode
  label: string
}

type DimensionRankMap = {
  educacao: number | null
  financas: number | null
  meioAmbiente: number | null
  saude: number | null
  seguranca: number | null
  socioeconomico: number | null
}

type DimensionScoreMap = DimensionRankMap

type RegionalRankingEntry = {
  municipalityId: string
  municipalityName: string
  coredeId: string
  coredeName: string
  overallRank: number | null
  previousOverallRank: number | null
  rankChange: number | null
  populationPerformance: PopulationPerformance
  finalScore: number | null
  dimensionRanks: DimensionRankMap
}

export type RegionalRankingData = {
  year: number
  regionId: string
  regionName: string
  municipalityCount: number
  municipalities: RegionalRankingEntry[]
}

type MunicipalityYearSummary = {
  year: number
  overallRank: number | null
  previousOverallRank: number | null
  rankChange: number | null
  totalMunicipalitiesInRegion: number
  classification: PopulationPerformance
  finalScore: number | null
  dimensionScores: DimensionScoreMap
  dimensionRanks: DimensionRankMap
}

type MunicipalityDimensionHistoryEntry = {
  year: number
  score: number | null
  rank: number | null
  totalMunicipalitiesInRegion: number
}

type MunicipalityDimensionHistory = {
  dimensionId: DimensionId
  values: MunicipalityDimensionHistoryEntry[]
}

type MunicipalityPopulationEstimate = {
  year: number
  value: number | null
}

type MunicipalityGdpValue = {
  year: number
  valueBrl: number | null
}

type MunicipalityProfile = {
  populationEstimates: MunicipalityPopulationEstimate[]
  gdpValues: MunicipalityGdpValue[]
  areaKm2: number | null
}

export type MunicipalitySummaryData = {
  municipality: {
    id: string
    name: string
    regionId: string
    regionName: string
    coredeId: string
    coredeName: string
  }
  availableYears: number[]
  latestYear: number
  municipalProfile?: MunicipalityProfile
  yearlySummaries: MunicipalityYearSummary[]
  dimensionHistory: MunicipalityDimensionHistory[]
}

type DimensionYearValue = {
  year: number
  score: number | null
  rank: number | null
  totalMunicipalitiesInRegion: number
}

type IndicatorYearValue = {
  year: number
  score: number | null
  rank: number | null
  untiedRank: number | null
  originalValue: number | null
  valueUsedForScore: number | null
  isImputed: boolean | null
  regionalMedianScore: number | null
  regionalMedianOriginalValue: number | null
  regionalMedianSampleSize: number | null
}

type MunicipalityIndicatorSeries = {
  indicatorId: string
  values: IndicatorYearValue[]
}

export type MunicipalityDimensionData = {
  municipalityId: string
  municipalityName: string
  regionId: string
  regionName: string
  corede: string
  dimensionId: DimensionId
  dimensionName: string
  availableYears: number[]
  dimensionHistory: DimensionYearValue[]
  indicators: MunicipalityIndicatorSeries[]
}

/**
 * Tipos legados mantidos para compatibilidade com os filtros. O ID municipal
 * continua string (código IBGE estável) e Region/Corede usam apenas os campos
 * realmente consumidos pela seleção.
 */
export type Region = {
  id: string
  name: string
  slug: string
  order: number
}

export type Municipality = {
  id: string
  name: string
  regionId: string
  coredeId: string
  coredeName: string
  populationByYear: Record<string, number | null>
}
