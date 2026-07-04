import { ArrowRight, BarChart3, Building2, Compass, ListChecks, Map, RefreshCw, Search, SlidersHorizontal, TrendingUp } from 'lucide-react'
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
          <h1 id="home-title">Compare territórios, rankings e trajetórias municipais</h1>
          <p>Use o Radar para partir de uma Região Funcional ou de um município específico e acompanhar posição, evolução histórica e desempenho por dimensão.</p>
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
              <div><strong>Escolha a entrada</strong><p>Comece pelo ranking regional ou selecione diretamente um município.</p></div>
            </li>
            <li>
              <span><SlidersHorizontal size={19} aria-hidden="true" /></span>
              <div><strong>Ajuste os filtros</strong><p>Defina ano, Região Funcional, Corede e município para refinar a leitura.</p></div>
            </li>
            <li>
              <span><BarChart3 size={19} aria-hidden="true" /></span>
              <div><strong>Leia posição e evolução</strong><p>Compare o ranking atual com anos anteriores e abra as dimensões do Radar.</p></div>
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

      <section className="home-use-panel" aria-labelledby="home-use-title">
        <div className="home-use-panel__heading">
          <h2 id="home-use-title">Duas entradas para a análise</h2>
          <p>Comece pelo território ou vá direto ao município mantendo o mesmo recorte de ano e região.</p>
        </div>
        <div className="home-use-panel__body">
          <article className="home-route">
            <span><Map size={22} aria-hidden="true" /></span>
            <div>
              <h3>Comparar uma Região Funcional</h3>
              <p>Abra uma RF para ver todos os municípios ranqueados, filtrar por Corede e identificar rapidamente os melhores e piores desempenhos.</p>
            </div>
          </article>
          <article className="home-route">
            <span><Search size={22} aria-hidden="true" /></span>
            <div>
              <h3>Analisar um município específico</h3>
              <p>Selecione o município nos filtros para abrir posição geral, dimensões, histórico, população, PIB e área no mesmo contexto.</p>
            </div>
          </article>
          <aside className="home-filter-note">
            <ListChecks size={22} aria-hidden="true" />
            <div>
              <strong>Os filtros são o eixo da navegação.</strong>
              <p>Ano, Região Funcional, Corede e município permanecem sincronizados na URL para facilitar comparação e compartilhamento.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="home-section home-section--explain">
        <div className="home-section__heading">
          <h2>Base de leitura</h2>
        </div>
        <div className="objective-grid objective-grid--compact">
          <article className="objective-card">
            <span><BarChart3 size={27} aria-hidden="true" /></span>
            <div><h3>Comparação regional</h3><p>Os rankings comparam municípios dentro da mesma Região Funcional.</p></div>
          </article>
          <article className="objective-card">
            <span><TrendingUp size={27} aria-hidden="true" /></span>
            <div><h3>Evolução e dimensões</h3><p>Cada município reúne posição geral, histórico e desempenho por dimensão.</p></div>
          </article>
        </div>
      </section>
    </div>
  )
}
