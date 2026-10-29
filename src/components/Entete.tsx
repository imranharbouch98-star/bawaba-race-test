import { formaterHeure } from '../domain/classement'
import { LANGUES } from '../i18n/textes'
import { useLangue } from '../i18n/LangueContexte'

interface ProprietesEntete {
  miseAJour: number
  simulation: boolean
  onRafraichir: () => void
  vueSimple: boolean
  onBasculerVueSimple: () => void
  /** Onglet affiché : la piste des objectifs ou la boutique des agents. */
  onglet: Onglet
  onChangerOnglet: (onglet: Onglet) => void
}

export type Onglet = 'doelen' | 'winkel'

export function Entete({
  miseAJour,
  simulation,
  onRafraichir,
  vueSimple,
  onBasculerVueSimple,
  onglet,
  onChangerOnglet,
}: ProprietesEntete) {
  const { langue, textes, changerLangue } = useLangue()

  return (
    <header className="entete">
      <div className="entete__identite">
        <span className="entete__logo" aria-hidden="true">
          <span className="entete__logo-pouls" />
        </span>
        <div>
          <h1 className="entete__titre">Bawaba Race</h1>
          <p className="entete__slogan">{textes.slogan}</p>
        </div>
      </div>

      <nav className="entete__onglets" aria-label={`${textes.ongletDoelen} / ${textes.ongletWinkel}`}>
        {(['doelen', 'winkel'] as const).map((valeur) => (
          <button
            key={valeur}
            type="button"
            className={`bouton entete__onglet${onglet === valeur ? ' est-actif' : ''}`}
            aria-pressed={onglet === valeur}
            onClick={() => onChangerOnglet(valeur)}
          >
            {valeur === 'doelen' ? textes.ongletDoelen : textes.ongletWinkel}
          </button>
        ))}
      </nav>

      <div className="entete__etat">
        <div className="entete__horodatage">
          <span className="entete__etiquette">{textes.derniereMiseAJour}</span>
          <strong className="entete__heure">{formaterHeure(miseAJour)}</strong>
        </div>

        {/* Le libellé de la source est traduit ICI et non dans data/ : les
            fichiers de la couche données sont des copies conformes du dépôt
            2D et ne doivent pas dériver. */}
        <span className={`etiquette-source${simulation ? ' etiquette-source--simulee' : ''}`}>
          <span className="etiquette-source__point" aria-hidden="true" />
          {simulation ? textes.sourceSimulee : textes.sourceReelle}
        </span>

        <button type="button" className="bouton bouton--principal" onClick={onRafraichir}>
          {simulation ? textes.boutonSimulerMiseAJour : textes.boutonRafraichir}
        </button>

        <button
          type="button"
          className={`bouton bouton--langue${vueSimple ? ' est-actif' : ''}`}
          aria-pressed={vueSimple}
          title={textes.infoVueSimple}
          onClick={onBasculerVueSimple}
        >
          {textes.boutonVueSimple}
        </button>

        <div className="entete__langues" role="group" aria-label={textes.choixLangue}>
          {LANGUES.map((valeur) => (
            <button
              key={valeur}
              type="button"
              className={`bouton bouton--langue${langue === valeur ? ' est-actif' : ''}`}
              aria-pressed={langue === valeur}
              onClick={() => changerLangue(valeur)}
            >
              {valeur.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
