import { Trophy } from 'lucide-react'
import type { RegionalRankingData } from '../../../types/domain'

type MunicipalityRankingContextProps = {
  ranking: RegionalRankingData
  coredeCount: number
  coredeList: string
  coredeNames: string[]
}

export function MunicipalityRankingContext({ ranking, coredeCount, coredeList, coredeNames }: MunicipalityRankingContextProps) {
  return (
    <section className="context-panel municipality-ranking-context" aria-labelledby="regional-ranking-title">
      <div className="context-panel__identity">
        <span className="context-badge"><Trophy size={13} aria-hidden="true" /> {'Ranking dos munic\u00edpios'}</span>
        <h1 id="regional-ranking-title" className="context-panel__title">{`Ranking dos munic\u00edpios \u2014 ${ranking.regionName}`}</h1>
        <p className="context-panel__copy">{'Ranking calculado no universo da Regi\u00e3o Funcional.'}</p>
        {coredeList ? (
          <div className="regional-ranking-coredes municipality-ranking-coredes" title={coredeList} aria-label={`Coredes: ${coredeList}`}>
            <span className="regional-ranking-coredes__label">{'Coredes inclu\u00eddos:'}</span>
            <span className="regional-ranking-coredes__list">
              {coredeNames.map((name) => <span className="regional-ranking-corede-pill" key={name}>{name}</span>)}
            </span>
          </div>
        ) : null}
      </div>
      <div className="context-panel__summary" aria-label="Resumo do ranking regional">
        <span className="context-panel__metric context-panel__metric--regions context-panel__secondary-metric"><span>{'Regi\u00e3o funcional'}</span><strong>{ranking.regionName}</strong></span>
        <span className="context-panel__metric context-panel__metric--municipalities context-panel__primary-metric"><span>{'Munic\u00edpios ranqueados'}</span><strong>{ranking.municipalityCount}</strong></span>
        <span className="context-panel__metric context-panel__metric--coredes"><span>Coredes</span><strong>{coredeCount}</strong></span>
        <span className="context-panel__metric context-panel__metric--year"><span>{'Ano de refer\u00eancia'}</span><strong>{ranking.year}</strong></span>
      </div>
    </section>
  )
}
