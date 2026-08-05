import { Check, ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import type { FocusEvent, KeyboardEvent } from 'react'
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

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function readInsertedText(previous: string, next: string): string {
  if (!previous || next.length <= previous.length) return next

  let start = 0
  while (start < previous.length && previous[start] === next[start]) start += 1

  let previousEnd = previous.length - 1
  let nextEnd = next.length - 1
  while (previousEnd >= start && nextEnd >= start && previous[previousEnd] === next[nextEnd]) {
    previousEnd -= 1
    nextEnd -= 1
  }

  return next.slice(start, nextEnd + 1)
}

export function GlobalFilters({ compact = false }: GlobalFiltersProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const initialParams = useRef<URLSearchParams | null>(null)
  if (initialParams.current === null) {
    initialParams.current = new URLSearchParams(params)
  }
  const isMunicipalityQueryDraft = useRef(false)
  const replaceMunicipalityQueryOnNextKey = useRef(false)
  const municipalityFieldRef = useRef<HTMLDivElement | null>(null)

  const [years, setYears] = useState<number[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [yearInput, setYearInput] = useState('')
  const [region, setRegion] = useState('')
  const [corede, setCorede] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [municipalityQuery, setMunicipalityQuery] = useState('')
  const [isMunicipalityMenuOpen, setIsMunicipalityMenuOpen] = useState(false)
  const [activeMunicipalityIndex, setActiveMunicipalityIndex] = useState(0)
  const [loadError, setLoadError] = useState(false)

  // Inicializa a partir da URL (deep links) e do manifest.
  const initialized = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const manifest = await loadManifest()
        if (cancelled) return
        const availableYears = await listYears()
        if (cancelled) return
        if (!initialized.current) {
          initialized.current = true
          const paramsFromInitialUrl = initialParams.current ?? new URLSearchParams()
          const yearFromUrl = readYearParam(paramsFromInitialUrl)
          const validYear = yearFromUrl && availableYears.includes(yearFromUrl)
            ? yearFromUrl
            : manifest.defaultYear
          const regionFromUrl = readStringParam(paramsFromInitialUrl, 'regiao')
          const coredeFromUrl = readStringParam(paramsFromInitialUrl, 'corede')
          const municipalityFromUrl = readStringParam(paramsFromInitialUrl, 'municipio')
          setYearInput(String(validYear))
          setRegion(regionFromUrl)
          setCorede(coredeFromUrl)
          setMunicipality(municipalityFromUrl)
          // Garante um ano inicial canônico na URL sem derrubar outros params.
          if (!paramsFromInitialUrl.has('ano') || Number(paramsFromInitialUrl.get('ano')) !== validYear) {
            const next = new URLSearchParams(paramsFromInitialUrl)
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
    }
  }, [setParams])

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
    if (nextMunicipality !== municipality) {
      setMunicipality(nextMunicipality)
      if (nextMunicipality) {
        isMunicipalityQueryDraft.current = false
        const selected = municipalities.find((item) => item.id === nextMunicipality)
        if (selected) setMunicipalityQuery(selected.name)
      }
    }
  }, [params, yearInput, region, corede, municipality, municipalities])

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

  const municipalitySuggestions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(municipalityQuery)
    const items = normalizedQuery && isMunicipalityQueryDraft.current
      ? filteredMunicipalities.filter((item) => {
        const searchable = normalizeSearchText(`${item.name} ${item.coredeName}`)
        return searchable.includes(normalizedQuery)
      })
      : filteredMunicipalities

    return items
  }, [filteredMunicipalities, municipalityQuery])

  useEffect(() => {
    if (!municipality || isMunicipalityQueryDraft.current) return
    const selected = municipalities.find((item) => item.id === municipality)
    if (selected && municipalityQuery !== selected.name) {
      setMunicipalityQuery(selected.name)
    }
  }, [municipality, municipalities, municipalityQuery])

  function commitParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: false })
  }

  function handleYearChange(next: string) {
    setYearInput(next)
    const hasMunicipalitySelected = Boolean(municipality)
    if (hasMunicipalitySelected) {
      const nextParams = new URLSearchParams(params)
      nextParams.set('ano', next)
      setParams(nextParams, { replace: false })
      return
    }

    setRegion('')
    setCorede('')
    setMunicipality('')
    isMunicipalityQueryDraft.current = false
    replaceMunicipalityQueryOnNextKey.current = false
    setIsMunicipalityMenuOpen(false)
    setMunicipalityQuery('')
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
    isMunicipalityQueryDraft.current = false
    replaceMunicipalityQueryOnNextKey.current = false
    setIsMunicipalityMenuOpen(false)
    setMunicipalityQuery('')
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
    isMunicipalityQueryDraft.current = false
    replaceMunicipalityQueryOnNextKey.current = false
    setIsMunicipalityMenuOpen(false)
    setMunicipalityQuery('')
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

  function selectMunicipality(item: Municipality) {
    isMunicipalityQueryDraft.current = false
    replaceMunicipalityQueryOnNextKey.current = false
    setMunicipalityQuery(item.name)
    setIsMunicipalityMenuOpen(false)
    setActiveMunicipalityIndex(0)
    handleMunicipalityChange(item.id)
  }

  function handleMunicipalitySearchChange(next: string) {
    const selectedMunicipality = municipality
      ? municipalities.find((item) => item.id === municipality)
      : undefined
    const nextQuery = !isMunicipalityQueryDraft.current && selectedMunicipality
      ? readInsertedText(selectedMunicipality.name, next)
      : next

    replaceMunicipalityQueryOnNextKey.current = false
    setMunicipalityQuery(nextQuery)
    setIsMunicipalityMenuOpen(true)
    setActiveMunicipalityIndex(0)
    const normalizedNext = normalizeSearchText(nextQuery)
    const selected = filteredMunicipalities.find((item) => (
      normalizeSearchText(item.name) === normalizedNext
    ))

    if (!normalizedNext) {
      isMunicipalityQueryDraft.current = true
      return
    }

    if (selected) {
      selectMunicipality(selected)
      return
    }

    isMunicipalityQueryDraft.current = true
  }

  function handleMunicipalitySearchBlur() {
    window.setTimeout(() => setIsMunicipalityMenuOpen(false), 120)
  }

  function handleMunicipalitySearchFocus(event: FocusEvent<HTMLInputElement>) {
    event.currentTarget.select()
    const selected = municipalities.find((item) => item.id === municipality)
    replaceMunicipalityQueryOnNextKey.current = Boolean(selected && municipalityQuery === selected.name)
    isMunicipalityQueryDraft.current = false
    setIsMunicipalityMenuOpen(true)
    setActiveMunicipalityIndex(0)
  }

  function handleMunicipalitySearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (replaceMunicipalityQueryOnNextKey.current && event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      replaceMunicipalityQueryOnNextKey.current = false
      handleMunicipalitySearchChange(event.key)
      return
    }

    if (replaceMunicipalityQueryOnNextKey.current && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault()
      replaceMunicipalityQueryOnNextKey.current = false
      handleMunicipalitySearchChange('')
      return
    }

    if (event.key === 'Escape') {
      setIsMunicipalityMenuOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsMunicipalityMenuOpen(true)
      setActiveMunicipalityIndex((current) => Math.min(current + 1, Math.max(municipalitySuggestions.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsMunicipalityMenuOpen(true)
      setActiveMunicipalityIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter' && isMunicipalityMenuOpen && municipalitySuggestions[activeMunicipalityIndex]) {
      event.preventDefault()
      selectMunicipality(municipalitySuggestions[activeMunicipalityIndex])
    }
  }

  function clearFilters() {
    setRegion('')
    setCorede('')
    setMunicipality('')
    isMunicipalityQueryDraft.current = false
    replaceMunicipalityQueryOnNextKey.current = false
    setIsMunicipalityMenuOpen(false)
    setMunicipalityQuery('')
    const next = new URLSearchParams(params)
    next.set('ano', yearInput)
    next.delete('regiao')
    next.delete('corede')
    next.delete('municipio')
    setParams(next, { replace: false })
  }

  const yearsOptions = years.length ? years : (yearInput ? [Number(yearInput)] : [])
  const activeFilterCount = [region, corede, municipality].filter(Boolean).length

  return (
    <form
      className={compact ? 'global-filters global-filters--compact' : 'global-filters'}
      onSubmit={(event) => event.preventDefault()}
      aria-label="Filtros globais"
    >
      <div className="global-filters__heading">
        <span><SlidersHorizontal size={15} aria-hidden="true" /> Filtros de análise</span>
        <small>{compact ? 'Escolha uma Região Funcional para abrir o ranking.' : 'Selecione ano, Região Funcional, Corede ou município.'}</small>
        {!compact ? (
          <strong className="global-filters__selection" aria-live="polite">
            {activeFilterCount === 0 ? 'Sem recorte territorial' : `${activeFilterCount} ${activeFilterCount === 1 ? 'filtro ativo' : 'filtros ativos'}`}
          </strong>
        ) : null}
      </div>
      <div className="filter-field filter-field--year">
        <label htmlFor="filter-year">Ano</label>
        <div className="filter-select">
          <select
            id="filter-year"
            value={yearInput}
            onChange={(event) => handleYearChange(event.target.value)}
          >
            {yearsOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={17} aria-hidden="true" />
        </div>
      </div>
      <div className="filter-field filter-field--region">
        <label htmlFor="filter-region">Região Funcional</label>
        <div className="filter-select">
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
          <ChevronDown size={17} aria-hidden="true" />
        </div>
      </div>
      {!compact ? (
        <>
          <div className="filter-field">
            <label htmlFor="filter-corede">Corede</label>
            <div className="filter-select">
              <select
                id="filter-corede"
                value={corede}
                onChange={(event) => handleCoredeChange(event.target.value)}
              >
                <option value="">Todos os Coredes</option>
                {coredes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <ChevronDown size={17} aria-hidden="true" />
            </div>
          </div>
          <div className="filter-field filter-field--municipality" ref={municipalityFieldRef}>
            <label htmlFor="filter-municipality">Município</label>
            <div className="filter-combobox">
              <input
                id="filter-municipality"
                className="filter-combobox__input"
                value={municipalityQuery}
                onChange={(event) => handleMunicipalitySearchChange(event.target.value)}
                onFocus={handleMunicipalitySearchFocus}
                onBlur={handleMunicipalitySearchBlur}
                onKeyDown={handleMunicipalitySearchKeyDown}
                onMouseDown={() => {
                  setIsMunicipalityMenuOpen(true)
                  setActiveMunicipalityIndex(0)
                }}
                placeholder="Digite para buscar um município"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isMunicipalityMenuOpen}
                aria-controls="filter-municipality-options"
                aria-activedescendant={isMunicipalityMenuOpen && municipalitySuggestions[activeMunicipalityIndex]
                  ? `filter-municipality-option-${municipalitySuggestions[activeMunicipalityIndex].id}`
                  : undefined}
              />
              <Search className="filter-combobox__icon" size={17} aria-hidden="true" />
              {isMunicipalityMenuOpen ? (
                <div className="filter-combobox__menu" id="filter-municipality-options" role="listbox">
                  {municipalitySuggestions.length ? municipalitySuggestions.map((item, index) => (
                    <button
                      key={item.id}
                      id={`filter-municipality-option-${item.id}`}
                      className={`${index === activeMunicipalityIndex ? 'filter-combobox__option is-active' : 'filter-combobox__option'}${municipality === item.id ? ' is-selected' : ''}`}
                      type="button"
                      role="option"
                      aria-selected={municipality === item.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveMunicipalityIndex(index)}
                      onClick={() => selectMunicipality(item)}
                    >
                      <span>{item.name}</span>
                      <small>{`Corede ${item.coredeName}`}</small>
                      {municipality === item.id ? <Check className="filter-combobox__check" size={16} aria-hidden="true" /> : null}
                    </button>
                  )) : (
                    <span className="filter-combobox__empty">Nenhum município encontrado</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <button className="clear-filters" type="button" onClick={clearFilters} disabled={activeFilterCount === 0}>
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
