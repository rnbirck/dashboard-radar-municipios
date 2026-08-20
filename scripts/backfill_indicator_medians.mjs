import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const referenceYear = Number(process.argv[2] ?? 2025)
if (!Number.isInteger(referenceYear)) {
  throw new Error(`Ano de referência inválido: ${process.argv[2]}`)
}

const projectRoot = process.cwd()
const dataVersion = 'v2025'
const catalogPath = path.join(projectRoot, 'public', 'data', dataVersion, 'catalog.json')
const municipalitiesPath = path.join(projectRoot, 'public', 'data', dataVersion, 'municipalities')

const catalogEnvelope = JSON.parse(await readFile(catalogPath, 'utf8'))
const catalog = catalogEnvelope.data
const regions = [...catalog.regions].sort((a, b) => a.order - b.order)
const municipalityCountByRegion = Object.fromEntries(
  regions.map((region) => [
    region.id,
    catalog.municipalities.filter((municipality) => municipality.regionId === region.id).length,
  ]),
)

const accumulator = new Map()
const municipalityIds = await readdir(municipalitiesPath)

for (const municipalityId of municipalityIds) {
  const municipalityPath = path.join(municipalitiesPath, municipalityId)
  const dimensionFiles = (await readdir(municipalityPath)).filter((file) => file.endsWith('.json') && file !== 'summary.json')

  for (const dimensionFile of dimensionFiles) {
    const envelope = JSON.parse(await readFile(path.join(municipalityPath, dimensionFile), 'utf8'))
    const dimension = envelope.data

    for (const indicator of dimension.indicators) {
      const row = indicator.values.find((value) => value.year === referenceYear)
      if (!row || row.isImputed || !Number.isFinite(row.originalValue)) continue

      const current = accumulator.get(indicator.indicatorId) ?? {
        state: { values: [] },
        regions: new Map(),
      }
      const region = current.regions.get(dimension.regionId) ?? { values: [] }

      current.state.values.push(row.originalValue)
      region.values.push(row.originalValue)
      current.regions.set(dimension.regionId, region)
      accumulator.set(indicator.indicatorId, current)
    }
  }
}

const median = (entry, municipalityCount) => {
  const sorted = [...entry.values].sort((a, b) => a - b)
  const size = sorted.length
  let value = null
  if (size) {
    const mid = Math.floor(size / 2)
    value = size % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }
  return {
    medianOriginalValue: value,
    sampleSize: size,
    municipalityCount,
  }
}

const indicatorMedians = Object.fromEntries(catalog.indicators.map((indicator) => {
  const current = accumulator.get(indicator.id) ?? {
    state: { values: [] },
    regions: new Map(),
  }

  return [indicator.id, {
    state: median(current.state, catalog.municipalities.length),
    regions: Object.fromEntries(regions.map((region) => [
      region.id,
      median(current.regions.get(region.id) ?? { values: [] }, municipalityCountByRegion[region.id]),
    ])),
  }]
}))

catalog.indicatorMediansByReferenceYear = {
  ...(catalog.indicatorMediansByReferenceYear ?? {}),
  [String(referenceYear)]: indicatorMedians,
}

await writeFile(catalogPath, `${JSON.stringify(catalogEnvelope, null, 2)}\n`, 'utf8')

console.log(`Medianas de ${referenceYear} geradas para ${Object.keys(indicatorMedians).length} indicadores.`)
