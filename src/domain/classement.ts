/**
 * Calcul des scores et du classement — moteur de course, partie « résultats ».
 *
 * Règle fondamentale : la position d'un kart sur la piste dépend
 * **uniquement** du score de performance de l'agent pour la période affichée.
 * Aucune commande de l'interface n'entre dans ce calcul.
 *
 * ---
 * ⚠️ CE FICHIER N'EST PLUS UNE COPIE CONFORME de race-pulse (2D).
 *
 * Il l'a été jusqu'au passage au modèle « en tours » : la 2D borne toujours
 * la progression à 100 % de l'objectif, la 3D ne la borne plus. Un correctif
 * de logique commune (tri, départage, formatage) reste à reporter dans les
 * deux dépôts ; ce qui touche à `avancement` / `tours` est propre à la 3D.
 *
 * Pourquoi ce changement : avec une progression plafonnée, un agent qui
 * atteint son objectif en début d'après-midi voyait son kart se figer sur la
 * ligne d'arrivée jusqu'au lendemain — l'écran mural mourait à la moitié de
 * la journée, exactement l'inverse de l'effet recherché. En tours, le kart
 * ne s'arrête jamais et « deux tours d'avance » se lit tout seul.
 */

import type { Agent, Instantane, Periode } from './types'
import { CIRCUIT } from './circuit3d'

export interface LigneClassement {
  rang: number
  agent: Agent
  score: number
  /** Variation de rythme en %, positive ou négative. */
  tendance: number
  /**
   * Avancement total, exprimé en tours d'objectif. **Non borné** : 2,7
   * signifie deux tours bouclés et 70 % du troisième. C'est cette valeur, et
   * elle seule, qui pilote la position du kart sur la piste.
   */
  avancement: number
  /** Tours complets bouclés. */
  tours: number
  /** Avancement dans le tour en cours, borné entre 0 et 1 — pour les jauges. */
  progression: number
  /** Voie attribuée pour l'affichage — purement visuel. */
  voie: number
  /**
   * Recul de grille de départ, en mètres curvilignes — purement visuel.
   * Les karts à ÉGALITÉ d'avancement se rangent en damier type grille de
   * F1 (colonne = voie, rangée = ce recul) au lieu de se superposer.
   * Toujours ≥ 0 et appliqué vers l'ARRIÈRE : à score égal, personne ne
   * paraît devant personne — le score reste la seule vérité.
   */
  reculGrille: number
  /** Points restants avant de boucler le tour en cours. */
  restant: number
}

/** Deux avancements à moins d'ε tour l'un de l'autre forment un groupe. */
const EPSILON_EGALITE = 0.002
/** Recul entre deux rangées de la grille (≈ 2 longueurs de kart). */
const RECUL_RANGEE = 5
/** Demi-cran des colonnes impaires — le damier d'une vraie grille. */
const DEMI_CRAN = 2.5

/**
 * Pose le recul de grille sur des lignes DÉJÀ triées et dotées de leur voie.
 * Un groupe d'égalité se lit sur des rangs consécutifs (le tri met les
 * ex æquo côte à côte) ; dans un groupe, la place suit le rang — l'ordre est
 * déterministe et stable d'une frame à l'autre.
 */
function poserGrilleDeDepart(
  lignes: Array<Omit<LigneClassement, 'reculGrille'>>,
): LigneClassement[] {
  const resultat: LigneClassement[] = []
  let debutGroupe = 0
  for (let i = 0; i <= lignes.length; i += 1) {
    const nouveauGroupe =
      i === lignes.length ||
      (i > debutGroupe && Math.abs(lignes[i].avancement - lignes[i - 1].avancement) > EPSILON_EGALITE)
    if (!nouveauGroupe) continue
    const taille = i - debutGroupe
    for (let j = debutGroupe; j < i; j += 1) {
      const place = j - debutGroupe
      const rangee = Math.floor(place / CIRCUIT.nombreVoies)
      // Seul un vrai groupe (2 karts ou plus) se met en formation. Le
      // demi-cran suit la PLACE dans le groupe (pas la voie) : le mieux
      // classé d'une rangée n'est jamais celui qui recule.
      const recul = taille > 1 ? rangee * RECUL_RANGEE + (place % 2) * DEMI_CRAN : 0
      resultat.push({ ...lignes[j], reculGrille: recul })
    }
    debutGroupe = i
  }
  return resultat
}

/**
 * Avancement total en tours d'objectif. Non borné, volontairement : c'est ce
 * qui permet au kart de continuer à rouler après avoir atteint son objectif.
 */
export function avancementEnTours(score: number, objectif: number): number {
  if (objectif <= 0) return 0
  return Math.max(0, score / objectif)
}

/**
 * Avancement vers l'objectif, borné entre 0 et 1.
 *
 * Conservé tel quel : le simulateur s'en sert pour ses paliers d'annonce et
 * son facteur de fatigue, où un plafond à 100 % est le comportement voulu.
 */
export function progressionVersObjectif(score: number, objectif: number): number {
  if (objectif <= 0) return 0
  return Math.min(1, Math.max(0, score / objectif))
}

/**
 * Le classement brut d'une période — tri, rangs, voies (alternance selon le
 * rang : deux agents au coude-à-coude tombent sur des voies différentes).
 * La formation en grille des ex æquo se pose ensuite, dans
 * `construireClassement`.
 */
function classementSansGrille(
  instantane: Instantane,
  periode: Periode,
): Array<Omit<LigneClassement, 'reculGrille'>> {
  const parId = new Map(instantane.agents.map((agent) => [agent.id, agent]))
  const objectif = instantane.objectifs[periode]

  return instantane.performances
    .flatMap((performance) => {
      const agent = parId.get(performance.agentId)
      if (!agent) return []
      const score = performance.scores[periode]
      const avancement = avancementEnTours(score, objectif)
      const tours = Math.floor(avancement)
      return [
        {
          agent,
          score,
          tendance: performance.tendances[periode],
          avancement,
          tours,
          progression: avancement - tours,
          // Ce qu'il reste à marquer pour boucler le tour en cours, et non
          // plus pour « finir » — il n'y a plus de fin.
          restant: Math.max(0, Math.round(objectif * (tours + 1) - score)),
        },
      ]
    })
    .sort((a, b) => b.score - a.score || a.agent.nom.localeCompare(b.agent.nom, 'fr'))
    .map((ligne, index) => ({
      ...ligne,
      rang: index + 1,
      voie: index % CIRCUIT.nombreVoies,
    }))
}

/**
 * Classement complet pour une période, formation de grille comprise.
 */
export function construireClassement(
  instantane: Instantane,
  periode: Periode,
): LigneClassement[] {
  return poserGrilleDeDepart(classementSansGrille(instantane, periode))
}

const formateurNombre = new Intl.NumberFormat('fr-FR')

export function formaterScore(score: number): string {
  return formateurNombre.format(Math.round(score))
}

export function formaterTendance(tendance: number): string {
  const arrondi = Math.round(tendance)
  return `${arrondi > 0 ? '+' : ''}${arrondi} %`
}

const formateurHeure = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function formaterHeure(horodatage: number): string {
  return formateurHeure.format(new Date(horodatage))
}

/** Seuil au-delà duquel une tendance est jugée significative. */
const SEUIL_TENDANCE = 3

export type SensTendance = 'hausse' | 'baisse' | 'stable'

export function sensTendance(tendance: number): SensTendance {
  if (tendance > SEUIL_TENDANCE) return 'hausse'
  if (tendance < -SEUIL_TENDANCE) return 'baisse'
  return 'stable'
}
