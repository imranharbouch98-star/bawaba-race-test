/**
 * Le chroniqueur — fabrique les ÉVÉNEMENTS de course à partir des données
 * réelles, en comparant deux photographies successives du classement.
 *
 * Pourquoi : le réalisateur de caméra (plans spot/podium) et les
 * célébrations sont pilotés par les événements ; le simulateur en générait,
 * le flux réel n'envoie que des pénalités. Sans chroniqueur, la caméra
 * n'avait plus que l'alternance aérien ↔ embarqué-leader (constat user
 * 26/08). Tout se déduit ici, côté client — aucune donnée nouvelle.
 *
 * Module PUR : ni React, ni Three, ni horloge — l'appelant fournit
 * l'horodatage.
 */

import type { LigneClassement } from './classement'

/** Ce qu'on retient d'un instantané pour le comparer au suivant. */
export interface PhotoCourse {
  rangs: Map<string, number>
  tours: Map<string, number>
  scores: Map<string, number>
  /** Production brute par kart (RDV, INGEPL, dossiers) — absente en mode générique. */
  bruts: Map<string, number>
  noms: Map<string, string>
  leaderId: string | null
}

export interface FaitDerive {
  type: 'depassement' | 'objectif' | 'record' | 'boost'
  agentId: string
  nom: string
  /** Places gagnées (dépassement) ou production ajoutée (boost). */
  valeur: number
}

export interface Celebration {
  genre: 'objectif' | 'scorePlus'
  agentId: string
  nom: string
  couleur: string
  /** Production ajoutée (scorePlus). */
  valeur: number
}

/** Saut de score (en % d'objectif) qui vaut un plan boost sans production connue. */
const SEUIL_BOOST_SCORE = 3

export function photographier(
  lignes: readonly LigneClassement[],
  bruts: ReadonlyMap<string, number> = new Map(),
): PhotoCourse {
  return {
    rangs: new Map(lignes.map((l) => [l.agent.id, l.rang])),
    tours: new Map(lignes.map((l) => [l.agent.id, l.tours])),
    scores: new Map(lignes.map((l) => [l.agent.id, l.score])),
    bruts: new Map(bruts),
    noms: new Map(lignes.map((l) => [l.agent.id, l.agent.nom])),
    leaderId: lignes[0]?.agent.id ?? null,
  }
}

/**
 * Les faits de course entre deux photos. L'ordre rend la priorité du
 * réalisateur naturelle : record > objectif > dépassement > boost.
 */
export function comparer(avant: PhotoCourse, apres: PhotoCourse): FaitDerive[] {
  const faits: FaitDerive[] = []
  const nomDe = (id: string) => apres.noms.get(id) ?? id

  // Changement de meneur — le plan podium.
  if (apres.leaderId && avant.leaderId && apres.leaderId !== avant.leaderId && avant.rangs.has(apres.leaderId)) {
    faits.push({ type: 'record', agentId: apres.leaderId, nom: nomDe(apres.leaderId), valeur: 0 })
  }

  for (const [id, tours] of apres.tours) {
    const avantTours = avant.tours.get(id)
    if (avantTours !== undefined && tours > avantTours) {
      faits.push({ type: 'objectif', agentId: id, nom: nomDe(id), valeur: tours })
    }
  }

  for (const [id, rang] of apres.rangs) {
    const avantRang = avant.rangs.get(id)
    if (avantRang !== undefined && rang < avantRang && id !== apres.leaderId) {
      faits.push({ type: 'depassement', agentId: id, nom: nomDe(id), valeur: avantRang - rang })
    }
  }

  for (const [id, score] of apres.scores) {
    const avantScore = avant.scores.get(id)
    if (avantScore === undefined) continue
    const brutAvant = avant.bruts.get(id)
    const brutApres = apres.bruts.get(id)
    const production = brutAvant !== undefined && brutApres !== undefined ? brutApres - brutAvant : 0
    if (production >= 1 || score - avantScore >= SEUIL_BOOST_SCORE) {
      faits.push({ type: 'boost', agentId: id, nom: nomDe(id), valeur: Math.max(0, production) })
    }
  }

  return faits
}

/**
 * Les célébrations plein écran (demande user 26/08) : l'objectif atteint et
 * la production qui grimpe — jamais les appels bruts (sinon confettis en
 * continu), jamais les reculs. Une couleur par kart, fournie par l'appelant.
 */
export function celebrationsDepuisFaits(
  faits: readonly FaitDerive[],
  couleurDe: (agentId: string) => string,
  productionCelebrable: boolean,
): Celebration[] {
  const celebrations: Celebration[] = []
  for (const fait of faits) {
    if (fait.type === 'objectif') {
      celebrations.push({ genre: 'objectif', agentId: fait.agentId, nom: fait.nom, couleur: couleurDe(fait.agentId), valeur: 0 })
    } else if (fait.type === 'boost' && productionCelebrable && fait.valeur >= 1) {
      celebrations.push({ genre: 'scorePlus', agentId: fait.agentId, nom: fait.nom, couleur: couleurDe(fait.agentId), valeur: fait.valeur })
    }
  }
  // L'objectif d'abord : c'est lui la grande fête.
  return celebrations.sort((a, b) => (a.genre === 'objectif' ? -1 : 1) - (b.genre === 'objectif' ? -1 : 1))
}
