/**
 * Point d'entrée unique de la couche données.
 *
 * Pour passer de la simulation à l'API réelle : renseignez
 * `VITE_RACE_PULSE_API_URL` dans un fichier `.env.local`. Rien d'autre à faire.
 *
 * ---
 * Copie conforme depuis race-pulse (2D) — src/data/index.ts. Aucune ligne de
 * logique modifiée. En cas de correctif ici, le reporter dans les deux dépôts.
 */

import { SimulateurCourse } from './SimulateurCourse'
import { SourceApi } from './SourceApi'
import type { SourceDonnees } from './SourceDonnees'
import { AGENTS } from './agents'

/**
 * Crée la source active. Le nombre d'agents ne concerne que le simulateur :
 * une API réelle reste souveraine sur son propre effectif.
 */
export function creerSourceDonnees(nombreAgents = AGENTS.length): SourceDonnees {
  const url = import.meta.env?.VITE_RACE_PULSE_API_URL
  const effectif = Math.min(AGENTS.length, Math.max(1, Math.round(nombreAgents)))
  return url ? new SourceApi(url) : new SimulateurCourse(AGENTS.slice(0, effectif))
}

export type { SourceDonnees } from './SourceDonnees'
export { SimulateurCourse } from './SimulateurCourse'
export { SourceApi, versInstantane } from './SourceApi'
export { AGENTS, OBJECTIFS } from './agents'
