import { BriefcaseBusiness, CircleGauge, GraduationCap, HeartPulse, Landmark, Leaf, ShieldCheck } from 'lucide-react'
import type { DimensionId, MunicipalityDimensionData, MunicipalitySummaryData } from '../../../types/domain'
import { formatPosition, formatRankVariation, rankTone, variationTone } from './municipalityUi'

const DIMENSION_ICONS = {
  educacao: GraduationCap,
  financas: Landmark,
  meio_ambiente: Leaf,
  saude: HeartPulse,
  seguranca: ShieldCheck,
  socioeconomico: BriefcaseBusiness,
}

type YearSummary = MunicipalitySummaryData['yearlySummaries'][number]

type DimensionSelectorProps = {
  dimensions: MunicipalityDimensionData[]
  latest: YearSummary
  previous?: YearSummary
  selectedDimension: 'geral' | DimensionId
  onSelectDimension: (dimension: 'geral' | DimensionId) => void
}

export function DimensionSelector({ dimensions, latest, previous, selectedDimension, onSelectDimension }: DimensionSelectorProps) {
  return (
    <section className="dimension-selector-panel">
      <div className="dimension-selector-panel__header">
        <span>{'Selecione a dimens\u00e3o'}</span>
        <small>{'Posi\u00e7\u00e3o atual, hist\u00f3rico e varia\u00e7\u00e3o por dimens\u00e3o.'}</small>
      </div>
      <nav className="dimension-selector" aria-label="Selecionar visão ou dimensão">
        <button
          type="button"
          aria-pressed={selectedDimension === 'geral'}
          className={`dimension-selector-card dimension-selector-card--general${selectedDimension === 'geral' ? ' is-selected' : ''}`}
          onClick={() => onSelectDimension('geral')}
        >
          <span className="dimension-selector-card__icon"><CircleGauge size={17} aria-hidden="true" /></span>
          <span className="dimension-selector-card__body">
            <b>Geral</b>
            <strong className={`position-text position-text--${rankTone(latest.overallRank, latest.totalMunicipalitiesInRegion)}`}>
              {formatPosition(latest.overallRank)}
            </strong>
            <span className="dimension-selector-card__meta">
              <small>{`${previous?.year ?? 'Ano anterior'}: ${formatPosition(previous?.overallRank)}`}</small>
              <span aria-hidden="true">{'\u00b7'}</span>
              <em className={`variation-chip variation-chip--${variationTone(latest.overallRank, previous?.overallRank)}`}>
                {formatRankVariation(latest.overallRank, previous?.overallRank)}
              </em>
            </span>
          </span>
        </button>
        {dimensions.map((dimension) => {
          const current = dimension.dimensionHistory.find((item) => item.year === latest.year)
          const prior = dimension.dimensionHistory.find((item) => item.year === latest.year - 1)
          const Icon = DIMENSION_ICONS[dimension.dimensionId]

          return (
            <button
              type="button"
              key={dimension.dimensionId}
              aria-pressed={selectedDimension === dimension.dimensionId}
              className={`dimension-selector-card${selectedDimension === dimension.dimensionId ? ' is-selected' : ''}`}
              onClick={() => onSelectDimension(dimension.dimensionId)}
            >
              <span className="dimension-selector-card__icon"><Icon size={17} aria-hidden="true" /></span>
              <span className="dimension-selector-card__body">
                <b>{dimension.dimensionName}</b>
                <strong className={`position-text position-text--${rankTone(current?.rank, current?.totalMunicipalitiesInRegion ?? 0)}`}>
                  {formatPosition(current?.rank)}
                </strong>
                <span className="dimension-selector-card__meta">
                  <small>{`${prior?.year ?? 'Ano anterior'}: ${formatPosition(prior?.rank)}`}</small>
                  <span aria-hidden="true">{'\u00b7'}</span>
                  <em className={`variation-chip variation-chip--${variationTone(current?.rank, prior?.rank)}`}>
                    {formatRankVariation(current?.rank, prior?.rank)}
                  </em>
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </section>
  )
}
