/**
 * ---
 * Copie conforme depuis race-pulse (2D) — src/hooks/useInstantane.ts. Aucune
 * ligne de logique modifiée. En cas de correctif ici, le reporter dans les
 * deux dépôts.
 */

import { useEffect, useState } from 'react'
import type { Instantane } from '../domain/types'
import type { SourceDonnees } from '../data/SourceDonnees'

/**
 * Abonne le composant au flux d'instantanés de la source de données.
 * Renvoie `null` tant que le premier instantané n'est pas arrivé.
 */
export function useInstantane(source: SourceDonnees): Instantane | null {
  const [instantane, setInstantane] = useState<Instantane | null>(null)

  useEffect(() => source.souscrire(setInstantane), [source])

  return instantane
}
