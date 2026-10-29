import { useState } from 'react'
import {
  formaterScore,
  formaterTendance,
  sensTendance,
  type LigneClassement,
} from '../domain/classement'
import type { EquipeInfo, Periode } from '../domain/types'
import { useTextes } from '../i18n/LangueContexte'

const FLECHES: Record<ReturnType<typeof sensTendance>, string> = {
  hausse: '▲',
  baisse: '▼',
  stable: '▪',
}

interface ProprietesClassement {
  lignes: LigneClassement[]
  periode: Periode
  objectif: number
  /** Mode équipes : les scores sont des % d'objectif, pas des points. */
  pourcentages?: boolean
  /** Détail des équipes (mode équipes) — ouvre le volet au clic sur une ligne. */
  equipes?: EquipeInfo[]
  /** Le taux affiché par kart (« 2.1 AP/u ») — prioritaire sur le %. */
  valeurs?: ReadonlyMap<string, string>
  /** Kart choisi (suivi par la caméra / mis en évidence sur la piste). */
  selection?: string | null
  /** Clic sur une ligne : choisir ce kart (ou le relâcher s'il l'est déjà). */
  onChoisir?: (agentId: string) => void
}

/**
 * En mode équipes, la ligne se déplie en un volet de détail : le taux réel
 * dans l'unité du KPI, l'objectif (et sa provenance), les agents de la
 * période et les « Penalty points » avec leur raison — l'affichage explicite
 * exigé par Maya. Jamais d'écart entre équipes : chaque bloc ne parle que de
 * l'équipe et de SON objectif.
 */
