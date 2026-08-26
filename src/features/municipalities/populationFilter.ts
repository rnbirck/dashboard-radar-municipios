export const POPULATION_FILTER_OPTIONS = [
  { value: 'ate_10000', label: 'De 0 a 10 mil habitantes' },
  { value: 'de_10001_a_20000', label: 'De 10.001 a 20 mil habitantes' },
  { value: 'de_20001_a_50000', label: 'De 20.001 a 50 mil habitantes' },
  { value: 'de_50001_a_100000', label: 'De 50.001 a 100 mil habitantes' },
  { value: 'acima_100000', label: 'Acima de 100 mil habitantes' },
] as const

export type PopulationFilterId = typeof POPULATION_FILTER_OPTIONS[number]['value']

export function isPopulationFilterId(value: string): value is PopulationFilterId {
  return POPULATION_FILTER_OPTIONS.some((option) => option.value === value)
}

export function populationFilterLabel(value: PopulationFilterId): string {
  return POPULATION_FILTER_OPTIONS.find((option) => option.value === value)?.label ?? ''
}

export function matchesPopulationFilter(population: number | null | undefined, filter: PopulationFilterId | ''): boolean {
  if (!filter) return true
  if (population === null || population === undefined) return false

  switch (filter) {
    case 'ate_10000': return population <= 10_000
    case 'de_10001_a_20000': return population > 10_000 && population <= 20_000
    case 'de_20001_a_50000': return population > 20_000 && population <= 50_000
    case 'de_50001_a_100000': return population > 50_000 && population <= 100_000
    case 'acima_100000': return population > 100_000
  }
}
