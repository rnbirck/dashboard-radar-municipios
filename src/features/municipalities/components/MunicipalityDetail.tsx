import { useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogData, DimensionId, MunicipalityDimensionData, MunicipalitySummaryData } from '../../../types/domain'
import { DimensionSelector } from './MunicipalityDimensionSelector'
import { GeneralView, DimensionView } from './MunicipalityAnalysisViews'
import { MunicipalityDetailHeader } from './MunicipalityDetailHeader'
import { MunicipalityStickySelector, type StickySelectorMode } from './MunicipalityStickySelector'

const INDICATOR_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base' })

type Props = {
  summary: MunicipalitySummaryData
  dimensions: MunicipalityDimensionData[]
  catalog: CatalogData
  selectedYear?: number
}

export function MunicipalityDetail({ summary, dimensions, catalog, selectedYear }: Props) {
  const detailRef = useRef<HTMLDivElement>(null)
  const dimensionSelectorRef = useRef<HTMLDivElement>(null)
  const indicatorSelectorRef = useRef<HTMLElement>(null)
  const [selectedDimension, setSelectedDimension] = useState<'geral' | DimensionId>('geral')
  const [stickySelectorMode, setStickySelectorMode] = useState<StickySelectorMode>('none')
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

  useEffect(() => {
    let animationFrame = 0

    const updateStickySelector = () => {
      const detail = detailRef.current
      const dimensionSelector = dimensionSelectorRef.current
      if (!detail || !dimensionSelector) return

      const topbarHeight = document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 0
      const stickyTop = topbarHeight + 8
      const detailBottom = detail.getBoundingClientRect().bottom
      const dimensionBottom = dimensionSelector.getBoundingClientRect().bottom
      const indicatorTop = indicatorSelectorRef.current?.getBoundingClientRect().top
      let nextMode: StickySelectorMode = 'none'

      if (dimensionBottom <= stickyTop && detailBottom > stickyTop + 58) {
        nextMode = indicatorTop !== undefined && indicatorTop <= stickyTop ? 'indicator' : 'dimension'
      }

      setStickySelectorMode((currentMode) => currentMode === nextMode ? currentMode : nextMode)
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(updateStickySelector)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [selectedDimension, sortedSelectedIndicators.length])

  const referenceYear = selectedYear && summary.availableYears.includes(selectedYear) ? selectedYear : summary.latestYear
  const latest = summary.yearlySummaries.find((item) => item.year === referenceYear)
    ?? summary.yearlySummaries.find((item) => item.year === summary.latestYear)
  const previous = latest ? summary.yearlySummaries.find((item) => item.year === latest.year - 1) : undefined
  if (!latest) return null

  const selectedIndicator = selectedData?.indicators.find((item) => item.indicatorId === selectedIndicatorId)
  const selectedMetadata = selectedIndicator ? indicatorMetadata.get(selectedIndicator.indicatorId) : undefined

  return (
    <div ref={detailRef} className="municipality-detail">
      <MunicipalityDetailHeader summary={summary} latest={latest} previous={previous} />
      <div ref={dimensionSelectorRef} className="dimension-selector-anchor">
        <DimensionSelector
          dimensions={dimensions}
          latest={latest}
          previous={previous}
          selectedDimension={selectedDimension}
          onSelectDimension={setSelectedDimension}
        />
      </div>
      <MunicipalityStickySelector
        mode={stickySelectorMode}
        dimensions={dimensions}
        selectedDimension={selectedDimension}
        onSelectDimension={setSelectedDimension}
        indicators={sortedSelectedIndicators.map((indicator) => ({
          id: indicator.indicatorId,
          label: indicatorMetadata.get(indicator.indicatorId)?.name
            ?? indicatorMetadata.get(indicator.indicatorId)?.shortName
            ?? indicator.indicatorId,
        }))}
        selectedIndicatorId={selectedIndicatorId}
        onSelectIndicator={setSelectedIndicatorId}
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
          indicatorSelectorRef={indicatorSelectorRef}
        />
      ) : null}
    </div>
  )
}
