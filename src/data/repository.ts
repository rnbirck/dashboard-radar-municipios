/**
 * Camada de leitura de dados estáticos da Fase 1.
 *
 * Substitui os mocks por fetch de JSONs em /public/data. Não há cliente de
 * banco, backend, localStorage nem biblioteca de validação: usamos guards
 * pequenos e explícitos para os campos críticos.
 *
 * Cache: dois Map de promises indexados pela URL final, que deduplicam chamadas
 * concorrentes (inclusive durante o StrictMode) e removem entradas rejeitadas
 * para permitir nova tentativa.
 */

import type {
  CatalogData,
  DashboardManifest,
  Municipality,
  Region,
  RegionsData,
  RegionalRankingData,
  StaticDataEnvelope,
} from '../types/domain'

const BASE = '/data'

let manifestPromise: Promise<DashboardManifest> | null = null

const envelopeCache = new Map<string, Promise<unknown>>()

// ---------------------------------------------------------------------------
// Erros distinguíveis
// ---------------------------------------------------------------------------

export class DataFetchError extends Error {
  readonly url: string
  readonly status?: number
  constructor(message: string, url: string, status?: number) {
    super(message)
    this.name = 'DataFetchError'
    this.url = url
    this.status = status
  }
}

export class DataContractError extends Error {
  readonly url: string
  constructor(message: string, url: string) {
    super(message)
    this.name = 'DataContractError'
    this.url = url
  }
}

export class DataVersionError extends Error {
  readonly url: string
  readonly expected: string
  readonly actual: unknown
  constructor(url: string, expected: string, actual: unknown) {
    super(`Versão incompatível em ${url}: esperada ${expected}, encontrada ${String(actual)}`)
    this.name = 'DataVersionError'
    this.url = url
    this.expected = expected
    this.actual = actual
  }
}

export class DataNotFoundError extends Error {
  readonly url: string
  constructor(url: string) {
    super(`Arquivo de dados não encontrado: ${url}`)
    this.name = 'DataNotFoundError'
    this.url = url
  }
}

