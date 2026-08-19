import { Layers3, ListChecks } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { DimensionId, MunicipalityDimensionData } from '../../../types/domain'

export type StickySelectorMode = 'none' | 'dimension' | 'indicator'

type IndicatorOption = {
  id: string
  label: string
}

type Props = {
  mode: StickySelectorMode
  dimensions: MunicipalityDimensionData[]
  selectedDimension: 'geral' | DimensionId
  onSelectDimension: (dimension: 'geral' | DimensionId) => void
  indicators: IndicatorOption[]
  selectedIndicatorId: string
  onSelectIndicator: (indicatorId: string) => void
}

export function MunicipalityStickySelector({ mode, dimensions, selectedDimension, onSelectDimension, indicators, selectedIndicatorId, onSelectIndicator }: Props) {
  const optionsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const options = optionsRef.current
    const selected = options?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
    if (!options || !selected) return

    const selectedLeft = selected.offsetLeft
    const selectedRight = selectedLeft + selected.offsetWidth
    if (selectedLeft < options.scrollLeft) options.scrollLeft = Math.max(0, selectedLeft - 6)
    if (selectedRight > options.scrollLeft + options.clientWidth) options.scrollLeft = selectedRight - options.clientWidth + 6
  }, [mode, selectedDimension, selectedIndicatorId])

  if (mode === 'none') return null

  const isDimensionMode = mode === 'dimension'
  const Icon = isDimensionMode ? Layers3 : ListChecks
  const label = isDimensionMode ? 'Dimensão' : 'Indicador'

  return (
    <aside className={`municipality-sticky-selector municipality-sticky-selector--${mode}`} aria-label={`Seleção rápida de ${label.toLocaleLowerCase('pt-BR')}`}>
      <div className="municipality-sticky-selector__label">
        <Icon size={17} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <nav ref={optionsRef} className="municipality-sticky-selector__options" aria-label={`Selecionar ${label.toLocaleLowerCase('pt-BR')}`}>
        {isDimensionMode ? (
          <>
            <button type="button" aria-pressed={selectedDimension === 'geral'} onClick={() => onSelectDimension('geral')}>Geral</button>
            {dimensions.map((dimension) => (
              <button
                type="button"
                key={dimension.dimensionId}
                aria-pressed={selectedDimension === dimension.dimensionId}
                onClick={() => onSelectDimension(dimension.dimensionId)}
              >
                {dimension.dimensionName}
              </button>
            ))}
          </>
        ) : indicators.map((indicator) => (
          <button
            type="button"
            key={indicator.id}
            aria-pressed={selectedIndicatorId === indicator.id}
            onClick={() => onSelectIndicator(indicator.id)}
          >
            {indicator.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
