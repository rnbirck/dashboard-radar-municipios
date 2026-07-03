import { Activity, BarChart3, Building2, ChartNoAxesColumnIncreasing, CircleGauge, CircleDollarSign, GraduationCap, HeartPulse, Landmark, Leaf, Map as MapIcon, ShieldCheck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CatalogData, DimensionId, MunicipalityDimensionData, MunicipalitySummaryData } from '../../../types/domain'
import { LineChartSimple, RadarChartSimple } from './MunicipalityCharts'
import { formatIndicatorPointLabel, formatIndicatorValue, formatPosition, indicatorAxisLabel, rankTone, variationLabel, variationTone } from './municipalityUi'

const DIMENSION_ICONS = { educacao: GraduationCap, financas: Landmark, meio_ambiente: Leaf, saude: HeartPulse, seguranca: ShieldCheck, socioeconomico: ChartNoAxesColumnIncreasing }
const INDICATOR_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base' })
const INTEGER_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const DECIMAL_FORMAT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const MISSING_VALUE = '\u2014'

type Props = { summary: MunicipalitySummaryData; dimensions: MunicipalityDimensionData[]; catalog: CatalogData; selectedYear?: number }

export function MunicipalityDetail({ summary, dimensions, catalog, selectedYear }: Props) {
  const [selectedDimension, setSelectedDimension] = useState<'geral' | DimensionId>('geral')
  const selectedData = dimensions.find((item) => item.dimensionId === selectedDimension)
  const indicatorMetadata = useMemo(() => new Map(catalog.indicators.map((item) => [item.id, item])), [catalog])
  const sortedSelectedIndicators = useMemo(() => {
    return [...(selectedData?.indicators ?? [])].sort((a, b) => {
      const labelA = indicatorMetadata.get(a.indicatorId)?.name ?? indicatorMetadata.get(a.indicatorId)?.shortName ?? a.indicatorId
      const labelB = indicatorMetadata.get(b.indicatorId)?.name ?? indicatorMetadata.get(b.indicatorId)?.shortName ?? b.indicatorId
      return INDICATOR_COLLATOR.compare(labelA, labelB)
    })
  }, [indicatorMetadata, selectedData])
  const firstIndicatorId = sortedSelectedIndicators[0]?.indicatorId ?? ''
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(firstIndicatorId)

  useEffect(() => { setSelectedIndicatorId(firstIndicatorId) }, [firstIndicatorId])

  const referenceYear = selectedYear && summary.availableYears.includes(selectedYear) ? selectedYear : summary.latestYear
  const latest = summary.yearlySummaries.find((item) => item.year === referenceYear) ?? summary.yearlySummaries.find((item) => item.year === summary.latestYear)
  const previous = latest ? summary.yearlySummaries.find((item) => item.year === latest.year - 1) : undefined
  if (!latest) return null

  const selectedIndicator = selectedData?.indicators.find((item) => item.indicatorId === selectedIndicatorId)
  const selectedMetadata = selectedIndicator ? indicatorMetadata.get(selectedIndicator.indicatorId) : undefined
  const profileMetrics = resolveMunicipalProfile(summary, latest.year)
  return (
    <div className="municipality-detail">
      <section className="municipality-detail-header">
        <div className="municipality-detail-header__identity">
          <span className="entity-badge"><Building2 size={13} /> Município</span>
          <h1>{summary.municipality.name}</h1>
          <p>{summary.municipality.regionName} · Corede {summary.municipality.coredeName}</p>
          <small>Posições calculadas entre os {latest.totalMunicipalitiesInRegion} municípios da RF.</small>
        </div>
        <article className="municipality-profile-panel">
          <span>Contexto municipal</span>
          <div className="municipality-profile-metrics" aria-label="Contexto municipal">
            <MunicipalityProfileMetric icon={Users} label={`Popula\u00e7\u00e3o estimada (${profileMetrics.population?.year ?? latest.year})`} value={formatIntegerMetric(profileMetrics.population?.value)} />
            <MunicipalityProfileMetric icon={CircleDollarSign} label={`PIB (${profileMetrics.gdp?.year ?? latest.year})`} value={formatGdpMetric(profileMetrics.gdp?.valueBrl)} />
            <MunicipalityProfileMetric icon={MapIcon} label={'\u00c1rea'} value={formatAreaMetric(profileMetrics.areaKm2)} />
          </div>
        </article>
        <article className="summary-rank-card summary-rank-card--performance"><span>Desempenho no porte populacional</span><strong>{latest.classification.label}</strong></article>
        <article className="summary-rank-card"><span>Posição geral na RF em {latest.year}</span><strong>{formatPosition(latest.overallRank)}</strong><small>{previous?.year ?? 'Ano anterior'}: {formatPosition(previous?.overallRank)}</small><em className={`variation-chip variation-chip--${variationTone(latest.overallRank, previous?.overallRank)}`}>{variationLabel(latest.overallRank, previous?.overallRank)}</em></article>
      </section>

      <section className="dimension-selector-panel">
        <div className="dimension-selector-panel__header"><span>Selecione a dimensão</span><small>Clique em uma opção para atualizar gráficos e tabela.</small></div>
      <nav className="dimension-selector" aria-label="Selecionar visão ou dimensão">
        <button type="button" aria-pressed={selectedDimension === 'geral'} className={`dimension-selector-card dimension-selector-card--general${selectedDimension === 'geral' ? ' is-selected' : ''}`} onClick={() => setSelectedDimension('geral')}>
          <span className="dimension-selector-card__icon"><CircleGauge size={17} /></span>
          <span className="dimension-selector-card__body"><b>Geral</b><strong className={`position-text position-text--${rankTone(latest.overallRank, latest.totalMunicipalitiesInRegion)}`}>{formatPosition(latest.overallRank)}</strong><span className="dimension-selector-card__meta"><small>{previous?.year ?? 'Ano anterior'}: {formatPosition(previous?.overallRank)}</small><em className={`variation-chip variation-chip--${variationTone(latest.overallRank, previous?.overallRank)}`}>{variationLabel(latest.overallRank, previous?.overallRank)}</em></span></span>
        </button>
        {dimensions.map((dimension) => {
          const current = dimension.dimensionHistory.find((item) => item.year === latest.year)
          const prior = dimension.dimensionHistory.find((item) => item.year === latest.year - 1)
          const Icon = DIMENSION_ICONS[dimension.dimensionId]
          return <button type="button" key={dimension.dimensionId} aria-pressed={selectedDimension === dimension.dimensionId} className={`dimension-selector-card${selectedDimension === dimension.dimensionId ? ' is-selected' : ''}`} onClick={() => setSelectedDimension(dimension.dimensionId)}>
            <span className="dimension-selector-card__icon"><Icon size={17} /></span><span className="dimension-selector-card__body"><b>{dimension.dimensionName}</b><strong className={`position-text position-text--${rankTone(current?.rank, current?.totalMunicipalitiesInRegion ?? 0)}`}>{formatPosition(current?.rank)}</strong><span className="dimension-selector-card__meta"><small>{prior?.year ?? 'Ano anterior'}: {formatPosition(prior?.rank)}</small><em className={`variation-chip variation-chip--${variationTone(current?.rank, prior?.rank)}`}>{variationLabel(current?.rank, prior?.rank)}</em></span></span>
          </button>
        })}
      </nav>
      </section>

      {selectedDimension === 'geral' ? (
        <GeneralView summary={summary} dimensions={dimensions} referenceYear={latest.year} />
      ) : selectedData ? (
        <DimensionView data={selectedData} summary={summary} catalog={catalog} referenceYear={latest.year} selectedIndicatorId={selectedIndicatorId} setSelectedIndicatorId={setSelectedIndicatorId} selectedIndicator={selectedIndicator} selectedMetadata={selectedMetadata} />
      ) : null}
    </div>
  )
}