// ---------------------------------------------------------------------------
// Guards estruturais mínimos
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function assertEnvelopeFields(payload: unknown, url: string): asserts payload is StaticDataEnvelope<unknown> {
  if (!isRecord(payload)) {
    throw new DataContractError('Payload não é um objeto', url)
  }
  if (!isString(payload.schemaVersion)) {
    throw new DataContractError('schemaVersion ausente ou inválido', url)
  }
  if (!isString(payload.dataVersion)) {
    throw new DataContractError('dataVersion ausente ou inválido', url)
  }
  if (!isString(payload.generatedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(payload.generatedAt)) {
    throw new DataContractError('generatedAt ausente ou fora do formato ISO 8601 UTC', url)
  }
  if (!isRecord(payload.data)) {
    throw new DataContractError('campo data ausente ou inválido', url)
  }
}

function assertManifestFields(payload: unknown, url: string): asserts payload is DashboardManifest {
  if (!isRecord(payload)) {
    throw new DataContractError('Manifesto não é um objeto', url)
  }
  if (!isString(payload.schemaVersion)) {
    throw new DataContractError('manifest.schemaVersion ausente', url)
  }
  if (!isString(payload.activeDataVersion)) {
    throw new DataContractError('manifest.activeDataVersion ausente', url)
  }
  if (!isString(payload.generatedAt)) {
    throw new DataContractError('manifest.generatedAt ausente', url)
  }
  if (!isNumber(payload.defaultYear)) {
    throw new DataContractError('manifest.defaultYear ausente', url)
  }
  if (!Array.isArray(payload.availableYears) || !payload.availableYears.every(isNumber)) {
    throw new DataContractError('manifest.availableYears ausente ou inválido', url)
  }
  if (!isRecord(payload.yearRange) || !isNumber(payload.yearRange.start) || !isNumber(payload.yearRange.end)) {
    throw new DataContractError('manifest.yearRange ausente ou inválido', url)
  }
  if (!isRecord(payload.totals) || !isNumber(payload.totals.municipalities) || !isNumber(payload.totals.regions) || !isNumber(payload.totals.coredes)) {
    throw new DataContractError('manifest.totals ausente ou inválido', url)
  }
  if (!isRecord(payload.files) || !isString(payload.files.catalog) || !isString(payload.files.regionsPattern) || !isString(payload.files.regionalRankingPattern) || !isString(payload.files.municipalitySummaryPattern) || !isString(payload.files.municipalityDimensionPattern)) {
    throw new DataContractError('manifest.files ausente ou inválido', url)
  }
}

function assertVersion(envelope: StaticDataEnvelope<unknown>, expectedVersion: string, url: string): void {
  if (envelope.dataVersion !== expectedVersion) {
    throw new DataVersionError(url, expectedVersion, envelope.dataVersion)
  }
}

// ---------------------------------------------------------------------------
// fetchJson com cache de promises por URL
// ---------------------------------------------------------------------------

async function readEnvelope<T>(
  url: string,
  expectedVersion: string,
  assertData: (data: unknown, url: string) => asserts data is T,
): Promise<T> {
  const cached = envelopeCache.get(url) as Promise<StaticDataEnvelope<T>> | undefined
  if (cached) {
    return cached.then((envelope) => envelope.data)
  }

  const promise = (async () => {
    let response: Response
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch (cause) {
      throw new DataFetchError('Falha de rede ao buscar dados', url)
    }

    if (response.status === 404) {
      throw new DataNotFoundError(url)
    }
    if (!response.ok) {
      throw new DataFetchError(`Resposta HTTP ${response.status}`, url, response.status)
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new DataContractError('JSON inválido', url)
    }

    assertEnvelopeFields(payload, url)
    assertVersion(payload as StaticDataEnvelope<unknown>, expectedVersion, url)
    assertData((payload as StaticDataEnvelope<unknown>).data, url)
    return payload as StaticDataEnvelope<T>
  })()

  envelopeCache.set(url, promise as Promise<unknown>)

  promise.catch(() => {
    // Remove do cache para permitir nova tentativa caso rejeite.
    if (envelopeCache.get(url) === promise) {
      envelopeCache.delete(url)
    }
  })

  return promise.then((envelope) => envelope.data)
}

function assertCatalogData(data: unknown, url: string): asserts data is CatalogData {
  if (!isRecord(data)) {
    throw new DataContractError('catalog.data inválido', url)
  }
  const d = data as Record<string, unknown>
  const requiredArrays = ['regions', 'coredes', 'municipalities', 'dimensions', 'indicators'] as const
  for (const key of requiredArrays) {
    if (!Array.isArray(d[key])) {
      throw new DataContractError(`catalog.data.${key} deve ser um array`, url)
    }
    for (const item of d[key] as unknown[]) {
      if (!isRecord(item)) {
        throw new DataContractError(`catalog.data.${key} contém item inválido`, url)
      }
    }
  }

  // Validação específica dos campos de cada entrada
  for (const region of d['regions'] as unknown[]) {
    const r = region as Record<string, unknown>
    if (!isString(r.id) || !isString(r.slug) || !isString(r.name) || !isNumber(r.order)) {
      throw new DataContractError('catalog.regions: campos obrigatórios ausentes (id, slug, name, order)', url)
    }
  }

  for (const corede of d['coredes'] as unknown[]) {
    const c = corede as Record<string, unknown>
    if (!isString(c.id) || !isString(c.name) || !isString(c.regionId)) {
      throw new DataContractError('catalog.coredes: campos obrigatórios ausentes (id, name, regionId)', url)
    }
  }

  for (const mun of d['municipalities'] as unknown[]) {
    const m = mun as Record<string, unknown>
    if (!isString(m.id) || !isString(m.name) || !isString(m.regionId) || !isString(m.coredeId)) {
      throw new DataContractError('catalog.municipalities: campos obrigatórios ausentes', url)
    }
  }

  for (const dim of d['dimensions'] as unknown[]) {
    const di = dim as Record<string, unknown>
    if (!isString(di.id) || !isString(di.name) || !isNumber(di.order)) {
      throw new DataContractError('catalog.dimensions: campos obrigatórios ausentes', url)
    }
  }

  const validDirections = new Set(['higher_is_better', 'lower_is_better', 'neutral'])
  for (const ind of d['indicators'] as unknown[]) {
    const i = ind as Record<string, unknown>
    if (!isString(i.id) || !isString(i.dimensionId) || !isString(i.name)) {
      throw new DataContractError('catalog.indicators: id/dimensionId/name obrigatórios', url)
    }
    if (!isString(i.direction) || !validDirections.has(i.direction)) {
      throw new DataContractError(`catalog.indicators: direction inválida em "${String(i.id)}"`, url)
    }
  }
}

function assertRegionsData(data: unknown, url: string): asserts data is RegionsData {
  if (!isRecord(data)) {
    throw new DataContractError('regions.data inválido', url)
  }
  const d = data as Record<string, unknown>
  if (!isNumber(d.year) || !isRecord(d.totals) || !Array.isArray(d.regions)) {
    throw new DataContractError('regions.data incompleto', url)
  }

  const totals = d.totals as Record<string, unknown>
  if (!isNumber(totals.municipalities) || !isNumber(totals.regions) || !isNumber(totals.coredes)) {
    throw new DataContractError('regions.totals incompleto', url)
  }

  for (const region of d.regions as unknown[]) {
    const r = region as Record<string, unknown>
    if (!isString(r.id) || !isString(r.name) || !isNumber(r.order)) {
      throw new DataContractError('regions.region: id/name/order obrigatórios', url)
    }
    if (!isNumber(r.municipalityCount)) {
      throw new DataContractError(`regions.region "${String(r.id)}": municipalityCount obrigatório`, url)
    }
    if (!Array.isArray(r.coredeIds) || !Array.isArray(r.coredeNames)) {
      throw new DataContractError(`regions.region "${String(r.id)}": coredeIds/coredeNames obrigatórios`, url)
    }
  }
}

function assertRankingData(data: unknown, url: string): asserts data is RegionalRankingData {
  if (!isRecord(data)) {
    throw new DataContractError('ranking.data inválido', url)
  }
  if (!isString(data.regionId) || !Array.isArray(data.municipalities)) {
    throw new DataContractError('ranking.data incompleto', url)
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function loadManifest(): Promise<DashboardManifest> {
  if (manifestPromise) {
    return manifestPromise
  }

  const url = `${BASE}/manifest.json`
  manifestPromise = (async () => {
    let response: Response
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-cache' })
    } catch {
      throw new DataFetchError('Falha de rede ao buscar o manifesto', url)
    }
    if (!response.ok) {
      throw new DataFetchError(`Manifesto indisponível (HTTP ${response.status})`, url, response.status)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new DataContractError('Manifesto JSON inválido', url)
    }
    assertManifestFields(payload, url)
    return payload
  })()

  manifestPromise.catch(() => {
    manifestPromise = null
  })

  return manifestPromise
}

/** Limpa o cache de manifesto (ex.: retry manual após falha de inicialização). */
export function clearManifestCache(): void {
  manifestPromise = null
}

export async function loadCatalog(): Promise<CatalogData> {
  const manifest = await loadManifest()
  const url = `${BASE}/${manifest.activeDataVersion}/${manifest.files.catalog}`
  return readEnvelope<CatalogData>(url, manifest.activeDataVersion, assertCatalogData)
}

export async function loadRegions(year: number): Promise<RegionsData> {
  const manifest = await loadManifest()
  if (!manifest.availableYears.includes(year)) {
    throw new DataContractError(`Ano ${year} não está disponível no manifesto`, `${BASE}/manifest.json`)
  }
  const relative = manifest.files.regionsPattern.replace('{year}', String(year))
  const url = `${BASE}/${manifest.activeDataVersion}/${relative}`
  return readEnvelope<RegionsData>(url, manifest.activeDataVersion, assertRegionsData)
}

function regionFileSlug(regionId: string): string {
  return regionId.toLowerCase()
}

export async function loadRegionalRanking(year: number, regionId: string): Promise<RegionalRankingData> {
  const manifest = await loadManifest()
  if (!manifest.availableYears.includes(year)) {
    throw new DataContractError(`Ano ${year} não está disponível no manifesto`, `${BASE}/manifest.json`)
  }
  const relative = manifest.files.regionalRankingPattern
    .replace('{year}', String(year))
    .replace('{region}', regionFileSlug(regionId))
  const url = `${BASE}/${manifest.activeDataVersion}/${relative}`
  return readEnvelope<RegionalRankingData>(url, manifest.activeDataVersion, assertRankingData)
}

export async function listYears(): Promise<number[]> {
  const manifest = await loadManifest()
  return [...manifest.availableYears].sort((a, b) => b - a)
}

export async function listRegions(year: number): Promise<Region[]> {
  const regions = await loadRegions(year)
  return regions.regions
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      slug: entry.id.toLowerCase(),
      order: entry.order,
    }))
    .sort((a, b) => a.order - b.order)
}

