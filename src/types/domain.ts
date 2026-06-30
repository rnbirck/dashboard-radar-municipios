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

export type IndicatorDirection =
  | 'higher_is_better'
  | 'lower_is_better'
  | 'neutral'

export type IndicatorFormat = 'number' | 'percent' | 'currency' | 'integer'

export type PopulationPerformanceCode =
  | 'above'
  | 'expected'
  | 'below'
  | 'unknown'

export type ClassificationCode = PopulationPerformanceCode

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
  sample?: DataSampleMetadata
}

/** Metadados de amostra parcial. */
export type DataSampleMetadata = {
  isSample: boolean
  coveredRegionIds: string[]
  detailedMunicipalityIds: string[]
}

export type RegionCatalogEntry = {
  id: string
  slug: string
  name: string
  order: number
}

export type CoredeCatalogEntry = {
  id: string
  name: string
  regionId: string
}

export type MunicipalityCatalogEntry = {
  id: string
  name: string
  searchName: string
  regionId: string
  coredeId: string
}

export type DimensionCatalogEntry = {
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
  unit: string | null
  format: IndicatorFormat
  decimalPlaces: number
  multiplier: number
  direction: IndicatorDirection
  order: number
}

export type CatalogData = {
  regions: RegionCatalogEntry[]
  coredes: CoredeCatalogEntry[]
  municipalities: MunicipalityCatalogEntry[]
  dimensions: DimensionCatalogEntry[]
  indicators: IndicatorCatalogEntry[]
}

export type RegionSummary = {
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

export type PopulationPerformance = {
  code: PopulationPerformanceCode
  label: string
}

export type DimensionRankMap = {
  educacao: number | null
  financas: number | null
  meioAmbiente: number | null
  saude: number | null
  seguranca: number | null
  socioeconomico: number | null
}

export type DimensionScoreMap = DimensionRankMap

export type RegionalRankingEntry = {
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

export type MunicipalityYearSummary = {
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

export type MunicipalityDimensionHistoryEntry = {
  year: number
  score: number | null
  rank: number | null
  totalMunicipalitiesInRegion: number
}

export type MunicipalityDimensionHistory = {
  dimensionId: DimensionId
  values: MunicipalityDimensionHistoryEntry[]
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
  yearlySummaries: MunicipalityYearSummary[]
  dimensionHistory: MunicipalityDimensionHistory[]
}

export type DimensionYearValue = {
  year: number
  score: number | null
  rank: number | null
  totalMunicipalitiesInRegion: number
}

export type IndicatorYearValue = {
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

export type MunicipalityIndicatorSeries = {
  indicatorId: string
  values: IndicatorYearValue[]
}

export type MunicipalityDimensionData = {
  municipalityId: string
  regionId: string
  dimensionId: DimensionId
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
}