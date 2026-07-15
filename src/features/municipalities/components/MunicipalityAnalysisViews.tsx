import { Activity, BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CatalogData, MunicipalityDimensionData, MunicipalitySummaryData } from '../../../types/domain'
import { LineChartSimple, RadarChartSimple } from './MunicipalityCharts'
import { formatIndicatorPointLabel, formatIndicatorValue, formatPosition, indicatorAxisLabel, rankTone } from './municipalityUi'

const INDICATOR_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base' })
const POSITION_RANK_CAPTION = 'Quanto mais pr\u00f3xima do 1\u00ba lugar, melhor a coloca\u00e7\u00e3o no ranking da Regi\u00e3o Funcional.'
const RADAR_COMPARISON_CAPTION = 'Compara a nota do munic\u00edpio com a mediana da Regi\u00e3o Funcional.'

function Panel({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="analysis-panel analysis-panel--chart">
      <header className="analysis-panel__header">
        <div className="analysis-panel__title"><BarChart3 size={18} /><h2>{title}</h2></div>
        {description ? <div className="analysis-panel__description">{description}</div> : null}
      </header>
      {children}
    </section>
  )
}

export function GeneralView({ summary, dimensions, referenceYear }: { summary: MunicipalitySummaryData; dimensions: MunicipalityDimensionData[]; referenceYear: number }) {
  const years = [...summary.availableYears].sort((a, b) => a - b)
  const labels = dimensions.map((item) => item.dimensionName)
  const values = dimensions.map((item) => item.dimensionHistory.find((row) => row.year === referenceYear)?.score ?? null)
  const medians = dimensions.map((item) => {
    const values = item.indicators
      .map((indicator) => indicator.values.find((row) => row.year === referenceYear)?.regionalMedianScore)
      .filter((value): value is number => value !== null && value !== undefined)
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null
  })

  return (
    <div className="analysis-layout">
      <Panel title="Histórico de posição — Geral" description={POSITION_RANK_CAPTION}>
        <LineChartSimple
          invert
          primaryLabel={summary.municipality.name}
          points={years.map((year) => ({ label: String(year), value: summary.yearlySummaries.find((item) => item.year === year)?.overallRank ?? null }))}
          valueFormatter={(value) => `${value}\u00ba`}
        />
      </Panel>
      <Panel title="Comparação das dimensões — visão geral" description={`${RADAR_COMPARISON_CAPTION} em cada dimens\u00e3o.`}>
        <RadarChartSimple primaryLabel={summary.municipality.name} labels={labels} values={values} comparison={medians} comparisonLabel="Mediana da Região Funcional" />
      </Panel>
      <section className="analysis-panel analysis-panel--wide">
        <div className="analysis-panel__title"><Activity size={18} /><h2>{'Posi\u00e7\u00f5es por dimens\u00e3o ao longo do tempo'}</h2></div>
        <p className="analysis-panel__caption">{'Hist\u00f3rico anual de coloca\u00e7\u00e3o geral e por dimens\u00e3o. Posi\u00e7\u00f5es menores indicam melhor coloca\u00e7\u00e3o no ranking da Regi\u00e3o Funcional.'}</p>
        <PositionHistoryTable summary={summary} dimensions={dimensions} />
      </section>
    </div>
  )
}

