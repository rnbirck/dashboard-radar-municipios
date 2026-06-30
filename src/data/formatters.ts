export function formatMissingValue(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

export function formatNumberBR(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined
    ? formatMissingValue(value)
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

export function formatPercentBR(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined
    ? formatMissingValue(value)
    : new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

export function formatOrdinalBR(value: number | null | undefined): string {
  return value === null || value === undefined ? formatMissingValue(value) : `${value}º`
}
