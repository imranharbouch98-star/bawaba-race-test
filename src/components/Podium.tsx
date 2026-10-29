import type { CSSProperties } from 'react'
import { formaterScore, type LigneClassement } from '../domain/classement'
import { useTextes } from '../i18n/LangueContexte'

/** Ordre d'affichage : 2ᵉ à gauche, 1ᵉʳ au centre, 3ᵉ à droite. */
const PLACES = [1, 0, 2] as const

/** Hauteur de la marche, indexée par le rang moins un. */
const HAUTEURS = ['98px', '76px', '58px']
const MEDAILLES = ['🥇', '🥈', '🥉']

interface ProprietesPodium {
  lignes: LigneClassement[]
  /** Mode équipes : le score affiché est le % d'objectif atteint. */
  pourcentages?: boolean
  /** Le taux affiché par kart (« 2.1 AP/u ») — prioritaire sur le %. */
  valeurs?: ReadonlyMap<string, string>
}

export function Podium({ lignes, pourcentages = false, valeurs }: ProprietesPodium) {
  const textes = useTextes()
  if (lignes.length === 0) return null

  return (
    <section className="carte podium" aria-label={textes.podium}>
      <h2 className="carte__titre">{textes.podium}</h2>
      <ol className="podium__marches">
        {PLACES.map((index) => {
          const ligne = lignes[index]
          if (!ligne) return null
          return (
            <li
              key={ligne.agent.id}
              className={`podium__marche podium__marche--${ligne.rang}`}
              style={{ '--hauteur-marche': HAUTEURS[index] } as CSSProperties}
            >
              <span className="podium__medaille" aria-hidden="true">
                {MEDAILLES[index]}
              </span>
              <span
                className="podium__pastille"
                style={{ backgroundColor: ligne.agent.couleur }}
                aria-hidden="true"
              >
                {ligne.agent.initiales}
              </span>
              <span className="podium__nom">{ligne.agent.nom}</span>
              <span className="podium__equipe">{ligne.agent.equipe}</span>
              <div className="podium__bloc" style={{ borderColor: ligne.agent.couleur }}>
                <span className="podium__rang">{ligne.rang}</span>
                <span className="podium__score">
                  {valeurs?.get(ligne.agent.id)
                    ?? (pourcentages
                      ? textes.pourcentDoel(String(Math.round(ligne.avancement * 100)))
                      : textes.pts(formaterScore(ligne.score), ligne.score))}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
