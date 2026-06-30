import { ArrowRight, BarChart3, Building2, CalendarDays, Map, Network, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../../components/ui/MetricCard'

const metrics = [
  { icon: Building2, value: '497', label: 'municípios', note: 'do Rio Grande do Sul' },
  { icon: Map, value: '9', label: 'regiões funcionais', note: 'de planejamento' },
  { icon: Network, value: '28', label: 'Coredes', note: 'Conselhos Regionais de Desenvolvimento' },
  { icon: CalendarDays, value: '2021–2025', label: 'série histórica', note: '5 anos de dados disponíveis', accent: true },
]

export function HomePage() {
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
