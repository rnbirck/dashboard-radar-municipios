export type Region = {
  id: string
  name: string
  municipalityCount?: number
  coredeCount?: number
}

export type Municipality = {
  id: string
  name: string
  regionId: string
  corede?: string
}

export type DashboardManifest = {
  schemaVersion: string
  dataVersion: string
  generatedAt: string
  years: number[]
  defaultYear: number
}
