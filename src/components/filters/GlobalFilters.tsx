import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAvailableYears, getMunicipalities, getRegions } from '../../data/repository'

type GlobalFiltersProps = { compact?: boolean }

export function GlobalFilters({ compact = false }: GlobalFiltersProps) {
  const [year, setYear] = useState('2025')
  const [region, setRegion] = useState('')
  const [corede, setCorede] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [years, setYears] = useState<number[]>([])
  const [regions, setRegions] = useState<Awaited<ReturnType<typeof getRegions>>>([])
  const [municipalities, setMunicipalities] = useState<Awaited<ReturnType<typeof getMunicipalities>>>([])

  useEffect(() => {
    void Promise.all([getAvailableYears(), getRegions(Number(year)), getMunicipalities(Number(year))])
      .then(([nextYears, nextRegions, nextMunicipalities]) => {
        setYears(nextYears)
        setRegions(nextRegions)
        setMunicipalities(nextMunicipalities)
      })
  }, [year])

  function clearFilters() {
    setRegion('')
    setCorede('')
    setMunicipality('')
  }

  return (
    <form className={compact ? 'global-filters global-filters--compact' : 'global-filters'} onSubmit={(event) => event.preventDefault()}>
      <div className="filter-field filter-field--year">
        <label htmlFor="filter-year">Ano</label>
        <select id="filter-year" value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="filter-field filter-field--region">
        <label htmlFor="filter-region">Região funcional</label>
        <select id="filter-region" value={region} onChange={(event) => { setRegion(event.target.value); setCorede(''); setMunicipality('') }}>
          <option value="">Selecione uma região funcional</option>
          {regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {!compact ? (
        <>
          <div className="filter-field">
            <label htmlFor="filter-corede">Corede</label>
            <select id="filter-corede" value={corede} onChange={(event) => { setCorede(event.target.value); setMunicipality('') }}>
              <option value="">Todos</option>
              <option value="mock" disabled>Disponível com os dados estáticos</option>
            </select>
          </div>
          <div className="filter-field filter-field--municipality">
            <label htmlFor="filter-municipality">Município</label>
            <select id="filter-municipality" value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
              <option value="">Selecione um município</option>
              {municipalities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <button className="clear-filters" type="button" onClick={clearFilters}>
            <RotateCcw size={16} aria-hidden="true" />
            Limpar filtros
          </button>
        </>
      ) : null}
    </form>
  )
}
