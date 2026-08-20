import { useState } from 'react'
import { ChartTooltip } from './ChartTooltip'
import { clamp } from './municipalityChartUtils'
import type { TooltipRow } from './municipalityChartUtils'

export type BarChartPoint = {
  id: string
  label: string
  tooltipLabel: string
  value: number | null
  sampleSize: number
  municipalityCount: number
  tone: TooltipRow['tone']
}

type Props = {
  points: BarChartPoint[]
  axisLabel?: string
  dataSource?: string
  valueFormatter?: (value: number) => string
  valueLabelFormatter?: (value: number) => string
}

const WIDTH = 1200
const HEIGHT = 330
const PAD = { top: 18, right: 24, bottom: 54, left: 104 }

export function BarChartSimple({ points, axisLabel, dataSource, valueFormatter, valueLabelFormatter }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const values = points.flatMap((point) => point.value === null ? [] : [point.value])
  const format = valueFormatter ?? ((value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))
  const formatLabel = valueLabelFormatter ?? format

  if (!values.length) {
    return <div className="chart-empty">Não há medianas disponíveis para este indicador em 2025.</div>
  }

  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const rawMin = Math.min(0, ...values)
  const rawMax = Math.max(0, ...values)
  const observedSpan = Math.max(rawMax - rawMin, Math.max(...values.map(Math.abs)) * .1, Number.EPSILON)
  const min = rawMin < 0 ? rawMin - observedSpan * .12 : 0
  const max = rawMax > 0 ? rawMax + observedSpan * .16 : 0
  const span = Math.max(max - min, Number.EPSILON)
  const bandWidth = plotWidth / points.length
  const columnWidth = Math.min(42, bandWidth * .48)
  const x = (index: number) => PAD.left + bandWidth * (index + .5)
  const y = (value: number) => PAD.top + ((max - value) / span) * plotHeight
  const zeroY = y(0)
  const axisRatios = [0, .25, .5, .75, 1]
  const hoveredPoint = hoverIndex === null ? null : points[hoverIndex]
  const hoverValue = hoveredPoint?.value ?? 0
  const hoverRows: TooltipRow[] = hoveredPoint ? [
    { label: 'Mediana', value: hoveredPoint.value === null ? 'Não disponível' : format(hoveredPoint.value), tone: hoveredPoint.tone },
    { label: 'Municípios considerados', value: `${hoveredPoint.sampleSize} de ${hoveredPoint.municipalityCount}`, tone: hoveredPoint.tone },
  ] : []

  return (
    <div className="bar-chart-wrap">
      <div className="bar-chart-scroll">
        <div className="bar-chart-stage">
          <svg
            className="bar-chart"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Gráfico de colunas com as medianas das Regiões Funcionais e do Rio Grande do Sul em 2025${axisLabel ? `. Eixo de valores: ${axisLabel}` : ''}`}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <rect x={PAD.left} y={PAD.top} width={plotWidth} height={plotHeight} rx="8" className="chart-plot-area" />
            {axisRatios.map((ratio) => {
              const tickY = PAD.top + ratio * plotHeight
              const tickValue = max - ratio * span
              return (
                <g key={ratio}>
                  <line x1={PAD.left} x2={PAD.left + plotWidth} y1={tickY} y2={tickY} className="chart-grid-line" />
                  <text x={PAD.left - 10} y={tickY + 4} textAnchor="end" className="bar-chart__axis-tick">{formatLabel(tickValue)}</text>
                </g>
              )
            })}
            <line x1={PAD.left} x2={PAD.left + plotWidth} y1={zeroY} y2={zeroY} className="bar-chart__zero-line" />
            <g role="list" aria-label="Medianas por território">
              {points.map((point, index) => {
                const centerX = x(index)
                const valueY = point.value === null ? zeroY : y(point.value)
                const columnY = Math.min(zeroY, valueY)
                const columnHeight = point.value === null ? 0 : Math.max(2, Math.abs(valueY - zeroY))
                const labelY = point.value !== null && point.value < 0 ? valueY + 16 : valueY - 8
                const coverage = `${point.sampleSize} de ${point.municipalityCount} municípios incluídos no cálculo`
                const categoryLines = point.label.startsWith('Região Funcional ')
                  ? ['Região Funcional', point.label.replace('Região Funcional ', '')]
                  : point.label === 'Rio Grande do Sul'
                    ? ['Rio Grande', 'do Sul']
                    : [point.label]

                return (
                  <g
                    key={point.id}
                    className="bar-chart__column-group"
                    tabIndex={0}
                    role="listitem"
                    aria-label={`${point.tooltipLabel}: ${point.value === null ? 'mediana não disponível' : format(point.value)}; ${coverage}`}
                    onPointerEnter={() => setHoverIndex(index)}
                    onFocus={() => setHoverIndex(index)}
                    onBlur={() => setHoverIndex(null)}
                  >
                    <rect x={centerX - bandWidth / 2} y={PAD.top} width={bandWidth} height={plotHeight + 34} className="bar-chart__hit-area" />
                    {point.value === null ? null : (
                      <rect
                        x={centerX - columnWidth / 2}
                        y={columnY}
                        width={columnWidth}
                        height={columnHeight}
                        rx="5"
                        className={`bar-chart__column bar-chart__column--${point.tone}${hoverIndex === index ? ' is-hovered' : ''}`}
                      />
                    )}
                    <text x={centerX} y={labelY} textAnchor="middle" className="bar-chart__value-label">
                      {point.value === null ? '—' : formatLabel(point.value)}
                    </text>
                    <text x={centerX} y={PAD.top + plotHeight + 21} textAnchor="middle" className="bar-chart__category-label">
                      {categoryLines.map((line, lineIndex) => (
                        <tspan key={line} x={centerX} dy={lineIndex === 0 ? 0 : 14}>{line}</tspan>
                      ))}
                    </text>
                  </g>
                )
              })}
            </g>
            {axisLabel ? <text x="18" y={PAD.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 18 ${PAD.top + plotHeight / 2})`} className="bar-chart__axis-title">{axisLabel}</text> : null}
          </svg>
          {hoveredPoint ? (
            <ChartTooltip
              title={hoveredPoint.tooltipLabel}
              rows={hoverRows}
              left={clamp((x(hoverIndex ?? 0) / WIDTH) * 100, 12, 88)}
              top={clamp((y(hoverValue) / HEIGHT) * 100, 8, 78)}
              variant="columns"
            />
          ) : null}
        </div>
      </div>
      <div className="chart-legend-stack">
        <div className="chart-legend">
          <span><i className="legend-column legend-column--primary" />Região do município</span>
          <span><i className="legend-column legend-column--comparison" />Outras Regiões Funcionais</span>
          <span><i className="legend-column legend-column--state" />Rio Grande do Sul</span>
        </div>
        {dataSource ? <p className="chart-source"><strong>Fonte:</strong> {dataSource}</p> : null}
      </div>
    </div>
  )
}
