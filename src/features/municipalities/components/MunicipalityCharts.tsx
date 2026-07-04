import { useState, type PointerEvent } from 'react'

type ChartPoint = { label: string; value: number | null }
type TooltipRow = { label: string; value: string; tone: 'primary' | 'comparison' }

type LineChartSimpleProps = {
  points: ChartPoint[]
  comparison?: ChartPoint[]
  comparisonLabel?: string
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
const PAD = { top: 42, right: 42, bottom: 50, left: 54 }
const MUNICIPALITY_LABEL = 'Munic\u00edpio'
const FUNCTIONAL_REGION_MEDIAN_LABEL = 'Mediana da Regi\u00e3o Funcional'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function ChartTooltip({ title, rows, left, top }: { title: string; rows: TooltipRow[]; left: number; top: number }) {
  return (
    <div className={`chart-tooltip${left > 74 ? ' chart-tooltip--right' : ''}`} style={{ left: `${left}%`, top: `${top}%` }}>
      <strong>{title}</strong>
      {rows.map((row) => (
        <span key={row.label} className={`chart-tooltip__row chart-tooltip__row--${row.tone}`}>
          <i />
          <b>{row.label}</b>
          <em>{row.value}</em>
        </span>
      ))}
    </div>
  )
}

export function LineChartSimple({ points, comparison, comparisonLabel, invert = false, primaryLabel = MUNICIPALITY_LABEL, showValueLabels = true, softenScale = false, valueLabelFormatter, valueFormatter, yAxisLabel }: LineChartSimpleProps) {
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
            {showValueLabels ? <text x={x(index)} y={y(item.value) + 15} textAnchor="middle" className="chart-value-label chart-value-label--comparison">{formatValueLabel(item.value)}</text> : null}
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
            {showValueLabels ? <text x={x(index)} y={y(item.value) - 11} textAnchor="middle" className="chart-value-label">{formatValueLabel(item.value)}</text> : null}
          </g>
        ))}
        {points.map((item, index) => <text key={`${item.label}-axis`} x={x(index)} y={HEIGHT - 14} textAnchor="middle" className="chart-axis-label">{item.label}</text>)}
      </svg>
      {hoverIndex !== null && hoverRows.length ? <ChartTooltip title={points[hoverIndex]?.label ?? ''} rows={hoverRows} left={hoverLeft} top={hoverTop} /> : null}
      <div className="chart-legend"><span><i className="legend-line legend-line--primary" />{primaryLabel}</span>{comparison ? <span><i className="legend-line legend-line--comparison" />{comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL}</span> : null}</div>
    </div>
  )
}

type RadarChartSimpleProps = {
  labels: string[]
  values: Array<number | null>
  comparison?: Array<number | null>
  comparisonLabel?: string
  max?: number
  primaryLabel?: string
}

