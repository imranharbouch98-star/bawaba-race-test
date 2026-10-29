/**
 * Commandes du kart invité.
 *
 * ⚠️ Ces commandes sont purement ludiques. Elles n'écrivent nulle part dans le
 * modèle de performance : le kart invité n'apparaît ni dans le classement ni
 * sur le podium, et aucun score n'est modifié.
 *
 * ---
 * Copie conforme depuis race-pulse (2D) — src/hooks/usePiloteInvite.ts. Aucune
 * ligne de LOGIQUE modifiée ; seul l'import de `CIRCUIT` pointe vers
 * `../domain/circuit3d` au lieu de `../domain/circuit`, ce fichier n'existant
 * pas dans ce dépôt. Le consommateur de `commande` change aussi (lu depuis un
 * `useFrame` R3F au lieu d'une boucle DOM), mais le contrat `CommandePilote`
 * ne bouge pas.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CIRCUIT } from '../domain/circuit3d'

/** Consigne lue à chaque image par le moteur de course. */
export interface CommandePilote {
  /** Voie visée, de 0 (intérieure) à `nombreVoies - 1` (extérieure). */
  voie: number
  /** Horodatage `performance.now()` jusqu'auquel le boost reste actif. */
  boostJusqua: number
}

const DUREE_BOOST = 1200

export interface Pilote {
  actif: boolean
  voie: number
  boostActif: boolean
  /** Objet stable lu par le moteur de course, sans provoquer de rendu. */
  commande: { current: CommandePilote }
  basculer: () => void
  versInterieur: () => void
  versExterieur: () => void
  declencherBoost: () => void
}

export function usePiloteInvite(): Pilote {
  const [actif, setActif] = useState(false)
  const [voie, setVoie] = useState(1)
  const [boostActif, setBoostActif] = useState(false)

  const commande = useRef<CommandePilote>({ voie: 1, boostJusqua: 0 })
  const minuteurBoost = useRef<ReturnType<typeof setTimeout> | null>(null)

  const changerVoie = useCallback((delta: number) => {
    setVoie((precedente) => {
      const suivante = Math.min(CIRCUIT.nombreVoies - 1, Math.max(0, precedente + delta))
      commande.current.voie = suivante
      return suivante
    })
  }, [])

  const versInterieur = useCallback(() => changerVoie(-1), [changerVoie])
  const versExterieur = useCallback(() => changerVoie(1), [changerVoie])

  const declencherBoost = useCallback(() => {
    commande.current.boostJusqua = performance.now() + DUREE_BOOST
    setBoostActif(true)
    if (minuteurBoost.current !== null) clearTimeout(minuteurBoost.current)
    minuteurBoost.current = setTimeout(() => setBoostActif(false), DUREE_BOOST)
  }, [])

  const basculer = useCallback(() => setActif((precedent) => !precedent), [])

  // Nettoyage du minuteur de boost au démontage.
  useEffect(
    () => () => {
      if (minuteurBoost.current !== null) clearTimeout(minuteurBoost.current)
    },
    [],
  )

  // Clavier — actif seulement lorsque le kart invité est en piste.
  useEffect(() => {
    if (!actif) return

    const surTouche = (evenement: KeyboardEvent) => {
      // On laisse la saisie normale se faire dans les champs de formulaire.
      const cible = evenement.target
      if (cible instanceof HTMLElement && cible.closest('input, textarea, select, [contenteditable]')) {
        return
      }

      switch (evenement.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          evenement.preventDefault()
          versInterieur()
          break
        case 'ArrowRight':
        case 'ArrowDown':
          evenement.preventDefault()
          versExterieur()
          break
        case ' ':
        case 'Spacebar':
          evenement.preventDefault()
          declencherBoost()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [actif, versInterieur, versExterieur, declencherBoost])

  return {
    actif,
    voie,
    boostActif,
    commande,
    basculer,
    versInterieur,
    versExterieur,
    declencherBoost,
  }
}
