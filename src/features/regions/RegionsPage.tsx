import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loadManifest, loadRegions } from '../../data/repository'
import type { RegionsData } from '../../types/domain'
import { RegionsExplorer } from './components/RegionsExplorer'

export function RegionsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
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
        const manifest = await loadManifest()
        if (currentId !== requestId.current) return
        const yearParam = params.get('ano')
        const numericYear = yearParam && Number.isFinite(Number(yearParam)) && manifest.availableYears.includes(Number(yearParam))
          ? Number(yearParam)
          : manifest.defaultYear
        setYear(numericYear)
        if (params.has('regiao') || params.has('corede') || params.has('municipio')) {
          const next = new URLSearchParams(params)
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
  }, [navigate, params])

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
