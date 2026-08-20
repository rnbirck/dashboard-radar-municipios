import {
  ArrowRight,
  Building2,
  ListChecks,
  Mail,
  Map,
  MapPin,
  Network,
  Phone,
  RefreshCw,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import brdeLogo from '../../assets/brde-trim-hq.png'
import ceiUnisinosLogo from '../../assets/cei-unisinos-wordmark-white.png'
import observAzulLogo from '../../assets/observ-azul-trim.png'
import { formatInteger, missingValue } from '../../data/formatters'
import { clearManifestCache, DataFetchError, loadManifest } from '../../data/repository'
import type { DashboardManifest } from '../../types/domain'

type LoadStatus = 'loading' | 'ready' | 'error'

const insightCards = [
  {
    title: 'Comparação regional',
    description: 'Rankings por Região Funcional e Corede.',
    badges: ['RF/Corede', 'posição municipal'],
    icon: Trophy,
  },
  {
    title: 'Dimensões do Radar',
    description: 'Temas organizados para leitura comparável.',
    badges: ['6 dimensões', 'leitura comparável'],
    icon: SlidersHorizontal,
  },
  {
    title: 'Indicadores em destaque',
    description: 'Indicadores selecionados em cada dimensão.',
    badges: ['nota + ranking', 'mediana regional'],
    icon: ListChecks,
  },
  {
    title: 'Evolução histórica',
    description: 'Série anual de posições e desempenho.',
    badges: ['série anual', 'variação no ranking'],
    icon: TrendingUp,
  },
]

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
        icon: Building2,
      },
      {
        value: t ? formatInteger(t.regions) : missingValue(),
        label: 'Regiões Funcionais',
        icon: Map,
      },
      {
        value: t ? formatInteger(t.coredes) : missingValue(),
        label: 'Coredes',
        icon: Network,
      },
    ]
  }, [manifest])

  return (
    <div className="home-page">
      <section className="home-workbench" aria-labelledby="home-title">
        <div className="home-workbench__intro">
          <div className="home-workbench__copy">
            <h1 id="home-title">Radar Municipal do Rio Grande do Sul</h1>
            <p className="home-workbench__tagline">
              Compare territórios, rankings e trajetórias municipais para apoiar gestão pública baseada em evidências.
            </p>
            <div className="home-workbench__actions" aria-label="Acessos principais">
              <Link className="home-action-button home-action-button--primary" to="/ranking-regional">
                <Trophy size={18} aria-hidden="true" />
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
              {summaryItems.map((item) => {
                const Icon = item.icon
                return (
                <span key={item.label}>
                  <Icon size={23} aria-hidden="true" />
                  <span>
                    <strong>{item.value}</strong>
                    <small>{item.label}</small>
                  </span>
                </span>
                )
              })}
            </div>
          </div>

          <aside className="home-workbench__institution" aria-label="Núcleo CEI Unisinos">
            <div className="home-partners-stack">
              <div className="home-partners-group">
                <span className="home-partners-group__label">Realização</span>
                <img className="home-brand-logo home-brand-logo--cei" src={ceiUnisinosLogo} alt="CEI - Competitividade, Economia Regional e Internacional | Unisinos" />
                <img className="home-brand-logo home-brand-logo--observ" src={observAzulLogo} alt="OBSERV - Observatório de Gestão e Negócios da Unisinos" />
              </div>
              <div className="home-partners-support">
                <span className="home-partners-support__label">Apoio</span>
                <img className="home-brand-logo home-brand-logo--brde" src={brdeLogo} alt="BRDE" />
              </div>
            </div>
          </aside>
        </div>

        <aside id="como-navegar" className="home-guide home-section-panel" aria-labelledby="home-guide-title">
          <div className="home-section-panel__heading">
            <span><SlidersHorizontal size={16} aria-hidden="true" /></span>
            <h2 id="home-guide-title">Como navegar</h2>
          </div>
          <ol>
            <li>
              <span><Trophy size={19} aria-hidden="true" /></span>
              <div><strong>Visão regional</strong><p>Abra uma RF e leia o ranking dos municípios para entender o contexto territorial.</p></div>
            </li>
            <li>
              <span><SlidersHorizontal size={19} aria-hidden="true" /></span>
              <div><strong>Filtros de análise</strong><p>Refine por ano, Região Funcional, Corede e município no mesmo recorte.</p></div>
            </li>
            <li>
              <span><TrendingUp size={19} aria-hidden="true" /></span>
              <div><strong>Leitura municipal</strong><p>Acompanhe posição, histórico e dimensões para cada município.</p></div>
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

      <section className="home-insight-panel home-section-panel" aria-labelledby="home-insight-title">
        <div className="home-section-panel__heading">
          <span><ListChecks size={16} aria-hidden="true" /></span>
          <h2 id="home-insight-title">O que o Radar mostra</h2>
        </div>
        <div className="home-insight-grid">
          {insightCards.map(({ title, description, badges, icon: Icon }) => (
            <article className="home-insight-card" key={title}>
              <span><Icon size={21} aria-hidden="true" /></span>
              <div className="home-insight-card__body">
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="home-insight-card__scope" aria-label="Escopo">
                  {badges.map((badge) => <small key={badge}>{badge}</small>)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-contact-panel" aria-labelledby="home-contact-title">
        <h2 id="home-contact-title">Entre em contato:</h2>
        <a href="tel:+555135911122,,3148">
          <span><Phone size={24} aria-hidden="true" /></span>
          55 (51) 3591.1122 - Ramal 3148
        </a>
        <a href="mailto:ne-cei@unisinos.br">
          <span><Mail size={24} aria-hidden="true" /></span>
          ne-cei@unisinos.br
        </a>
        <address>
          <span><MapPin size={24} aria-hidden="true" /></span>
          <span><strong>Portal da Inovação</strong> - Av. Unisinos, 950 - prédio F10, São Leopoldo/RS - 93022-750</span>
        </address>
      </section>
    </div>
  )
}
