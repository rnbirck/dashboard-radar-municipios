import type { Municipality, Region } from '../types/domain'

// Mock tipado temporário. Na próxima fase, estas funções passarão a usar fetch
// de JSONs estáticos versionados em /public/data. Não há acesso a Supabase ou backend.
const MOCK_YEARS = [2025, 2024, 2023, 2022, 2021]

const MOCK_REGIONS: Region[] = [
  { id: 'RF1', name: 'RF1' },
  { id: 'RF2', name: 'RF2' },
  { id: 'RF3', name: 'RF3' },
]

const MOCK_MUNICIPALITIES: Municipality[] = []

export async function getAvailableYears(): Promise<number[]> {
  return MOCK_YEARS
}

export async function getRegions(_year: number): Promise<Region[]> {
  return MOCK_REGIONS
}

export async function getMunicipalities(_year: number, _regionId?: string): Promise<Municipality[]> {
  return MOCK_MUNICIPALITIES
}
