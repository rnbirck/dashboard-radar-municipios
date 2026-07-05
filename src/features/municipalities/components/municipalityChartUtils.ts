export type ChartPoint = { label: string; value: number | null }
export type TooltipRow = { label: string; value: string; tone: 'primary' | 'comparison' }

export const MUNICIPALITY_LABEL = 'Munic\u00edpio'
export const FUNCTIONAL_REGION_MEDIAN_LABEL = 'Mediana da Regi\u00e3o Funcional'

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