export function RadarChartSimple({ labels, values, comparison, comparisonLabel, max = 10, primaryLabel = MUNICIPALITY_LABEL }: RadarChartSimpleProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  if (!labels.length || !values.some((value) => value !== null)) return <div className="chart-empty">{'N\u00e3o h\u00e1 dados para esta compara\u00e7\u00e3o.'}</div>
  const size = 420
  const center = size / 2
  const radius = 152
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / labels.length)
    const distance = radius * Math.max(0, Math.min(value / max, 1))
    return [center + Math.cos(angle) * distance, center + Math.sin(angle) * distance]
  }
  const polygon = (series: Array<number | null>) => series.map((value, index) => point(index, value ?? 0).join(',')).join(' ')
  const pointsFor = (series: Array<number | null>) => series.map((value, index) => value === null ? null : point(index, value))
  const axisEnd = (index: number) => point(index, max)
  const labelPoint = (index: number) => {
    const [labelX, labelY] = point(index, max * 1.2)
    return [labelX, labelY]
  }
  const labelLines = (label: string) => {
    if (label.length <= 18) return [label]
    const words = label.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length > 18 && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }
    if (current) lines.push(current)
    if (lines.length <= 2) return lines
    return [lines[0], `${lines.slice(1).join(' ').slice(0, 20)}...`]
  }
  const formatScore = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const comparisonName = comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL
  const hoverValue = hoverIndex === null ? null : values[hoverIndex] ?? comparison?.[hoverIndex] ?? max * .18
  const hoverCoords = hoverIndex === null || hoverValue === null ? null : point(hoverIndex, Math.max(hoverValue, max * .18))
  const hoverRows = hoverIndex === null ? [] : [
    values[hoverIndex] !== null && values[hoverIndex] !== undefined ? { label: primaryLabel, value: formatScore(values[hoverIndex]), tone: 'primary' as const } : null,
    comparison?.[hoverIndex] !== null && comparison?.[hoverIndex] !== undefined ? { label: comparisonName, value: formatScore(comparison[hoverIndex]), tone: 'comparison' as const } : null,
  ].filter((row): row is TooltipRow => row !== null)
  const handleRadarPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const localX = ((event.clientX - rect.left) / rect.width) * size
    const localY = ((event.clientY - rect.top) / rect.height) * size
    const dx = localX - center
    const dy = localY - center
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < radius * .28 || distance > radius * 1.55) {
      setHoverIndex(null)
      return
    }
    let angle = Math.atan2(dy, dx) + Math.PI / 2
    if (angle < 0) angle += Math.PI * 2
    const nextIndex = Math.round(angle / (Math.PI * 2 / labels.length)) % labels.length
    const hasValue = values[nextIndex] !== null && values[nextIndex] !== undefined
    const hasComparison = comparison?.[nextIndex] !== null && comparison?.[nextIndex] !== undefined
    setHoverIndex(hasValue || hasComparison ? nextIndex : null)
  }

  return (
    <div className="radar-chart-wrap">
      <svg
        className="radar-chart"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Gr\u00e1fico radar comparando ${primaryLabel}${comparison ? ` e ${comparisonName}` : ''}`}
        onPointerMove={handleRadarPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {[.25, .5, .75, 1].map((ratio) => <polygon key={ratio} points={labels.map((_, index) => point(index, max * ratio).join(',')).join(' ')} className="radar-grid" />)}
        {labels.map((_, index) => { const [lineX, lineY] = axisEnd(index); return <line key={index} x1={center} y1={center} x2={lineX} y2={lineY} className="radar-axis" /> })}
        {comparison ? <polygon points={polygon(comparison)} className="radar-area radar-area--comparison" /> : null}
        <polygon points={polygon(values)} className="radar-area radar-area--primary" />
        {comparison ? pointsFor(comparison).map((coords, index) => coords ? (
          <circle
            key={`comparison-point-${index}`}
            cx={coords[0]}
            cy={coords[1]}
            r={hoverIndex === index ? '5' : '3.2'}
            tabIndex={0}
            aria-label={`${comparisonName}, ${labels[index]}: ${formatScore(comparison[index] ?? 0)}`}
            className="radar-point radar-point--comparison"
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
            onFocus={() => setHoverIndex(index)}
            onBlur={() => setHoverIndex(null)}
          />
        ) : null) : null}
        {pointsFor(values).map((coords, index) => coords ? (
          <circle
            key={`primary-point-${index}`}
            cx={coords[0]}
            cy={coords[1]}
            r={hoverIndex === index ? '5.8' : '3.8'}
            tabIndex={0}
            aria-label={`${primaryLabel}, ${labels[index]}: ${formatScore(values[index] ?? 0)}`}
            className="radar-point radar-point--primary"
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
            onFocus={() => setHoverIndex(index)}
            onBlur={() => setHoverIndex(null)}
          />
        ) : null)}
        {labels.map((label, index) => {
          const [labelX, labelY] = labelPoint(index)
          const lines = labelLines(label)
          return <text key={label} x={labelX} y={labelY} textAnchor={labelX < center - 8 ? 'end' : labelX > center + 8 ? 'start' : 'middle'} className={`radar-label${hoverIndex === index ? ' is-hovered' : ''}`} onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)}><title>{label}</title>{lines.map((line, lineIndex) => <tspan key={`${label}-${lineIndex}`} x={labelX} dy={lineIndex === 0 ? (lines.length > 1 ? '-0.3em' : 0) : '1.18em'}>{line}</tspan>)}</text>
        })}
      </svg>
      {hoverIndex !== null && hoverCoords && hoverRows.length ? <ChartTooltip title={labels[hoverIndex]} rows={hoverRows} left={(hoverCoords[0] / size) * 100} top={clamp(((hoverCoords[1] - 18) / size) * 100, 5, 82)} /> : null}
      <div className="chart-legend"><span><i className="legend-area legend-area--primary" />{primaryLabel}</span>{comparison ? <span><i className="legend-area legend-area--comparison" />{comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL}</span> : null}</div>
    </div>
  )
}
