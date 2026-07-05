import type { DimensionId, IndicatorCatalogEntry, PopulationPerformanceCode } from '../../../types/domain'

export const DIMENSION_IDS: DimensionId[] = [
  'educacao', 'financas', 'meio_ambiente', 'saude', 'seguranca', 'socioeconomico',
]

export const DIMENSION_RANK_KEYS: Record<DimensionId, 'educacao' | 'financas' | 'meioAmbiente' | 'saude' | 'seguranca' | 'socioeconomico'> = {
  educacao: 'educacao',
  financas: 'financas',
  meio_ambiente: 'meioAmbiente',
  saude: 'saude',
  seguranca: 'seguranca',
  socioeconomico: 'socioeconomico',
}

export function rankTone(rank: number | null | undefined, total: number): 'good' | 'middle' | 'low' | 'neutral' {
  if (rank === null || rank === undefined || total < 1) return 'neutral'
  const percentile = rank / total
  if (percentile <= .5) return 'good'
  if (percentile <= .75) return 'middle'
  return 'low'
}

export function formatPosition(rank: number | null | undefined): string {
  return rank === null || rank === undefined ? '\u2014' : `${rank}\u00ba`
}

export function variationTone(current: number | null | undefined, previous: number | null | undefined): 'up' | 'down' | 'neutral' {
  if (current === null || current === undefined || previous === null || previous === undefined || current === previous) return 'neutral'
  return current < previous ? 'up' : 'down'
}

export function formatRankVariation(current: number | null | undefined, previous: number | null | undefined): string {
  if (current === null || current === undefined || previous === null || previous === undefined) return 'varia\u00e7\u00e3o indispon\u00edvel'
  const change = previous - current
  const suffix = Math.abs(change) === 1 ? 'posi\u00e7\u00e3o' : 'posi\u00e7\u00f5es'
  if (change > 0) return `subiu ${change} ${suffix}`
  if (change < 0) return `caiu ${Math.abs(change)} ${suffix}`
  return 'sem varia\u00e7\u00e3o'
}

export function performanceShortLabel(code: PopulationPerformanceCode): string {
  if (code === 'above') return 'Acima'
  if (code === 'expected') return 'Dentro'
  if (code === 'below') return 'Abaixo'
  return 'N\u00e3o informado'
}

function scaledIndicatorValue(value: number, metadata?: IndicatorCatalogEntry): number {
  return value * (metadata?.multiplier ?? 1)
}

function minimumFractionDigits(metadata?: IndicatorCatalogEntry): number {
  return metadata?.id === 'vinculos_per_capita' ? metadata.decimalPlaces ?? 2 : 0
}

export function formatIndicatorValue(value: number | null, metadata?: IndicatorCatalogEntry): string {
  if (value === null || !Number.isFinite(value)) return '\u2014'
  const displayValue = scaledIndicatorValue(value, metadata)
  const decimals = metadata?.decimalPlaces ?? 2
  if (metadata?.format === 'currency') {
    return displayValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: decimals })
  }
  const formatted = displayValue.toLocaleString('pt-BR', { minimumFractionDigits: minimumFractionDigits(metadata), maximumFractionDigits: decimals })
  if (metadata?.format === 'percent' || metadata?.unit === '%') return `${formatted}%`
  return metadata?.unit ? `${formatted} ${metadata.unit}` : formatted
}

export function formatIndicatorPointLabel(value: number | null, metadata?: IndicatorCatalogEntry): string {
  if (value === null || !Number.isFinite(value)) return '\u2014'
  const displayValue = scaledIndicatorValue(value, metadata)
  const decimals = metadata?.decimalPlaces ?? 2
  if (metadata?.format === 'currency') {
    return displayValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: decimals })
  }
  const formatted = displayValue.toLocaleString('pt-BR', { minimumFractionDigits: minimumFractionDigits(metadata), maximumFractionDigits: decimals })
  return metadata?.format === 'percent' || metadata?.unit === '%' ? `${formatted}%` : formatted
}

export function indicatorAxisLabel(metadata?: IndicatorCatalogEntry): string {
  if (!metadata) return 'Valor do indicador'
  if (metadata.format === 'percent' || metadata.unit === '%') return 'Percentual (%)'
  if (metadata.format === 'currency') return metadata.unit ? `Valor (${metadata.unit})` : 'Valor (R$)'
  return metadata.unit ?? metadata.shortName ?? 'Valor do indicador'
}
