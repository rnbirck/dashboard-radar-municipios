const MISSING = '\u2014'

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING
  return String(value)
}

export function missingValue(): string {
  return MISSING
}
