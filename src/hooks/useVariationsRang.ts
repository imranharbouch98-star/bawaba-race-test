/**
 * Suit les gains et pertes de places entre deux mises à jour du classement.
 *
 * C'est ce qui permet au tour de chrono d'afficher une flèche ▲/▼ : sur un
 * écran regardé de loin et par intermittence, le mouvement est plus lisible
 * que le rang lui-même — on repère qu'il se passe quelque chose avant même
 * d'avoir lu un chiffre.
 */

import { useEffect, useRef, useState } from 'react'
import type { LigneClassement } from '../domain/classement'
import type { AgentId, Periode } from '../domain/types'

const AUCUNE_VARIATION: ReadonlyMap<AgentId, number> = new Map()

/**
 * @returns places gagnées par agent depuis la mise à jour précédente
 *   (positif = remontée). Les agents dont le rang n'a pas bougé sont absents.
 */
export function useVariationsRang(
  lignes: LigneClassement[],
  periode: Periode,
): ReadonlyMap<AgentId, number> {
  // Le tableau déjà traité, pour ignorer un effet rejoué sur les mêmes
  // données — c'est le cas sous `StrictMode`, où un double appel viderait
  // silencieusement toutes les flèches en développement.
  const traite = useRef<LigneClassement[] | null>(null)
  const rangsPrecedents = useRef(new Map<AgentId, number>())
  const periodePrecedente = useRef(periode)
  const [variations, setVariations] = useState<ReadonlyMap<AgentId, number>>(AUCUNE_VARIATION)

  useEffect(() => {
    if (traite.current === lignes) return
    traite.current = lignes

    const rangs = new Map(lignes.map((ligne) => [ligne.agent.id, ligne.rang]))

    // Un changement de période n'est pas une course : c'est un autre
    // classement. Afficher « +12 places » parce que l'utilisateur est passé
    // du jour au mois n'aurait aucun sens.
    if (periodePrecedente.current !== periode) {
      periodePrecedente.current = periode
      rangsPrecedents.current = rangs
      setVariations(AUCUNE_VARIATION)
      return
    }

    const nouvelles = new Map<AgentId, number>()
    for (const ligne of lignes) {
      const precedent = rangsPrecedents.current.get(ligne.agent.id)
      if (precedent !== undefined && precedent !== ligne.rang) {
        nouvelles.set(ligne.agent.id, precedent - ligne.rang)
      }
    }

    rangsPrecedents.current = rangs
    setVariations(nouvelles.size > 0 ? nouvelles : AUCUNE_VARIATION)
  }, [lignes, periode])

  return variations
}
