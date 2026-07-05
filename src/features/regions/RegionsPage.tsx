import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loadManifest, loadRegions } from '../../data/repository'
import type { RegionsData } from '../../types/domain'
import { RegionsExplorer } from './components/RegionsExplorer'

export function RegionsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const searchParams = params.toString()
  const [data, setData] = useState<RegionsData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [year, setYear] = useState<number | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const currentId = ++requestId.current

    setStatus('loading')
    setData(null)

    void (async () => {
      try {
        const currentParams = new URLSearchParams(searchParams)
        const manifest = await loadManifest()
        if (currentId !== requestId.current) return
        const yearParam = currentParams.get('ano')
        const numericYear = yearParam && Number.isFinite(Number(yearParam)) && manifest.availableYears.includes(Number(yearParam))
          ? Number(yearParam)
          : manifest.defaultYear
        setYear(numericYear)
        if (currentParams.has('regiao') || currentParams.has('corede') || currentParams.has('municipio')) {
          const next = new URLSearchParams(currentParams)
          next.set('ano', String(numericYear))
          navigate(`/municipios?${next.toString()}`, { replace: true })
          return
        }
        const result = await loadRegions(numericYear)
        if (currentId !== requestId.current) return
        setData(result)
        setStatus(result.regions.length > 0 ? 'ready' : 'empty')
      } catch {
        if (currentId !== requestId.current) return
        setStatus('error')
      }
    })()
  }, [navigate, searchParams])

  return (
    <div className="page-stack">
      <RegionsExplorer
        data={data}
        status={status}
        year={year}
        title="Selecione uma região funcional"
        description="Escolha uma Região Funcional para consultar a classificação dos municípios e conhecer os Coredes que compõem cada território."
      />
    </div>
  )
}
