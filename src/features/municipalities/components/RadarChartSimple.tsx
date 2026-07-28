import { useState, type PointerEvent } from 'react'
import { ChartTooltip } from './ChartTooltip'
import { clamp, FUNCTIONAL_REGION_MEDIAN_LABEL, MUNICIPALITY_LABEL } from './municipalityChartUtils'

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
  const formatScore = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const comparisonName = comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL
  const hoverValue = hoverIndex === null ? null : values[hoverIndex] ?? comparison?.[hoverIndex] ?? max * .18
  const hoverCoords = hoverIndex === null || hoverValue === null ? null : point(hoverIndex, Math.max(hoverValue, max * .18))
  const hoverRows = hoverIndex === null ? [] : [
    values[hoverIndex] !== null && values[hoverIndex] !== undefined ? { label: primaryLabel, value: formatScore(values[hoverIndex]), tone: 'primary' as const } : null,
    comparison?.[hoverIndex] !== null && comparison?.[hoverIndex] !== undefined ? { label: comparisonName, value: formatScore(comparison[hoverIndex]), tone: 'comparison' as const } : null,
  ].filter((row): row is Exclude<typeof row, null> => row !== null)
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
        {labels.map((_, index) => {
          const [lineX, lineY] = axisEnd(index)
          return <line key={index} x1={center} y1={center} x2={lineX} y2={lineY} className="radar-axis" />
        })}
        {comparison ? <polygon points={polygon(comparison)} className="radar-area radar-area--comparison" /> : null}
        <polygon points={polygon(values)} className="radar-area radar-area--primary" />
        {[.25, .5, .75, 1].map((ratio) => (
          <text key={`scale-${ratio}`} x={center + 5} y={center - radius * ratio + 11} className="radar-scale-label">
            {formatScore(max * ratio)}
          </text>
        ))}
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
          return (
            <text
              key={label}
              x={labelX}
              y={labelY}
              textAnchor={labelX < center - 8 ? 'end' : labelX > center + 8 ? 'start' : 'middle'}
              className={`radar-label${hoverIndex === index ? ' is-hovered' : ''}`}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <title>{label}</title>
              {lines.map((line, lineIndex) => (
                <tspan key={`${label}-${lineIndex}`} x={labelX} dy={lineIndex === 0 ? (lines.length > 1 ? '-0.3em' : 0) : '1.18em'}>
                  {line}
                </tspan>
              ))}
            </text>
          )
        })}
      </svg>
      {hoverIndex !== null && hoverCoords && hoverRows.length ? <ChartTooltip title={labels[hoverIndex]} rows={hoverRows} left={(hoverCoords[0] / size) * 100} top={clamp(((hoverCoords[1] - 18) / size) * 100, 5, 82)} /> : null}
      <div className="chart-legend"><span><i className="legend-area legend-area--primary" />{primaryLabel}</span>{comparison ? <span><i className="legend-area legend-area--comparison" />{comparisonLabel ?? FUNCTIONAL_REGION_MEDIAN_LABEL}</span> : null}</div>
    </div>
  )
}

function labelLines(label: string) {
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