export function Classement({
  lignes,
  periode,
  objectif,
  pourcentages = false,
  equipes,
  valeurs,
  selection = null,
  onChoisir,
}: ProprietesClassement) {
  const textes = useTextes()
  const [detailId, setDetailId] = useState<string | null>(null)

  const equipeDe = (ligne: LigneClassement): EquipeInfo | undefined =>
    equipes?.find((e) => e.id === ligne.agent.id || e.nom === ligne.agent.equipe)

  return (
    <section className="carte classement" aria-label={textes.ariaClassement(textes.periodes[periode])}>
      <div className="carte__entete">
        <h2 className="carte__titre">{textes.classement}</h2>
        <span className="carte__note">
          {pourcentages ? textes.chacunSonDoel : textes.noteObjectif(formaterScore(objectif))}
        </span>
      </div>

      <ol className="classement__liste">
        {lignes.map((ligne) => {
          const sens = sensTendance(ligne.tendance)
          const equipe = equipeDe(ligne)
          const deplie = equipe !== undefined && detailId === ligne.agent.id
          const mesure = equipe?.periodes[periode]
          const cliquable = equipe !== undefined || onChoisir !== undefined
          const suivie = selection === ligne.agent.id
          // Un clic choisit le kart (caméra / mise en évidence) ET, en mode
          // équipes, déplie le volet de détail comme avant.
          const cliquer = () => {
            onChoisir?.(ligne.agent.id)
            if (equipe) setDetailId((actuel) => (actuel === ligne.agent.id ? null : ligne.agent.id))
          }

          return (
            <li key={ligne.agent.id} className="classement__ligne-bloc">
              <div
                className={`classement__ligne${cliquable ? ' classement__ligne--cliquable' : ''}${suivie ? ' classement__ligne--suivie' : ''}`}
                onClick={cliquable ? cliquer : undefined}
                onKeyDown={
                  cliquable
                    ? (evenement) => {
                        if (evenement.key === 'Enter' || evenement.key === ' ') {
                          evenement.preventDefault()
                          cliquer()
                        }
                      }
                    : undefined
                }
                role={cliquable ? 'button' : undefined}
                tabIndex={cliquable ? 0 : undefined}
                aria-pressed={onChoisir ? suivie : undefined}
                aria-expanded={equipe ? deplie : undefined}
                aria-label={
                  equipe
                    ? (deplie ? textes.masquerDetail : textes.voirDetail)
                    : onChoisir
                      ? textes.suivreKart(ligne.agent.nom)
                      : undefined
                }
              >
                <span className="classement__rang">{ligne.rang}</span>

                <span
                  className="classement__pastille"
                  style={{ backgroundColor: ligne.agent.couleur }}
                  aria-hidden="true"
                >
                  {ligne.agent.initiales}
                </span>

                <span className="classement__identite">
                  <span className="classement__nom">{ligne.agent.nom}</span>
                  <span className="classement__equipe">
                    {pourcentages ? '' : ligne.agent.equipe}
                    {/* « voltooid »/« completed » et non « ronde 1 » : sans le
                        participe, on ne sait pas si l'agent EST au tour 1 ou
                        s'il l'a TERMINÉ — d'autant que la jauge repart à zéro
                        juste après. En mode équipes, un tour bouclé = un
                        objectif atteint : on le dit dans ces mots-là. */}
                    {ligne.tours > 0 && (
                      <span className="classement__tours">
                        {pourcentages ? '' : ' · '}
                        {pourcentages ? textes.doelBereikt(ligne.tours) : textes.toursBoucles(ligne.tours)}
                      </span>
                    )}
                  </span>
                </span>

                <span className="classement__chiffres">
                  <span className="classement__score">
                    {valeurs?.get(ligne.agent.id)
                      ?? (pourcentages
                        ? textes.pourcentDoel(String(Math.round(ligne.avancement * 100)))
                        : formaterScore(ligne.score))}
                  </span>
                  {/* En mode équipes l'API ne fournit pas de tendance : on
                      n'affiche pas une flèche qui dirait toujours « stable ». */}
                  {!pourcentages && (
                    <span className={`classement__tendance classement__tendance--${sens}`}>
                      <span aria-hidden="true">{FLECHES[sens]}</span> {formaterTendance(ligne.tendance)}
                    </span>
                  )}
                </span>

                <span
                  className="classement__jauge"
                  role="progressbar"
                  aria-valuenow={Math.round(ligne.progression * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={textes.ariaAvancement(ligne.agent.nom)}
                >
                  <span
                    className="classement__jauge-remplissage"
                    style={{
                      width: `${ligne.progression * 100}%`,
                      backgroundColor: ligne.agent.couleur,
                    }}
                  />
                </span>
              </div>

              {deplie && equipe && mesure && (
                <div className="classement__detail">
                  <p className="classement__detail-kpi">
                    <strong>
                      {formaterScore(mesure.taux)} {(equipe.goalUnit === 'per_day' ? textes.unitesKpiJour : textes.unitesKpi)[equipe.kpi]}
                    </strong>
                    {equipe.objectif !== null && (
                      <span className="classement__detail-doel">
                        {textes.doelLabel(formaterScore(equipe.objectif), (equipe.goalUnit === 'per_day' ? textes.unitesKpiJour : textes.unitesKpi)[equipe.kpi])}
                        {equipe.objectifSource === 'moyenne30' && ` · ${textes.doelMoyenne30}`}
                      </span>
                    )}
                  </p>
                  <p className="classement__detail-mesures">
                    {mesure.heures > 0 && (
                      <span>
                        {textes.heuresLabel}: {formaterScore(mesure.heures)}
                      </span>
                    )}
                    {mesure.traitementSec > 0 && (
                      <span>
                        {textes.traitementMoyen}: {Math.round(mesure.traitementSec)} s
                      </span>
                    )}
                  </p>

                  <p className="classement__detail-titre">{textes.agentsTitre}</p>
                  {mesure.agents.length === 0 ? (
                    <p className="classement__detail-vide">{textes.aucunAgent}</p>
                  ) : (
                    <ul className="classement__detail-agents">
                      {mesure.agents.map((agent) => (
                        <li key={agent.id}>
                          <span>{agent.nom}</span>
                          <span>
                            {formaterScore(agent.taux)} {(equipe.goalUnit === 'per_day' ? textes.unitesKpiJour : textes.unitesKpi)[equipe.kpi]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {equipe.penalites.length > 0 && (
                    <>
                      <p className="classement__detail-titre">{textes.penalitesTitre}</p>
                      <ul className="classement__detail-penalites">
                        {equipe.penalites.map((penalite, index) => (
                          <li key={`${penalite.date}-${index}`}>
                            <strong>{textes.penaltyPoint(penalite.delta)}</strong>
                            <span>
                              {penalite.raison} · {penalite.date}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
