import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  clearManifestCache,
  DataNotFoundError,
  loadManifest,
  listMunicipalities,
  listRegions,
  listYears,
} from '../../data/repository'
import type { Municipality, Region } from '../../types/domain'

type GlobalFiltersProps = { compact?: boolean }

function readYearParam(params: URLSearchParams): number | null {
  const raw = params.get('ano')
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function readStringParam(params: URLSearchParams, key: string): string {
  return params.get(key) ?? ''
}

export function GlobalFilters({ compact = false }: GlobalFiltersProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const [years, setYears] = useState<number[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [yearInput, setYearInput] = useState('')
  const [region, setRegion] = useState('')
  const [corede, setCorede] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [loadError, setLoadError] = useState(false)

  // Inicializa a partir da URL (deep links) e do manifest.
  const initialized = useRef(false)

  useEffect(() => {
    let cancelled = false
    let generation = 0

    async function bootstrap() {
      try {
        const manifest = await loadManifest()
        if (cancelled) return
        const availableYears = await listYears()
        if (cancelled || generation !== 0) return
        if (!initialized.current) {
          initialized.current = true
          const yearFromUrl = readYearParam(params)
          const validYear = yearFromUrl && availableYears.includes(yearFromUrl)
            ? yearFromUrl
            : manifest.defaultYear
          const regionFromUrl = readStringParam(params, 'regiao')
          const coredeFromUrl = readStringParam(params, 'corede')
          const municipalityFromUrl = readStringParam(params, 'municipio')
          setYearInput(String(validYear))
          setRegion(regionFromUrl)
          setCorede(coredeFromUrl)
          setMunicipality(municipalityFromUrl)
          // Garante um ano inicial canônico na URL sem derrubar outros params.
          if (!params.has('ano') || Number(params.get('ano')) !== validYear) {
            const next = new URLSearchParams(params)
            next.set('ano', String(validYear))
            setParams(next, { replace: true })
          }
        }
        setYears(availableYears)
        setLoadError(false)
      } catch {
        if (!cancelled) {
          setLoadError(true)
          clearManifestCache()
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
      generation += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mantém os controles alinhados à URL quando a navegação parte da tabela.
  useEffect(() => {
    if (!initialized.current) return
    const nextYear = readYearParam(params)
    const nextRegion = readStringParam(params, 'regiao')
    const nextCorede = readStringParam(params, 'corede')
    const nextMunicipality = readStringParam(params, 'municipio')
    if (nextYear !== null && String(nextYear) !== yearInput) setYearInput(String(nextYear))
    if (nextRegion !== region) setRegion(nextRegion)
    if (nextCorede !== corede) setCorede(nextCorede)
    if (nextMunicipality !== municipality) setMunicipality(nextMunicipality)
  }, [params, yearInput, region, corede, municipality])

  // Carrega regiões independentemente (sempre via regions/2025.json).
  useEffect(() => {
    if (!yearInput) return
    const numericYear = Number(yearInput)
    if (!Number.isFinite(numericYear)) return

    let cancelled = false
    void listRegions(numericYear).then((nextRegions) => {
      if (cancelled) return
      const validRegion = region && nextRegions.some((item) => item.id === region) ? region : ''
      if (!validRegion && region) setRegion('')
      setRegions(nextRegions)
    }).catch(() => {
      if (cancelled) return
      setRegions([])
    })

    return () => { cancelled = true }
  }, [yearInput, region])

  // Carrega municípios do ranking regional; falha 404 resulta em lista vazia.
  useEffect(() => {
    if (!yearInput) return
    const numericYear = Number(yearInput)
    if (!Number.isFinite(numericYear)) return

    let cancelled = false
    void listMunicipalities(numericYear, region || undefined)
      .then((nextMunicipalities) => {
        if (cancelled) return
        setMunicipalities(nextMunicipalities)
      })
      .catch((error) => {
        if (cancelled) return
        // 404 de ranking regional para a região selecionada é esperado na
        // amostra; não afeta regiões — apenas esvazia a lista de municípios.
        if (error instanceof DataNotFoundError) {
          setMunicipalities([])
          return
        }
        setLoadError(true)
      })

    return () => { cancelled = true }
  }, [yearInput, region])

  const coredes = useMemo(() => {
    const byId = new Map<string, string>()
    for (const item of municipalities) byId.set(item.coredeId, item.coredeName)
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [municipalities])

  const filteredMunicipalities = useMemo(() => municipalities.filter((item) => {
    if (region && item.regionId !== region) return false
    return !corede || item.coredeId === corede
  }), [municipalities, region, corede])

  function commitParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: false })
  }

  function handleYearChange(next: string) {
    setYearInput(next)
    setRegion('')
    setCorede('')
    setMunicipality('')
    const nextParams = new URLSearchParams(params)
    nextParams.set('ano', next)
    nextParams.delete('regiao')
    nextParams.delete('corede')
    nextParams.delete('municipio')
    setParams(nextParams, { replace: false })
  }

  function handleRegionChange(next: string) {
    setRegion(next)
    setCorede('')
    setMunicipality('')
    if (compact && next) {
      navigate(`/municipios?ano=${encodeURIComponent(yearInput)}&regiao=${encodeURIComponent(next)}`)
      return
    }
    const nextParams = new URLSearchParams(params)
    nextParams.set('ano', yearInput)
    if (next) nextParams.set('regiao', next)
    else nextParams.delete('regiao')
    nextParams.delete('corede')
    nextParams.delete('municipio')
    setParams(nextParams, { replace: false })
  }

  function handleCoredeChange(next: string) {
    setCorede(next)
    setMunicipality('')
    const nextParams = new URLSearchParams(params)
    if (next) nextParams.set('corede', next)
    else nextParams.delete('corede')
    nextParams.delete('municipio')
    setParams(nextParams, { replace: false })
  }

  function handleMunicipalityChange(next: string) {
    setMunicipality(next)
    commitParam('municipio', next)
  }

  function clearFilters() {
    setRegion('')
    setCorede('')
    setMunicipality('')
    const next = new URLSearchParams(params)
    next.set('ano', yearInput)
    next.delete('regiao')
    next.delete('corede')
    next.delete('municipio')
    setParams(next, { replace: false })
  }

  const yearsOptions = years.length ? years : (yearInput ? [Number(yearInput)] : [])

  return (
    <form
      className={compact ? 'global-filters global-filters--compact' : 'global-filters'}
      onSubmit={(event) => event.preventDefault()}
      aria-label="Filtros globais"
    >
      <div className="global-filters__heading">
        <span><SlidersHorizontal size={15} aria-hidden="true" /> Filtros de análise</span>
        <small>{compact ? 'Escolha uma Região Funcional para abrir o ranking.' : 'Refine ano, território e município sem perder o contexto.'}</small>
      </div>
      <div className="filter-field filter-field--year">
        <label htmlFor="filter-year">Ano</label>
        <select
          id="filter-year"
          value={yearInput}
          onChange={(event) => handleYearChange(event.target.value)}
        >
          {yearsOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="filter-field filter-field--region">
        <label htmlFor="filter-region">Região Funcional</label>
        <select
          id="filter-region"
          value={region}
          onChange={(event) => handleRegionChange(event.target.value)}
        >
          <option value="">Selecione uma região funcional</option>
          {regions.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>
      {!compact ? (
        <>
          <div className="filter-field">
            <label htmlFor="filter-corede">Corede</label>
            <select
              id="filter-corede"
              value={corede}
              onChange={(event) => handleCoredeChange(event.target.value)}
            >
              <option value="">Todos os Coredes</option>
              {coredes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div className="filter-field filter-field--municipality">
            <label htmlFor="filter-municipality">Município</label>
            <select
              id="filter-municipality"
              value={municipality}
              onChange={(event) => handleMunicipalityChange(event.target.value)}
            >
              <option value="">Selecione um município</option>
              {filteredMunicipalities.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <button className="clear-filters" type="button" onClick={clearFilters}>
            <RotateCcw size={16} aria-hidden="true" />
            Limpar filtros
          </button>
        </>
      ) : null}
      {loadError ? (
        <p className="filter-field__error" role="status">Não foi possível carregar os filtros. Tente novamente.</p>
      ) : null}
    </form>
  )
}
