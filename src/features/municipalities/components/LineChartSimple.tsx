import { useState, type PointerEvent } from 'react'
import { ChartTooltip } from './ChartTooltip'
import { clamp, FUNCTIONAL_REGION_MEDIAN_LABEL, MUNICIPALITY_LABEL } from './municipalityChartUtils'
import type { ChartPoint, TooltipRow } from './municipalityChartUtils'

type LineChartSimpleProps = {
  points: ChartPoint[]
  comparison?: ChartPoint[]
  comparisonLabel?: string
  fixedValueLabels?: 'all' | 'last'
  invert?: boolean
  primaryLabel?: string
  showValueLabels?: boolean
  softenScale?: boolean
  valueLabelFormatter?: (value: number) => string
  valueFormatter?: (value: number) => string
  yAxisLabel?: string
}

const WIDTH = 640
const HEIGHT = 286
const PAD = { top: 46, right: 42, bottom: 54, left: 54 }

export function LineChartSimple({ points, comparison, comparisonLabel, fixedValueLabels = 'all', invert = false, primaryLabel = MUNICIPALITY_LABEL, showValueLabels = true, softenScale = false, valueLabelFormatter, valueFormatter, yAxisLabel }: LineChartSimpleProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const values = [...points, ...(comparison ?? [])].flatMap((item) => item.value === null ? [] : [item.value])
  if (!values.length) return <div className="chart-empty">{'N\u00e3o h\u00e1 dados para este per\u00edodo.'}</div>

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const observedSpan = Math.max(rawMax - rawMin, Number.EPSILON)
  const visualMagnitude = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1)
  const visualSpan = softenScale ? Math.max(observedSpan, visualMagnitude * 1.2) : Math.max(observedSpan, 1)
  const spanPadding = softenScale ? visualSpan * .22 : visualSpan * .12
  const center = (rawMin + rawMax) / 2
  const min = softenScale ? center - visualSpan / 2 - spanPadding : rawMin - spanPadding
  const max = softenScale ? center + visualSpan / 2 + spanPadding : rawMax + spanPadding
  const span = max - min
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (points.length === 1 ? plotWidth / 2 : index * plotWidth / (points.length - 1))
  const y = (value: number) => {
    const ratio = (value - min) / span
    return PAD.top + (invert ? ratio : 1 - ratio) * plotHeight
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
  const primaryAreaPath = () => {
    const valid = points
      .map((item, index) => item.value === null ? null : { index, value: item.value })
      .filter((item): item is { index: number; value: number } => item !== null)
    if (valid.length < 2) return ''
    const baseline = PAD.top + plotHeight
    const first = valid[0]
    const last = valid[valid.length - 1]
    return [
      `M ${x(first.index)} ${baseline}`,
      ...valid.map((item) => `L ${x(item.index)} ${y(item.value)}`),
      `L ${x(last.index)} ${baseline}`,
      'Z',
    ].join(' ')
  }
  const format = valueFormatter ?? ((value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
  const formatValueLabel = valueLabelFormatter ?? format
  const comparisonName = comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL
  const primaryLastValueIndex = lastValueIndex(points)
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
    const ratio = clamp((localX - PAD.left) / plotWidth, 0, 1)
    const nextIndex = points.length === 1 ? 0 : Math.round(ratio * (points.length - 1))
    const hasPoint = points[nextIndex]?.value !== null && points[nextIndex]?.value !== undefined
    const hasComparison = comparison?.[nextIndex]?.value !== null && comparison?.[nextIndex]?.value !== undefined
    setHoverIndex(hasPoint || hasComparison ? nextIndex : null)
  }
  const hoverRows = hoverIndex === null ? [] : [
    points[hoverIndex]?.value !== null && points[hoverIndex]?.value !== undefined ? { label: primaryLabel, value: format(points[hoverIndex].value), tone: 'primary' as const } : null,
    comparison?.[hoverIndex]?.value !== null && comparison?.[hoverIndex]?.value !== undefined ? { label: comparisonName, value: format(comparison[hoverIndex].value), tone: 'comparison' as const } : null,
  ].filter((row): row is TooltipRow => row !== null)
  const hoverValues = hoverIndex === null ? [] : [
    points[hoverIndex]?.value,
    comparison?.[hoverIndex]?.value,
  ].filter((value): value is number => value !== null && value !== undefined)
  const hoverTop = hoverIndex === null || !hoverValues.length ? 0 : clamp(((Math.min(...hoverValues.map(y)) - 14) / HEIGHT) * 100, 7, 76)
  const hoverLeft = hoverIndex === null ? 0 : (x(hoverIndex) / WIDTH) * 100

  return (
    <div className="simple-chart-wrap">
      <svg
        className="simple-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={yAxisLabel ? `Gr\u00e1fico de linha com evolu\u00e7\u00e3o anual. Eixo Y: ${yAxisLabel}` : 'Gr\u00e1fico de linha com hist\u00f3rico anual de posi\u00e7\u00e3o'}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <rect x={PAD.left} y={PAD.top} width={plotWidth} height={plotHeight} rx="8" className="chart-plot-area" />
        {yAxisLabel ? <text x="16" y={PAD.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 16 ${PAD.top + plotHeight / 2})`} className="chart-y-axis-label">{yAxisLabel}</text> : null}
        {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + ratio * plotHeight} y2={PAD.top + ratio * plotHeight} className="chart-grid-line" />)}
        {hoverIndex !== null ? <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.top} y2={PAD.top + plotHeight} className="chart-hover-line" /> : null}
        {comparison ? <path d={path(comparison)} className="chart-line chart-line--comparison" /> : null}
        {primaryAreaPath() ? <path d={primaryAreaPath()} className="chart-area chart-area--primary" /> : null}
        <path d={primaryPath} className="chart-line chart-line--primary" />
        {comparison?.map((item, index) => item.value === null ? null : (
          <g key={`${item.label}-comparison`}>
            <circle
              cx={x(index)}
              cy={y(item.value)}
              r={hoverIndex === index ? '5' : '3'}
              tabIndex={0}
              aria-label={`${comparisonName}, ${item.label}: ${format(item.value)}`}
              className="chart-point chart-point--comparison"
              onFocus={() => setHoverIndex(index)}
              onBlur={() => setHoverIndex(null)}
            />
          </g>
        ))}
        {points.map((item, index) => item.value === null ? null : (
          <g key={item.label}>
            <circle
              cx={x(index)}
              cy={y(item.value)}
              r={hoverIndex === index ? '6' : '4.5'}
              tabIndex={0}
              aria-label={`${primaryLabel}, ${item.label}: ${format(item.value)}`}
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
      <div className="chart-legend"><span><i className="legend-line legend-line--primary" />{primaryLabel}</span>{comparison ? <span><i className="legend-line legend-line--comparison" />{comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL}</span> : null}</div>
    </div>
  )
}

function lastValueIndex(series: ChartPoint[]) {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (series[index]?.value !== null && series[index]?.value !== undefined) return index
  }
  return -1
}
