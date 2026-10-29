import { PERIODES, type Periode } from '../domain/types'
import { useTextes } from '../i18n/LangueContexte'

interface ProprietesSelecteur {
  periode: Periode
  onChanger: (periode: Periode) => void
}

export function SelecteurPeriode({ periode, onChanger }: ProprietesSelecteur) {
  const textes = useTextes()

  return (
    <div className="selecteur-periode" role="tablist" aria-label={textes.ariaSelecteurPeriode}>
      {PERIODES.map((valeur) => (
        <button
          key={valeur}
          type="button"
          role="tab"
          aria-selected={valeur === periode}
          className={`selecteur-periode__onglet${valeur === periode ? ' est-actif' : ''}`}
          onClick={() => onChanger(valeur)}
        >
          {textes.periodes[valeur]}
        </button>
      ))}
    </div>
  )
}