function resolveMunicipalProfile(summary: MunicipalitySummaryData, year: number) {
  const profile = summary.municipalProfile
  const population = pickYearMetric(profile?.populationEstimates, year)
  const gdp = pickYearMetric(profile?.gdpValues, year)
  return { population, gdp, areaKm2: profile?.areaKm2 ?? null }
}

function pickYearMetric<T extends { year: number }>(items: T[] | undefined, year: number): T | undefined {
  if (!items?.length) return undefined
  return items.find((item) => item.year === year) ?? [...items].sort((a, b) => b.year - a.year)[0]
}

function formatIntegerMetric(value: number | null | undefined): string {
  return value === null || value === undefined ? MISSING_VALUE : INTEGER_FORMAT.format(value)
}

function formatGdpMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING_VALUE
  if (Math.abs(value) >= 1_000_000_000) return `R$ ${DECIMAL_FORMAT.format(value / 1_000_000_000)} bi`
  if (Math.abs(value) >= 1_000_000) return `R$ ${DECIMAL_FORMAT.format(value / 1_000_000)} mi`
  return `R$ ${INTEGER_FORMAT.format(value)}`
}

function formatAreaMetric(value: number | null | undefined): string {
  return value === null || value === undefined ? MISSING_VALUE : `${DECIMAL_FORMAT.format(value)} km\u00b2`
}

function MunicipalityProfileMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <span className="municipality-profile-metric"><Icon size={15} aria-hidden={true} /><span><small>{label}</small><strong>{value}</strong></span></span>
}

function Panel({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return <section className="analysis-panel"><div className="analysis-panel__title"><BarChart3 size={18} /><h2>{title}</h2></div>{description ? <div className="analysis-panel__description">{description}</div> : null}{children}</section>
}

function GeneralView({ summary, dimensions, referenceYear }: { summary: MunicipalitySummaryData; dimensions: MunicipalityDimensionData[]; referenceYear: number }) {
  const years = [...summary.availableYears].sort((a, b) => a - b)
  const labels = dimensions.map((item) => item.dimensionName)
  const values = dimensions.map((item) => item.dimensionHistory.find((row) => row.year === referenceYear)?.score ?? null)
  const medians = dimensions.map((item) => {
    const values = item.indicators.map((indicator) => indicator.values.find((row) => row.year === referenceYear)?.regionalMedianScore).filter((value): value is number => value !== null && value !== undefined)
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null
  })
  return <div className="analysis-layout">
    <Panel title={`Histórico de posição geral - ${summary.municipality.name}`}><LineChartSimple invert primaryLabel={summary.municipality.name} points={years.map((year) => ({ label: String(year), value: summary.yearlySummaries.find((item) => item.year === year)?.overallRank ?? null }))} valueFormatter={(value) => `${value}º`} /></Panel>
    <Panel title="Radar das dimensões - visão geral"><RadarChartSimple primaryLabel={summary.municipality.name} labels={labels} values={values} comparison={medians} comparisonLabel="Mediana dos indicadores da RF" /></Panel>
    <section className="analysis-panel analysis-panel--wide"><div className="analysis-panel__title"><Activity size={18} /><h2>Posições por dimensão ao longo do tempo</h2></div><PositionHistoryTable summary={summary} dimensions={dimensions} /></section>
  </div>
}

function PositionHistoryTable({ summary, dimensions }: { summary: MunicipalitySummaryData; dimensions: MunicipalityDimensionData[] }) {
  const years = [...summary.availableYears].sort((a, b) => b - a)
  return <div className="data-table-wrap"><table className="data-table analysis-table"><thead><tr><th>Ano</th><th>Geral</th>{dimensions.map((item) => <th key={item.dimensionId}>{item.dimensionName}</th>)}</tr></thead><tbody>{years.map((year) => { const general = summary.yearlySummaries.find((item) => item.year === year); const total = general?.totalMunicipalitiesInRegion ?? 0; return <tr key={year}><td><strong>{year}</strong></td><td><span className={`position-badge position-badge--${rankTone(general?.overallRank, total)}`}>{formatPosition(general?.overallRank)}</span></td>{dimensions.map((dimension) => { const row = dimension.dimensionHistory.find((item) => item.year === year); return <td key={dimension.dimensionId}><span className={`position-badge position-badge--${rankTone(row?.rank, row?.totalMunicipalitiesInRegion ?? total)}`}>{formatPosition(row?.rank)}</span></td> })}</tr>})}</tbody></table></div>
}

type DimensionViewProps = { data: MunicipalityDimensionData; summary: MunicipalitySummaryData; catalog: CatalogData; referenceYear: number; selectedIndicatorId: string; setSelectedIndicatorId: (id: string) => void; selectedIndicator: MunicipalityDimensionData['indicators'][number] | undefined; selectedMetadata: CatalogData['indicators'][number] | undefined }

function DimensionView({ data, summary, catalog, referenceYear, selectedIndicatorId, setSelectedIndicatorId, selectedIndicator, selectedMetadata }: DimensionViewProps) {
  const years = [...data.availableYears].sort((a, b) => a - b)
  const metadata = new Map(catalog.indicators.map((item) => [item.id, item]))
  const sortedIndicators = [...data.indicators].sort((a, b) => {
    const labelA = metadata.get(a.indicatorId)?.name ?? metadata.get(a.indicatorId)?.shortName ?? a.indicatorId
    const labelB = metadata.get(b.indicatorId)?.name ?? metadata.get(b.indicatorId)?.shortName ?? b.indicatorId
    return INDICATOR_COLLATOR.compare(labelA, labelB)
  })
  const currentScores = data.indicators.map((indicator) => indicator.values.find((item) => item.year === referenceYear)?.score ?? null)
  const regionalScores = data.indicators.map((indicator) => indicator.values.find((item) => item.year === referenceYear)?.regionalMedianScore ?? null)
  const radarLabels = data.indicators.map((indicator) => {
    const item = metadata.get(indicator.indicatorId)
    return item?.name && item.name.length <= 34 ? item.name : item?.shortName ?? item?.name ?? indicator.indicatorId
  })
  const indicatorDescription = selectedMetadata?.description ?? 'Descrição metodológica não disponível.'
  const indicatorDirection = selectedMetadata?.direction === 'higher_is_better' ? 'Valores mais altos indicam melhor desempenho neste indicador.' : selectedMetadata?.direction === 'lower_is_better' ? 'Valores mais baixos indicam melhor desempenho neste indicador.' : 'A direção interpretativa deste indicador é neutra.'
  return <div className="analysis-layout">
    <Panel title={`Histórico de posição - ${data.dimensionName}`}><LineChartSimple invert primaryLabel={summary.municipality.name} points={years.map((year) => ({ label: String(year), value: data.dimensionHistory.find((item) => item.year === year)?.rank ?? null }))} valueFormatter={(value) => `${value}º`} /></Panel>
    <Panel title={`Notas da dimensão - ${data.dimensionName}`}><RadarChartSimple primaryLabel={summary.municipality.name} labels={radarLabels} values={currentScores} comparison={regionalScores} /></Panel>
    <section className="analysis-panel analysis-panel--wide"><div className="analysis-panel__title"><Activity size={18} /><h2>Posição do município nos indicadores da dimensão ao longo do tempo</h2></div><IndicatorHistoryTable data={data} metadata={metadata} /></section>
    <section className="indicator-selector analysis-panel--wide"><h2>Selecione um indicador</h2><div>{sortedIndicators.map((indicator) => { const item = metadata.get(indicator.indicatorId); return <button type="button" key={indicator.indicatorId} className={selectedIndicatorId === indicator.indicatorId ? 'is-selected' : ''} onClick={() => setSelectedIndicatorId(indicator.indicatorId)}>{item?.name ?? item?.shortName ?? indicator.indicatorId}</button> })}</div></section>
    {selectedIndicator ? <><Panel title={`Histórico de posição - ${selectedMetadata?.name ?? selectedIndicator.indicatorId}`}><LineChartSimple invert primaryLabel={summary.municipality.name} points={years.map((year) => ({ label: String(year), value: selectedIndicator.values.find((item) => item.year === year)?.rank ?? null }))} valueFormatter={(value) => `${value}º`} /></Panel><Panel title={`Evolução do indicador - ${selectedMetadata?.name ?? selectedIndicator.indicatorId}`} description={<div className="indicator-subtitle"><p>{indicatorDescription}</p><strong>{indicatorDirection}</strong></div>}><LineChartSimple softenScale primaryLabel={summary.municipality.name} yAxisLabel={indicatorAxisLabel(selectedMetadata)} points={years.map((year) => ({ label: String(year), value: selectedIndicator.values.find((item) => item.year === year)?.originalValue ?? null }))} comparison={years.map((year) => ({ label: String(year), value: selectedIndicator.values.find((item) => item.year === year)?.regionalMedianOriginalValue ?? null }))} valueFormatter={(value) => formatIndicatorValue(value, selectedMetadata)} valueLabelFormatter={(value) => formatIndicatorPointLabel(value, selectedMetadata)} /></Panel></> : null}
  </div>
}

function IndicatorHistoryTable({ data, metadata }: { data: MunicipalityDimensionData; metadata: Map<string, CatalogData['indicators'][number]> }) {
  const years = [...data.availableYears].sort((a, b) => b - a)
  return <div className="data-table-wrap"><table className="data-table analysis-table analysis-table--indicators"><thead><tr><th>Ano</th>{data.indicators.map((item) => { const meta = metadata.get(item.indicatorId); return <th key={item.indicatorId}>{meta?.name ?? meta?.shortName ?? item.indicatorId}</th> })}</tr></thead><tbody>{years.map((year) => <tr key={year}><td><strong>{year}</strong></td>{data.indicators.map((indicator) => { const row = indicator.values.find((item) => item.year === year); const total = row?.regionalMedianSampleSize ?? 0; return <td key={indicator.indicatorId}><span className={`position-badge position-badge--${rankTone(row?.rank, total)}`}>{formatPosition(row?.rank)}</span></td> })}</tr>)}</tbody></table></div>
}
