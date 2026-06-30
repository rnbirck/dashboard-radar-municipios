/** Formatação centralizada para a camada de apresentação. */

const MISSING = '\u2014'

/**
 * Exibe um valor numérico opcional; retorna `—` quando `null` ou `undefined`.
 */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return MISSING
  return value.toFixed(decimals).replace('.', ',')
}

/**
 * Exibe um valor percentual; retorna `—` quando `null` ou `undefined`.
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return MISSING
  return `${value.toFixed(decimals).replace('.', ',')}%`
}

/**
 * Exibe um inteiro opcional (ex.: ranking, contagem); retorna `—` qdo ausente.
 */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING
  return String(value)
}

/**
 * Exibe um ordinal opcional (ex.: posição 1º, 2º, …); retorna `—` qdo ausente.
 */
export function formatOrdinal(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING
  return `${value}º`
}

/**
 * Exibe um valor monetário (R$) opcional; retorna `—` qdo ausente.
 */
export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return MISSING
  return `R$ ${value.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

/**
 * Exibe valor de classificação ou fallback.
 */
export function formatLabel(value: string | null | undefined): string {
  return value ?? MISSING
}

/**
 * Retorna o placeholder de ausência diretamente.
 */
export function missingValue(): string {
  return MISSING
}

/**
 * Mescla label e placeholder.
 */
export function formatWithFallback(value: string | null | undefined, fallback = MISSING): string {
  return value ?? fallback
}