const ptBrCollator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

export async function listMunicipalities(year: number, regionId?: string): Promise<Municipality[]> {
  if (regionId) {
    const ranking = await loadRegionalRanking(year, regionId)
    return ranking.municipalities
      .map((entry) => ({
        id: entry.municipalityId,
        name: entry.municipalityName,
        regionId: ranking.regionId,
        coredeId: entry.coredeId,
        coredeName: entry.coredeName,
      }))
      .sort((a, b) => ptBrCollator.compare(a.name, b.name))
  }

  const catalog = await loadCatalog()
  return catalog.municipalities
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      regionId: entry.regionId,
      coredeId: entry.coredeId,
      coredeName: catalog.coredes.find((corede) => corede.id === entry.coredeId)?.name ?? '',
    }))
    .sort((a, b) => ptBrCollator.compare(a.name, b.name))
}

// ---------------------------------------------------------------------------
// Backward-compat nominal mantido temporariamente para facilitar a migração
// dos filtros; prefira as funções list* acima.
// ---------------------------------------------------------------------------

export const getAvailableYears = listYears
export async function getRegions(year: number): Promise<Region[]> {
  return listRegions(year)
}
export async function getMunicipalities(year: number, regionId?: string): Promise<Municipality[]> {
  return listMunicipalities(year, regionId)
}