function PositionHistoryTable({ summary, dimensions }: { summary: MunicipalitySummaryData; dimensions: MunicipalityDimensionData[] }) {
  const years = [...summary.availableYears].sort((a, b) => b - a)

  return (
    <div className="data-table-wrap">
      <table className="data-table analysis-table analysis-table--positions">
        <caption className="sr-only">Posições geral e por dimensão ao longo dos anos</caption>
        <thead>
          <tr>
            <th>Ano</th>
            <th>Geral</th>
            {dimensions.map((item) => <th key={item.dimensionId}>{item.dimensionName}</th>)}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const general = summary.yearlySummaries.find((item) => item.year === year)
            const total = general?.totalMunicipalitiesInRegion ?? 0

            return (
              <tr key={year}>
                <td><strong>{year}</strong></td>
                <td><span className={`position-badge position-badge--${rankTone(general?.overallRank, total)}`}>{formatPosition(general?.overallRank)}</span></td>
                {dimensions.map((dimension) => {
                  const row = dimension.dimensionHistory.find((item) => item.year === year)
                  return (
                    <td key={dimension.dimensionId}>
                      <span className={`position-badge position-badge--${rankTone(row?.rank, row?.totalMunicipalitiesInRegion ?? total)}`}>
                        {formatPosition(row?.rank)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type DimensionViewProps = {
  data: MunicipalityDimensionData
  summary: MunicipalitySummaryData
  catalog: CatalogData
  referenceYear: number
  selectedIndicatorId: string
  setSelectedIndicatorId: (id: string) => void
  selectedIndicator: MunicipalityDimensionData['indicators'][number] | undefined
  selectedMetadata: CatalogData['indicators'][number] | undefined
}

export function DimensionView({ data, summary, catalog, referenceYear, selectedIndicatorId, setSelectedIndicatorId, selectedIndicator, selectedMetadata }: DimensionViewProps) {
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
  const indicatorDescription = selectedMetadata?.id === 'qt_acesso_infor'
    ? 'Recursos de acesso \u00e0 informa\u00e7\u00e3o nas escolas.'
    : selectedMetadata?.description ?? 'Descri\u00e7\u00e3o metodol\u00f3gica n\u00e3o dispon\u00edvel.'
  const indicatorDirection = selectedMetadata?.direction === 'higher_is_better'
    ? 'Valores mais altos indicam melhor desempenho.'
    : selectedMetadata?.direction === 'lower_is_better'
      ? 'Valores mais baixos indicam melhor desempenho.'
      : 'Dire\u00e7\u00e3o interpretativa neutra.'
  const selectedIndicatorName = selectedMetadata?.name ?? selectedIndicator?.indicatorId ?? ''

  return (
    <div className="analysis-layout">
      <Panel title={`Hist\u00f3rico de posi\u00e7\u00e3o \u2014 ${data.dimensionName}`} description={POSITION_RANK_CAPTION}>
        <LineChartSimple
          invert
          primaryLabel={summary.municipality.name}
          points={years.map((year) => ({ label: String(year), value: data.dimensionHistory.find((item) => item.year === year)?.rank ?? null }))}
          valueFormatter={(value) => `${value}\u00ba`}
        />
      </Panel>
      <Panel title={`Compara\u00e7\u00e3o da dimens\u00e3o \u2014 ${data.dimensionName}`} description={`${RADAR_COMPARISON_CAPTION} nos indicadores selecionados.`}>
        <RadarChartSimple primaryLabel={summary.municipality.name} labels={radarLabels} values={currentScores} comparison={regionalScores} comparisonLabel="Mediana da Região Funcional" />
      </Panel>
      <section className="analysis-panel analysis-panel--wide">
        <div className="analysis-panel__title"><Activity size={18} /><h2>{'Posi\u00e7\u00f5es por indicador ao longo do tempo'}</h2></div>
        <p className="analysis-panel__caption">{'Hist\u00f3rico anual da coloca\u00e7\u00e3o do munic\u00edpio em cada indicador da dimens\u00e3o. Posi\u00e7\u00f5es menores indicam melhor coloca\u00e7\u00e3o no ranking da Regi\u00e3o Funcional.'}</p>
        <IndicatorHistoryTable data={data} indicators={sortedIndicators} metadata={metadata} />
      </section>
      <section className="indicator-selector analysis-panel--wide">
        <h2>Selecione um indicador</h2>
        <div>
          {sortedIndicators.map((indicator) => {
            const item = metadata.get(indicator.indicatorId)
            return (
              <button
                type="button"
                key={indicator.indicatorId}
                aria-pressed={selectedIndicatorId === indicator.indicatorId}
                className={selectedIndicatorId === indicator.indicatorId ? 'is-selected' : ''}
                onClick={() => setSelectedIndicatorId(indicator.indicatorId)}
              >
                {item?.name ?? item?.shortName ?? indicator.indicatorId}
              </button>
            )
          })}
        </div>
      </section>
      {selectedIndicator ? (
        <>
          <Panel title={`Hist\u00f3rico de posi\u00e7\u00e3o \u2014 ${selectedIndicatorName}`} description={POSITION_RANK_CAPTION}>
            <LineChartSimple
              invert
              primaryLabel={summary.municipality.name}
              points={years.map((year) => ({ label: String(year), value: selectedIndicator.values.find((item) => item.year === year)?.rank ?? null }))}
              valueFormatter={(value) => `${value}\u00ba`}
            />
          </Panel>
          <Panel
            title={`Evolu\u00e7\u00e3o do indicador \u2014 ${selectedIndicatorName}`}
            description={<div className="indicator-subtitle"><p>{indicatorDescription}</p> <strong>{indicatorDirection}</strong></div>}
          >
            <LineChartSimple
              softenScale
              primaryLabel={summary.municipality.name}
              yAxisLabel={indicatorAxisLabel(selectedMetadata)}
              points={years.map((year) => ({ label: String(year), value: selectedIndicator.values.find((item) => item.year === year)?.originalValue ?? null }))}
              comparison={years.map((year) => ({ label: String(year), value: selectedIndicator.values.find((item) => item.year === year)?.regionalMedianOriginalValue ?? null }))}
              valueFormatter={(value) => formatIndicatorValue(value, selectedMetadata)}
              valueLabelFormatter={(value) => formatIndicatorPointLabel(value, selectedMetadata)}
            />
          </Panel>
        </>
      ) : null}
    </div>
  )
}

function IndicatorHistoryTable({ data, indicators, metadata }: { data: MunicipalityDimensionData; indicators: MunicipalityDimensionData['indicators']; metadata: Map<string, CatalogData['indicators'][number]> }) {
  const years = [...data.availableYears].sort((a, b) => b - a)

  return (
    <div className="data-table-wrap">
      <table className="data-table analysis-table analysis-table--indicators">
        <caption className="sr-only">Posições dos indicadores de {data.dimensionName} ao longo dos anos</caption>
        <thead>
          <tr>
            <th>Ano</th>
            {indicators.map((item) => {
              const meta = metadata.get(item.indicatorId)
              return <th key={item.indicatorId}>{meta?.name ?? meta?.shortName ?? item.indicatorId}</th>
            })}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td><strong>{year}</strong></td>
              {indicators.map((indicator) => {
                const row = indicator.values.find((item) => item.year === year)
                const total = row?.regionalMedianSampleSize ?? 0
                return (
                  <td key={indicator.indicatorId}>
                    <span className={`position-badge position-badge--${rankTone(row?.rank, total)}`}>
                      {formatPosition(row?.rank)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
