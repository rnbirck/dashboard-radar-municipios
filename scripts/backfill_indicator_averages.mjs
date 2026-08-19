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
        state: { sum: 0, sampleSize: 0 },
        regions: new Map(),
      }
      const region = current.regions.get(dimension.regionId) ?? { sum: 0, sampleSize: 0 }

      current.state.sum += row.originalValue
      current.state.sampleSize += 1
      region.sum += row.originalValue
      region.sampleSize += 1
      current.regions.set(dimension.regionId, region)
      accumulator.set(indicator.indicatorId, current)
    }
  }
}

const average = (entry, municipalityCount) => ({
  averageOriginalValue: entry.sampleSize ? entry.sum / entry.sampleSize : null,
  sampleSize: entry.sampleSize,
  municipalityCount,
})

const indicatorAverages = Object.fromEntries(catalog.indicators.map((indicator) => {
  const current = accumulator.get(indicator.id) ?? {
    state: { sum: 0, sampleSize: 0 },
    regions: new Map(),
  }

  return [indicator.id, {
    state: average(current.state, catalog.municipalities.length),
    regions: Object.fromEntries(regions.map((region) => [
      region.id,
      average(current.regions.get(region.id) ?? { sum: 0, sampleSize: 0 }, municipalityCountByRegion[region.id]),
    ])),
  }]
}))

catalog.indicatorAveragesByReferenceYear = {
  ...(catalog.indicatorAveragesByReferenceYear ?? {}),
  [String(referenceYear)]: indicatorAverages,
}

await writeFile(catalogPath, `${JSON.stringify(catalogEnvelope, null, 2)}\n`, 'utf8')

console.log(`Médias de ${referenceYear} geradas para ${Object.keys(indicatorAverages).length} indicadores.`)
