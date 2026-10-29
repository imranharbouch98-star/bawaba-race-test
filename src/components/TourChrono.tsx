/**
 * Tour de chronométrage — la colonne façon retransmission automobile,
 * superposée à la vue 3D.
 *
 * Rôle : donner l'ordre de course en un coup d'œil, à cinq mètres, sans
 * avoir à lire le panneau latéral. C'est de l'interface DOM et non de la
 * 3D — coût graphique nul, et un texte net à toutes les tailles d'écran.
 *
 * Chaque ligne affiche la PROGRESSION du kart vers SON objectif (en %),
 * jamais l'écart au meneur. Décision produit (Maya, 24/08) : montrer
 * « combien de points de retard » va contre la motivation positive de
 * l'équipe — on célèbre l'avancement de chacun, on ne chiffre pas le
 * retard de personne. Les flèches ▲/▼ signalent les places gagnées ou
 * perdues depuis la dernière mise à jour — un fait de course, pas un écart.
 *
 * Seule la TÊTE DE COURSE est affichée, délibérément. Ne pas figurer au
 * tableau est la situation normale et ne signale donc rien ; un classement
 * complet en permanence sur un mur exposerait les derniers en continu, le
 * principal facteur d'échec documenté de ce type de dispositif. Le
 * classement intégral reste dans le panneau latéral, qui se consulte de près.
 */

import type { LigneClassement } from '../domain/classement'
import type { AgentId } from '../domain/types'
import { useTextes } from '../i18n/LangueContexte'

/** Nombre de positions affichées. Voir l'en-tête avant de l'augmenter. */
const POSITIONS_AFFICHEES = 6

interface ProprietesTourChrono {
  lignes: LigneClassement[]
  variations: ReadonlyMap<AgentId, number>
  /** Mode équipes : le taux affiché par kart (« 2.1 AP/u ») — sinon le %. */
  valeurs?: ReadonlyMap<string, string>
  /** Kart choisi (suivi par la caméra / mis en évidence sur la piste). */
  selection?: string | null
  /** Clic sur une ligne : choisir ce kart (ou le relâcher s'il l'est déjà). */
  onChoisir?: (agentId: string) => void
}

export function TourChrono({ lignes, variations, valeurs, selection = null, onChoisir }: ProprietesTourChrono) {
  const textes = useTextes()
  if (lignes.length === 0) return null

  return (
    <div className="chrono">
      {/* Intitulé discret mais indispensable : sans lui, la colonne de
          droite n'est qu'une suite de nombres dont rien ne dit ce qu'ils
          mesurent. */}
      <p className="chrono__titre">{valeurs ? textes.tempoTitre : textes.versLeDoel}</p>

      <ol className="chrono__liste" aria-label={textes.ariaTeteDeCourse}>
        {lignes.slice(0, POSITIONS_AFFICHEES).map((ligne) => {
          const variation = variations.get(ligne.agent.id) ?? 0
          const meneurDeCourse = ligne.rang === 1

          return (
            <li
              key={ligne.agent.id}
              className={`chrono__ligne${meneurDeCourse ? ' chrono__ligne--meneur' : ''}${
                onChoisir ? ' chrono__ligne--cliquable' : ''
              }${selection === ligne.agent.id ? ' chrono__ligne--suivie' : ''}`}
              onClick={onChoisir ? () => onChoisir(ligne.agent.id) : undefined}
              onKeyDown={
                onChoisir
                  ? (evenement) => {
                      if (evenement.key === 'Enter' || evenement.key === ' ') {
                        evenement.preventDefault()
                        onChoisir(ligne.agent.id)
                      }
                    }
                  : undefined
              }
              role={onChoisir ? 'button' : undefined}
              tabIndex={onChoisir ? 0 : undefined}
              aria-pressed={onChoisir ? selection === ligne.agent.id : undefined}
              title={onChoisir ? textes.suivreKart(ligne.agent.nom) : undefined}
            >
              <span className="chrono__rang">{ligne.rang}</span>
              <span
                className="chrono__couleur"
                style={{ backgroundColor: ligne.agent.couleur }}
                aria-hidden="true"
              />
              <span className="chrono__nom">{ligne.agent.nom}</span>

              {/* `avancement` compte les tours entiers : 240 % = objectif
                  bouclé deux fois, et on l'affiche fièrement tel quel. */}
              <span className="chrono__ecart">
                {valeurs?.get(ligne.agent.id) ?? textes.pourcentDoel(String(Math.round(ligne.avancement * 100)))}
              </span>

              <span
                className={`chrono__variation${
                  variation > 0
                    ? ' chrono__variation--gain'
                    : variation < 0
                      ? ' chrono__variation--perte'
                      : ''
                }`}
                aria-label={
                  variation > 0
                    ? textes.ariaPlacesGagnees(variation)
                    : variation < 0
                      ? textes.ariaPlacesPerdues(-variation)
                      : undefined
                }
              >
                {variation > 0 ? `▲${variation}` : variation < 0 ? `▼${-variation}` : ''}
              </span>
            </li>
            )
          })}
      </ol>
    </div>
  )
}
