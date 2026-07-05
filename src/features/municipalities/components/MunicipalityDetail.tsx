import { useEffect, useMemo, useState } from 'react'
import type { CatalogData, DimensionId, MunicipalityDimensionData, MunicipalitySummaryData } from '../../../types/domain'
import { DimensionSelector } from './MunicipalityDimensionSelector'
import { GeneralView, DimensionView } from './MunicipalityAnalysisViews'
import { MunicipalityDetailHeader } from './MunicipalityDetailHeader'

const INDICATOR_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base' })

type Props = {
  summary: MunicipalitySummaryData
  dimensions: MunicipalityDimensionData[]
  catalog: CatalogData
  selectedYear?: number
}

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

  useEffect(() => {
    setSelectedIndicatorId(firstIndicatorId)
  }, [firstIndicatorId])

  const referenceYear = selectedYear && summary.availableYears.includes(selectedYear) ? selectedYear : summary.latestYear
  const latest = summary.yearlySummaries.find((item) => item.year === referenceYear)
    ?? summary.yearlySummaries.find((item) => item.year === summary.latestYear)
  const previous = latest ? summary.yearlySummaries.find((item) => item.year === latest.year - 1) : undefined
  if (!latest) return null

  const selectedIndicator = selectedData?.indicators.find((item) => item.indicatorId === selectedIndicatorId)
  const selectedMetadata = selectedIndicator ? indicatorMetadata.get(selectedIndicator.indicatorId) : undefined

  return (
    <div className="municipality-detail">
      <MunicipalityDetailHeader summary={summary} latest={latest} previous={previous} />
      <DimensionSelector
        dimensions={dimensions}
        latest={latest}
        previous={previous}
        selectedDimension={selectedDimension}
        onSelectDimension={setSelectedDimension}
      />

      {selectedDimension === 'geral' ? (
        <GeneralView summary={summary} dimensions={dimensions} referenceYear={latest.year} />
      ) : selectedData ? (
        <DimensionView
          data={selectedData}
          summary={summary}
          catalog={catalog}
          referenceYear={latest.year}
          selectedIndicatorId={selectedIndicatorId}
          setSelectedIndicatorId={setSelectedIndicatorId}
          selectedIndicator={selectedIndicator}
          selectedMetadata={selectedMetadata}
        />
      ) : null}
    </div>
  )
}
