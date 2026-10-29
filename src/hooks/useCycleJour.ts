/**
 * État du cycle de la journée pour l'heure courante, rafraîchi une fois par
 * minute.
 *
 * Le soleil ne bouge que d'un tiers de degré par minute et le compte à
 * rebours du dernier tour s'affiche en minutes : recalculer plus souvent
 * n'apporterait rien de visible et provoquerait des rendus React inutiles au
 * milieu d'une scène qui tourne à soixante images par seconde.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  heureDecimale,
  journeeAHeure,
  soleilAHeure,
  type EtatJournee,
  type EtatSoleil,
} from '../scene/cycleJour'

const PERIODE_RAFRAICHISSEMENT = 60_000

export interface EtatCycleJour {
  soleil: EtatSoleil
  journee: EtatJournee
}

/** `?heure=` fige l'heure — démonstration, captures, mise au point du décor. */
function heureForcee(): number | null {
  if (typeof window === 'undefined') return null
  const valeur = Number(new URLSearchParams(window.location.search).get('heure'))
  return Number.isFinite(valeur) && valeur >= 0 && valeur <= 24 ? valeur : null
}

export function useCycleJour(): EtatCycleJour {
  const [forcee] = useState(heureForcee)
  const [heure, setHeure] = useState(() => forcee ?? heureDecimale(new Date()))

  useEffect(() => {
    if (forcee !== null) return
    const minuteur = setInterval(
      () => setHeure(heureDecimale(new Date())),
      PERIODE_RAFRAICHISSEMENT,
    )
    return () => clearInterval(minuteur)
  }, [forcee])

  return useMemo(
    () => ({ soleil: soleilAHeure(heure), journee: journeeAHeure(heure) }),
    [heure],
  )
}
