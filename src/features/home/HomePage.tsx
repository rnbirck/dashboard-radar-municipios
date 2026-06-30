import { ArrowRight, BarChart3, Building2, CalendarDays, Map, Network, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../../components/ui/MetricCard'
import { formatInteger, missingValue } from '../../data/formatters'
import { clearManifestCache, DataFetchError, loadManifest } from '../../data/repository'
import type { DashboardManifest } from '../../types/domain'


function seriesLabel(manifest: DashboardManifest): string {
  const { start, end } = manifest.yearRange
  if (start === end) return String(start)
  return `${start}\u2013${end}`
}

export function HomePage() {
  const [manifest, setManifest] = useState<DashboardManifest | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadManifest()
      .then((result) => {
        if (!cancelled) {
          setManifest(result)
          setError(false)
        }
      })
      .catch((cause) => {
        if (cancelled) return
        setError(true)
        if (cause instanceof DataFetchError) {
          clearManifestCache()
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const metrics = useMemo(() => {
    const t = manifest?.totals
    return [
      {
        icon: Building2,
        value: t ? formatInteger(t.municipalities) : missingValue(),
        label: 'municípios',
        note: 'do Rio Grande do Sul',
      },
      {
        icon: Map,
        value: t ? formatInteger(t.regions) : missingValue(),
        label: 'regiões funcionais',
        note: 'de planejamento',
      },
      {
        icon: Network,
        value: t ? formatInteger(t.coredes) : missingValue(),
        label: 'Coredes',
        note: 'Conselhos Regionais de Desenvolvimento',
      },
      manifest
        ? {
            icon: CalendarDays,
            value: seriesLabel(manifest),
            label: 'série histórica',
            note: `${manifest.availableYears.length} ano${manifest.availableYears.length > 1 ? 's' : ''} de dados disponíveis`,
            accent: true,
          }
        : {
            icon: CalendarDays,
            value: missingValue(),
            label: 'série histórica',
            note: 'anos de dados disponíveis',
            accent: true,
          },
    ]
  }, [manifest])

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero__copy">
          <h1>Radar dos Municípios do Rio Grande do Sul</h1>
          <p>Explore, compare e acompanhe o desempenho dos municípios gaúchos em saúde, educação, segurança, finanças, meio ambiente e desenvolvimento socioeconômico.</p>
        </div>
        <div className="radar-orbits" aria-hidden="true"><i /><i /><i /><b /></div>
      </section>

      <section className="metric-grid" aria-label="Resumo do painel">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      {error ? (
        <p className="page-note page-note--error" role="alert">Não foi possível carregar os totais do painel. Tente novamente.</p>
      ) : null}

      <section className="home-section">
        <h2>Objetivo do painel</h2>
        <div className="objective-grid">
          <article className="objective-card">
            <span><BarChart3 size={27} aria-hidden="true" /></span>
            <div><h3>Explorar recortes regionais</h3><p>Evidencia desigualdades e potencialidades entre regiões funcionais e Coredes do estado.</p></div>
          </article>
          <article className="objective-card">
            <span><TrendingUp size={27} aria-hidden="true" /></span>
            <div><h3>Acompanhar a evolução</h3><p>Monitora os indicadores municipais ao longo do tempo.</p></div>
          </article>
        </div>
      </section>

      <section className="home-section">
        <h2>Comece a explorar</h2>
        <div className="entry-grid">
          <Link className="entry-card" to="/ranking-regional">
            <span className="entry-card__icon"><Map size={30} aria-hidden="true" /></span>
            <div><h3>Regiões funcionais</h3><p>Compare os recortes regionais e conheça os municípios de cada região.</p></div>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <Link className="entry-card entry-card--accent" to="/municipios">
            <span className="entry-card__icon"><Building2 size={30} aria-hidden="true" /></span>
            <div><h3>Municípios</h3><p>Acompanhe posições, dimensões e a evolução de cada município.</p></div>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  )
}