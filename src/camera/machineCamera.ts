/**
 * Machine du réalisateur de caméra — logique pure, sans React ni Three.js
 * (même discipline que `domain/` et `scene/lissageProgression.ts`), pour
 * rester testable en isolation.
 *
 * Règles anti-nausée pour un écran mural (voir §2 du plan) :
 *  - Durée plancher par plan : `DUREE_PLANCHER` — aucune coupe avant.
 *  - Priorité des événements : record > dépassement > boost > objectif ;
 *    un ralentissement ne déclenche jamais de coupe.
 *  - Un seul événement « en attente » à la fois — un nouvel événement de
 *    priorité supérieure remplace l'attente, jamais d'accumulation.
 *  - Rien en attente à l'expiration du plan courant → rotation d'ambiance
 *    aérien ↔ embarqué (derrière le leader du moment).
 *  - Un départ (nouvelle journée) ou un changement de période force un plan
 *    aérien de recadrage, comme une coupe sur le plan d'ensemble.
 */

import type { AgentId, EvenementCourse, TypeEvenement } from '../domain/types'

export type TypePlan = 'aerien' | 'embarque' | 'spot' | 'podium'

export interface PlanCamera {
  type: TypePlan
  cibleAgentId?: AgentId
  /** Horodatage (ms) avant lequel ce plan ne peut pas être coupé. */
  expireA: number
}

interface CandidatPlan {
  plan: PlanCamera
  priorite: number
}

export interface EtatMachineCamera {
  planActuel: PlanCamera
  planEnAttente: CandidatPlan | null
  prochainAmbiant: 'aerien' | 'embarque'
}

export type EntreeMachineCamera =
  | { nature: 'evenement'; evenement: EvenementCourse; maintenant: number }
  | { nature: 'tick'; maintenant: number }
  | { nature: 'reinitialisation'; maintenant: number }

/** Durée plancher d'un plan, en millisecondes (milieu de la fourchette 4-6s du plan). */
export const DUREE_PLANCHER = 5000

const PRIORITE: Partial<Record<TypeEvenement, number>> = {
  record: 4,
  depassement: 3,
  boost: 2,
  objectif: 1,
}

export function etatInitialCamera(maintenant: number): EtatMachineCamera {
  return {
    planActuel: { type: 'aerien', expireA: maintenant + DUREE_PLANCHER },
    planEnAttente: null,
    prochainAmbiant: 'embarque',
  }
}

function planDepuisEvenement(evenement: EvenementCourse): PlanCamera | null {
  switch (evenement.type) {
    case 'record':
      return { type: 'podium', expireA: 0 }
    case 'depassement':
    case 'boost':
    case 'objectif':
      return evenement.agentId
        ? { type: 'spot', cibleAgentId: evenement.agentId, expireA: 0 }
        : null
    default:
      // 'ralentissement' : jamais de coupe. 'depart' : géré à part, voir plus bas.
      return null
  }
}

/**
 * Fait évoluer la machine d'un pas. Fonction pure : mêmes entrées, même sortie.
 */
export function evoluerCamera(etat: EtatMachineCamera, entree: EntreeMachineCamera): EtatMachineCamera {
  if (entree.nature === 'reinitialisation') {
    return etatInitialCamera(entree.maintenant)
  }

  if (entree.nature === 'evenement') {
    if (entree.evenement.type === 'depart') {
      // Nouvelle journée : plan d'ensemble, comme un changement de période.
      return etatInitialCamera(entree.maintenant)
    }

    const plan = planDepuisEvenement(entree.evenement)
    if (!plan) return etat

    const prio = PRIORITE[entree.evenement.type] ?? 0

    if (entree.maintenant >= etat.planActuel.expireA) {
      // Le plan courant a fini son temps plancher : coupe immédiate.
      return {
        planActuel: { ...plan, expireA: entree.maintenant + DUREE_PLANCHER },
        planEnAttente: null,
        prochainAmbiant: etat.prochainAmbiant,
      }
    }

    if (!etat.planEnAttente || prio > etat.planEnAttente.priorite) {
      return { ...etat, planEnAttente: { plan, priorite: prio } }
    }

    return etat
  }

  // entree.nature === 'tick'
  if (entree.maintenant < etat.planActuel.expireA) return etat

  if (etat.planEnAttente) {
    return {
      planActuel: { ...etat.planEnAttente.plan, expireA: entree.maintenant + DUREE_PLANCHER },
      planEnAttente: null,
      prochainAmbiant: etat.prochainAmbiant,
    }
  }

  // Rien en attente : rotation d'ambiance.
  return {
    planActuel: { type: etat.prochainAmbiant, expireA: entree.maintenant + DUREE_PLANCHER },
    planEnAttente: null,
    prochainAmbiant: etat.prochainAmbiant === 'aerien' ? 'embarque' : 'aerien',
  }
}
