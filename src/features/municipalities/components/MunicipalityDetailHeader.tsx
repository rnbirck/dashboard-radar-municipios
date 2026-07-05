import { Building2, CircleDollarSign, CircleGauge, Map as MapIcon, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MunicipalitySummaryData, PopulationPerformanceCode } from '../../../types/domain'
import { formatPosition, formatRankVariation, variationTone } from './municipalityUi'

const INTEGER_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const DECIMAL_FORMAT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const MISSING_VALUE = '\u2014'

type YearSummary = MunicipalitySummaryData['yearlySummaries'][number]

type MunicipalityDetailHeaderProps = {
  summary: MunicipalitySummaryData
  latest: YearSummary
  previous?: YearSummary
}

export function MunicipalityDetailHeader({ summary, latest, previous }: MunicipalityDetailHeaderProps) {
  const profileMetrics = resolveMunicipalProfile(summary, latest.year)

  return (
    <section className="municipality-detail-header" aria-labelledby="municipality-detail-title">
      <div className="municipality-detail-header__identity">
        <span className="entity-badge"><Building2 size={13} /> {'Munic\u00edpio selecionado'}</span>
        <div className="municipality-title-row">
          <div className="municipality-title-copy">
            <h1 id="municipality-detail-title">{summary.municipality.name}</h1>
            <div className="municipality-context-row" aria-label="Contexto territorial">
              <span>{summary.municipality.regionName}</span>
              <span>{`Corede ${summary.municipality.coredeName}`}</span>
              <span>{`Ano de refer\u00eancia ${latest.year}`}</span>
              <span>{`Universo comparativo: ${latest.totalMunicipalitiesInRegion} munic\u00edpios`}</span>
            </div>
            <p>{'Posi\u00e7\u00f5es, hist\u00f3rico e dimens\u00f5es mant\u00eam a compara\u00e7\u00e3o dentro da Regi\u00e3o Funcional.'}</p>
          </div>
          <article className="municipality-rank-panel" aria-label="Posição geral no ranking da Região Funcional">
            <span>{'Posi\u00e7\u00e3o geral na RF'}</span>
            <strong>{formatPosition(latest.overallRank)}</strong>
            <div className="municipality-rank-variation">
              <small>{`${previous?.year ?? 'Ano anterior'}: ${formatPosition(previous?.overallRank)}`}</small>
              <span aria-hidden="true">{'\u00b7'}</span>
              <em className={`variation-chip variation-chip--${variationTone(latest.overallRank, previous?.overallRank)}`}>
                {formatRankVariation(latest.overallRank, previous?.overallRank)}
              </em>
            </div>
          </article>
        </div>
      </div>
      <div className="municipality-reading-panel">
        <article className="municipality-profile-panel">
          <span>{'Contexto municipal'}</span>
          <div className="municipality-profile-metrics" aria-label="Contexto municipal">
            <MunicipalityProfileMetric icon={Users} label={`Popula\u00e7\u00e3o estimada (${profileMetrics.population?.year ?? latest.year})`} value={formatIntegerMetric(profileMetrics.population?.value)} />
            <MunicipalityProfileMetric icon={CircleDollarSign} label={`PIB (${profileMetrics.gdp?.year ?? latest.year})`} value={formatGdpMetric(profileMetrics.gdp?.valueBrl)} />
            <MunicipalityProfileMetric icon={MapIcon} label={'\u00c1rea'} value={formatAreaMetric(profileMetrics.areaKm2)} />
            <MunicipalityProfileMetric
              icon={CircleGauge}
              label="Desempenho por porte populacional"
              value={latest.classification.label}
              tone={latest.classification.code}
            />
          </div>
        </article>
      </div>
    </section>
  )
}

function resolveMunicipalProfile(summary: MunicipalitySummaryData, year: number) {
  const profile = summary.municipalProfile
  const population = pickYearMetric(profile?.populationEstimates, year)
  const gdp = pickYearMetric(profile?.gdpValues, year)
  return { population, gdp, areaKm2: profile?.areaKm2 ?? null }
}

function pickYearMetric<T extends { year: number }>(items: T[] | undefined, year: number): T | undefined {
  if (!items?.length) return undefined
  return items.find((item) => item.year === year) ?? [...items].sort((a, b) => b.year - a.year)[0]
}

function formatIntegerMetric(value: number | null | undefined): string {
  return value === null || value === undefined ? MISSING_VALUE : INTEGER_FORMAT.format(value)
}

function formatGdpMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return MISSING_VALUE
  if (Math.abs(value) >= 1_000_000_000) return `R$ ${DECIMAL_FORMAT.format(value / 1_000_000_000)} bi`
  if (Math.abs(value) >= 1_000_000) return `R$ ${DECIMAL_FORMAT.format(value / 1_000_000)} mi`
  return `R$ ${INTEGER_FORMAT.format(value)}`
}

function formatAreaMetric(value: number | null | undefined): string {
  return value === null || value === undefined ? MISSING_VALUE : `${DECIMAL_FORMAT.format(value)} km\u00b2`
}

function MunicipalityProfileMetric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: PopulationPerformanceCode }) {
  const toneClass = tone ? ` municipality-profile-metric--${tone}` : ''
  return <span className={`municipality-profile-metric${toneClass}`}><Icon size={15} aria-hidden={true} /><span><small>{label}</small><strong>{value}</strong></span></span>
}
