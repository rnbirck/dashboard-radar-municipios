import { ArrowRight, BarChart3, Building2, Compass, ListChecks, Map, RefreshCw, SlidersHorizontal, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatInteger, missingValue } from '../../data/formatters'
import { clearManifestCache, DataFetchError, loadManifest } from '../../data/repository'
import type { DashboardManifest } from '../../types/domain'

type LoadStatus = 'loading' | 'ready' | 'error'

export function HomePage() {
  const [manifest, setManifest] = useState<DashboardManifest | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    void loadManifest()
      .then((result) => {
        if (!cancelled) {
          setManifest(result)
          setStatus('ready')
        }
      })
      .catch((cause) => {
        if (cancelled) return
        setManifest(null)
        setStatus('error')
        if (cause instanceof DataFetchError) {
          clearManifestCache()
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadAttempt])

  const isLoading = status === 'loading'
  const retryLoad = () => {
    clearManifestCache()
    setManifest(null)
    setStatus('loading')
    setLoadAttempt((current) => current + 1)
  }

  const summaryItems = useMemo(() => {
    const t = manifest?.totals
    return [
      {
        value: t ? formatInteger(t.municipalities) : missingValue(),
        label: 'municípios',
      },
      {
        value: t ? formatInteger(t.regions) : missingValue(),
        label: 'Regiões Funcionais',
      },
      {
        value: t ? formatInteger(t.coredes) : missingValue(),
        label: 'Coredes',
      },
      manifest
        ? {
            value: String(manifest.defaultYear),
            label: 'ano de referência',
          }
        : {
            value: missingValue(),
            label: 'ano de referência',
          },
    ]
  }, [manifest])

  return (
    <div className="home-page">
      <section className="home-workbench" aria-labelledby="home-title">
        <div className="home-workbench__intro">
          <span className="home-kicker">Radar municipal do RS</span>
          <h1 id="home-title">Compare regiões e municípios com contexto</h1>
          <p>Ranking, histórico e dimensões em um recorte regional consistente.</p>
          <div className="home-workbench__actions" aria-label="Acessos principais">
            <Link className="home-action-button home-action-button--primary" to="/ranking-regional">
              <Map size={18} aria-hidden="true" />
              Comparar por região
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="home-action-button" to="/municipios">
              <Building2 size={18} aria-hidden="true" />
              Analisar município
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="home-workbench__summary" aria-label="Resumo do Radar" aria-busy={isLoading || undefined}>
            {isLoading ? <span className="sr-only">Carregando totais do painel.</span> : null}
            {summaryItems.map((item) => (
              <span key={item.label}>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </span>
            ))}
          </div>
        </div>

        <aside id="como-navegar" className="home-guide" aria-labelledby="home-guide-title">
          <h2 id="home-guide-title">Como navegar</h2>
          <ol>
            <li>
              <span><Compass size={19} aria-hidden="true" /></span>
              <div><strong>Visão regional</strong><p>Abra uma RF e leia o ranking dos municípios.</p></div>
            </li>
            <li>
              <span><SlidersHorizontal size={19} aria-hidden="true" /></span>
              <div><strong>Filtros de análise</strong><p>Refine ano, Corede e município no mesmo recorte.</p></div>
            </li>
            <li>
              <span><BarChart3 size={19} aria-hidden="true" /></span>
              <div><strong>Leitura municipal</strong><p>Acompanhe posição, histórico e dimensões.</p></div>
            </li>
          </ol>
        </aside>
      </section>

      {status === 'error' ? (
        <section className="home-data-alert" role="alert">
          <div>
            <strong>Não foi possível carregar os totais do painel.</strong>
            <span>Os rankings continuam disponíveis; tente buscar os totais novamente.</span>
          </div>
          <button type="button" onClick={retryLoad}>
            <RefreshCw size={15} aria-hidden="true" />
            Tentar novamente
          </button>
        </section>
      ) : null}

      <section className="home-insight-panel" aria-labelledby="home-insight-title">
        <div className="home-insight-panel__heading">
          <h2 id="home-insight-title">O que o Radar mostra</h2>
          <p>Leituras essenciais para comparar territórios.</p>
        </div>
        <div className="home-insight-grid">
          <article className="home-insight-card">
            <span><Map size={21} aria-hidden="true" /></span>
            <div><h3>Visão regional</h3><p>Municípios ranqueados dentro da mesma Região Funcional.</p></div>
          </article>
          <article className="home-insight-card">
            <span><Building2 size={21} aria-hidden="true" /></span>
            <div><h3>Leitura municipal</h3><p>Posição geral, porte, população, PIB e área.</p></div>
          </article>
          <article className="home-insight-card">
            <span><TrendingUp size={21} aria-hidden="true" /></span>
            <div><h3>Histórico e dimensões</h3><p>Evolução anual e desempenho por dimensão.</p></div>
          </article>
          <article className="home-insight-card">
            <span><ListChecks size={21} aria-hidden="true" /></span>
            <div><h3>Filtros sincronizados</h3><p>Ano, RF, Corede e município na URL.</p></div>
          </article>
        </div>
      </section>
    </div>
  )
}
