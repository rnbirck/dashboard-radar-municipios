import { ArrowUp } from 'lucide-react'
import { useState, type PointerEvent } from 'react'
import { ChartTooltip } from './ChartTooltip'
import { clamp, FUNCTIONAL_REGION_MEDIAN_LABEL, MUNICIPALITY_LABEL } from './municipalityChartUtils'
import type { ChartPoint, TooltipRow } from './municipalityChartUtils'

type LineChartSimpleProps = {
  points: ChartPoint[]
  comparison?: ChartPoint[]
  comparisonLabel?: string
  stateComparison?: ChartPoint[]
  stateComparisonLabel?: string
  fixedValueLabels?: 'all' | 'last'
  invert?: boolean
  primaryLabel?: string
  primaryTooltipLabel?: string
  showValueLabels?: boolean
  softenScale?: boolean
  comparisonTooltipLabel?: string
  dataSource?: string
  valueLabelFormatter?: (value: number) => string
  valueFormatter?: (value: number) => string
  yAxisLabel?: string
}

const WIDTH = 640
const HEIGHT = 286
const PAD = { top: 46, right: 42, bottom: 54, left: 54 }
const COMPARISON_PAD = { ...PAD, right: 104, left: 50 }

export function LineChartSimple({ points, comparison, comparisonLabel, comparisonTooltipLabel, dataSource, stateComparison, stateComparisonLabel = 'Mediana do RS', fixedValueLabels = 'all', invert = false, primaryLabel = MUNICIPALITY_LABEL, primaryTooltipLabel, showValueLabels = true, softenScale = false, valueLabelFormatter, valueFormatter, yAxisLabel }: LineChartSimpleProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const pad = stateComparison ? COMPARISON_PAD : PAD
  const values = [...points, ...(comparison ?? []), ...(stateComparison ?? [])].flatMap((item) => item.value === null ? [] : [item.value])
  if (!values.length) return <div className="chart-empty">{'N\u00e3o h\u00e1 dados para este per\u00edodo.'}</div>

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const observedSpan = Math.max(rawMax - rawMin, Number.EPSILON)
  const visualMagnitude = Math.max(Math.abs(rawMin), Math.abs(rawMax), Number.EPSILON)
  const visualSpan = softenScale ? Math.max(observedSpan * 1.55, visualMagnitude * .55) : Math.max(observedSpan, 1)
  const spanPadding = softenScale ? visualSpan * .16 : visualSpan * .12
  const center = (rawMin + rawMax) / 2
  const min = softenScale ? center - visualSpan / 2 - spanPadding : rawMin - spanPadding
  const max = softenScale ? center + visualSpan / 2 + spanPadding : rawMax + spanPadding
  const span = max - min
  const plotWidth = WIDTH - pad.left - pad.right
  const plotHeight = HEIGHT - pad.top - pad.bottom
  const x = (index: number) => pad.left + (points.length === 1 ? plotWidth / 2 : index * plotWidth / (points.length - 1))
  const y = (value: number) => {
    const ratio = (value - min) / span
    return pad.top + (invert ? ratio : 1 - ratio) * plotHeight
  }
  const path = (series: ChartPoint[]) => {
    let started = false
    return series.flatMap((item, index) => {
      if (item.value === null) { started = false; return [] }
      const command = started ? 'L' : 'M'
      started = true
      return [`${command} ${x(index)} ${y(item.value)}`]
    }).join(' ')
  }
  const primaryPath = path(points)
  const primaryAreaPaths = () => {
    const baseline = pad.top + plotHeight
    const paths: string[] = []
    let segment: { index: number; value: number }[] = []
    const flush = () => {
      if (segment.length >= 2) {
        const first = segment[0]
        const last = segment[segment.length - 1]
        paths.push([
          `M ${x(first.index)} ${baseline}`,
          ...segment.map((item) => `L ${x(item.index)} ${y(item.value)}`),
          `L ${x(last.index)} ${baseline}`,
          'Z',
        ].join(' '))
      }
      segment = []
    }

    points.forEach((item, index) => {
      if (item.value === null) {
        flush()
      } else {
        segment.push({ index, value: item.value })
      }
    })
    flush()
    return paths
  }
  const format = valueFormatter ?? ((value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
  const formatValueLabel = valueLabelFormatter ?? format
  const axisRatios = [0, .5, 1]
  const axisValue = (ratio: number) => invert ? min + ratio * span : max - ratio * span
  const formatAxisTick = (value: number) => {
    if (invert) return `${Math.max(1, Math.round(value))}\u00ba`
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    return formatValueLabel(value)
  }
  const axisTicks = axisRatios
    .map((ratio) => ({ ratio, label: formatAxisTick(axisValue(ratio)) }))
    .filter((tick, index, items) => index === 0 || tick.label !== items[index - 1].label)
  const comparisonName = comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL
  const primaryTooltipName = primaryTooltipLabel ?? primaryLabel
  const comparisonTooltipName = comparisonTooltipLabel ?? comparisonName
  const primaryLastValueIndex = lastValueIndex(points)
  const endLabels = stateComparison ? spreadEndLabels([
    endLabel(points, 'Município', 'primary', y),
    endLabel(comparison, 'Região Funcional', 'comparison', y),
    endLabel(stateComparison, 'RS', 'state', y),
  ].filter((item): item is SeriesEndLabel => item !== null), pad.top + 8, pad.top + plotHeight - 8) : []
  const shouldShowFixedLabel = (index: number, lastIndex: number) => showValueLabels && (fixedValueLabels === 'all' || index === lastIndex)
  const valueLabelY = (series: 'primary' | 'comparison', index: number, value: number) => {
    const baseY = y(value)
    const primaryOffset = 11
    const comparisonOffset = 15
    const separatedPrimaryOffset = 24
    const separatedComparisonOffset = 28
    const primaryValue = points[index]?.value
    const comparisonValue = comparison?.[index]?.value
    if (primaryValue !== null && primaryValue !== undefined && comparisonValue !== null && comparisonValue !== undefined) {
      const defaultPrimaryLabelY = y(primaryValue) - primaryOffset
      const defaultComparisonLabelY = y(comparisonValue) + comparisonOffset
      if (Math.abs(defaultPrimaryLabelY - defaultComparisonLabelY) < 18) {
        return series === 'primary' ? baseY - separatedPrimaryOffset : baseY + separatedComparisonOffset
      }
    }
    return series === 'primary' ? baseY - primaryOffset : baseY + comparisonOffset
  }
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = ((event.clientX - rect.left) / rect.width) * WIDTH
    const ratio = clamp((localX - pad.left) / plotWidth, 0, 1)
    const nextIndex = points.length === 1 ? 0 : Math.round(ratio * (points.length - 1))
    const hasPoint = points[nextIndex]?.value !== null && points[nextIndex]?.value !== undefined
    const hasComparison = comparison?.[nextIndex]?.value !== null && comparison?.[nextIndex]?.value !== undefined
    const hasStateComparison = stateComparison?.[nextIndex]?.value !== null && stateComparison?.[nextIndex]?.value !== undefined
    setHoverIndex(hasPoint || hasComparison || hasStateComparison ? nextIndex : null)
  }
  const hoverRows = hoverIndex === null ? [] : [
    points[hoverIndex]?.value !== null && points[hoverIndex]?.value !== undefined ? { label: primaryTooltipName, value: format(points[hoverIndex].value), tone: 'primary' as const } : null,
    comparison?.[hoverIndex]?.value !== null && comparison?.[hoverIndex]?.value !== undefined ? { label: comparisonTooltipName, value: format(comparison[hoverIndex].value), tone: 'comparison' as const } : null,
    stateComparison?.[hoverIndex]?.value !== null && stateComparison?.[hoverIndex]?.value !== undefined ? { label: stateComparisonLabel, value: format(stateComparison[hoverIndex].value), tone: 'state' as const } : null,
  ].filter((row): row is TooltipRow => row !== null)
  const hoverValues = hoverIndex === null ? [] : [
    points[hoverIndex]?.value,
    comparison?.[hoverIndex]?.value,
    stateComparison?.[hoverIndex]?.value,
  ].filter((value): value is number => value !== null && value !== undefined)
  const hoverTop = hoverIndex === null || !hoverValues.length ? 0 : clamp(((Math.min(...hoverValues.map(y)) - 14) / HEIGHT) * 100, 7, 76)
  const hoverLeft = hoverIndex === null ? 0 : (x(hoverIndex) / WIDTH) * 100

  return (
    <div className="simple-chart-wrap">
      <svg
        className="simple-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={yAxisLabel ? `Gr\u00e1fico de linha com evolu\u00e7\u00e3o do indicador. Eixo Y: ${yAxisLabel}` : 'Gr\u00e1fico de linha com hist\u00f3rico anual de posi\u00e7\u00e3o'}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <rect x={pad.left} y={pad.top} width={plotWidth} height={plotHeight} rx="8" className="chart-plot-area" />
        {yAxisLabel ? <text x="16" y={pad.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 16 ${pad.top + plotHeight / 2})`} className="chart-y-axis-label">{yAxisLabel}</text> : null}
        {axisTicks.map(({ ratio, label }) => (
          <text key={`axis-tick-${ratio}`} x={pad.left - 8} y={pad.top + ratio * plotHeight + 4} textAnchor="end" className="chart-axis-tick">
            {label}
          </text>
        ))}
        {invert ? (
          <g className="chart-scale-hint" aria-hidden="true">
            <text x={WIDTH - pad.right - 15} y={pad.top - 13} textAnchor="end">melhor posição</text>
            <ArrowUp x={WIDTH - pad.right - 12} y={pad.top - 24} width={12} height={12} strokeWidth={2.3} />
          </g>
        ) : null}
        {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={pad.left} x2={WIDTH - pad.right} y1={pad.top + ratio * plotHeight} y2={pad.top + ratio * plotHeight} className="chart-grid-line" />)}
        {hoverIndex !== null ? <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={pad.top} y2={pad.top + plotHeight} className="chart-hover-line" /> : null}
        {stateComparison ? <path d={path(stateComparison)} className="chart-line chart-line--state" /> : null}
        {comparison ? <path d={path(comparison)} className="chart-line chart-line--comparison-halo" /> : null}
        {comparison ? <path d={path(comparison)} className="chart-line chart-line--comparison" /> : null}
        {primaryAreaPaths().map((areaPath, index) => <path key={`primary-area-${index}`} d={areaPath} className="chart-area chart-area--primary" />)}
        <path d={primaryPath} className="chart-line chart-line--primary" />
        {stateComparison?.map((item, index) => item.value === null ? null : (
          <rect
            key={`${item.label}-state`}
            x={x(index) - (hoverIndex === index ? 4 : 3)}
            y={y(item.value) - (hoverIndex === index ? 4 : 3)}
            width={hoverIndex === index ? 8 : 6}
            height={hoverIndex === index ? 8 : 6}
            rx="1"
            tabIndex={0}
            aria-label={`${stateComparisonLabel}, ${item.label}: ${format(item.value)}`}
            className="chart-point chart-point--state"
            onFocus={() => setHoverIndex(index)}
            onBlur={() => setHoverIndex(null)}
          />
        ))}
        {comparison?.map((item, index) => item.value === null ? null : (
          <g key={`${item.label}-comparison`}>
            <rect
              x={x(index) - (hoverIndex === index ? 4.5 : 3.5)}
              y={y(item.value) - (hoverIndex === index ? 4.5 : 3.5)}
              width={hoverIndex === index ? 9 : 7}
              height={hoverIndex === index ? 9 : 7}
              rx="1"
              transform={`rotate(45 ${x(index)} ${y(item.value)})`}
              tabIndex={0}
              aria-label={`${comparisonTooltipName}, ${item.label}: ${format(item.value)}`}
              className="chart-point chart-point--comparison"
              onFocus={() => setHoverIndex(index)}
              onBlur={() => setHoverIndex(null)}
            />
          </g>
        ))}
        {endLabels.map((item) => (
          <g key={`end-label-${item.tone}`} className={`chart-series-end chart-series-end--${item.tone}`}>
            <line x1={x(item.index) + 5} y1={item.targetY} x2={WIDTH - pad.right + 12} y2={item.labelY} className="chart-series-end__connector" />
            <text x={WIDTH - pad.right + 16} y={item.labelY + 4} className="chart-series-end__label">{item.label}</text>
          </g>
        ))}
        {points.map((item, index) => item.value === null ? null : (
          <g key={item.label}>
            <circle
              cx={x(index)}
              cy={y(item.value)}
              r={hoverIndex === index ? '6' : '4.5'}
              tabIndex={0}
              aria-label={`${primaryTooltipName}, ${item.label}: ${format(item.value)}`}
              className="chart-point chart-point--primary"
              onFocus={() => setHoverIndex(index)}
              onBlur={() => setHoverIndex(null)}
            />
            {shouldShowFixedLabel(index, primaryLastValueIndex) ? <text x={x(index)} y={valueLabelY('primary', index, item.value)} textAnchor="middle" className="chart-value-label">{formatValueLabel(item.value)}</text> : null}
          </g>
        ))}
        {points.map((item, index) => <text key={`${item.label}-axis`} x={x(index)} y={HEIGHT - 14} textAnchor="middle" className="chart-axis-label">{item.label}</text>)}
      </svg>
      {hoverIndex !== null && hoverRows.length ? <ChartTooltip title={points[hoverIndex]?.label ?? ''} rows={hoverRows} left={hoverLeft} top={hoverTop} /> : null}
      <div className="chart-legend-stack">
        <div className="chart-legend">
          <span><i className="legend-line legend-line--primary" />{primaryLabel}</span>
          {comparison ? <span><i className="legend-line legend-line--comparison" />{comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL}</span> : null}
          {stateComparison ? <span><i className="legend-line legend-line--state" />{stateComparisonLabel}</span> : null}
        </div>
        {dataSource ? <p className="chart-source"><strong>Fonte:</strong> {dataSource}</p> : null}
      </div>
    </div>
  )
}

function lastValueIndex(series: ChartPoint[]) {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (series[index]?.value !== null && series[index]?.value !== undefined) return index
  }
  return -1
}

type SeriesEndLabel = {
  index: number
  label: string
  labelY: number
  targetY: number
  tone: TooltipRow['tone']
}

function endLabel(series: ChartPoint[] | undefined, label: string, tone: TooltipRow['tone'], y: (value: number) => number): SeriesEndLabel | null {
  if (!series) return null
  const index = lastValueIndex(series)
  const value = series[index]?.value
  if (index < 0 || value === null || value === undefined) return null
  const targetY = y(value)
  return { index, label, labelY: targetY, targetY, tone }
}

function spreadEndLabels(items: SeriesEndLabel[], minY: number, maxY: number) {
  const gap = 17
  const positioned = [...items].sort((a, b) => a.targetY - b.targetY)
  for (let index = 1; index < positioned.length; index += 1) {
    positioned[index].labelY = Math.max(positioned[index].targetY, positioned[index - 1].labelY + gap)
  }
  const overflow = Math.max(0, (positioned.at(-1)?.labelY ?? maxY) - maxY)
  for (const item of positioned) item.labelY -= overflow
  const underflow = Math.max(0, minY - (positioned[0]?.labelY ?? minY))
  for (const item of positioned) item.labelY += underflow
  return positioned
}
