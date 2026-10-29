/**
 * ---
 * Copie conforme depuis race-pulse (2D) — src/hooks/useAnimationReduite.ts.
 * Aucune ligne de logique modifiée. En cas de correctif ici, le reporter
 * dans les deux dépôts.
 */

import { useEffect, useState } from 'react'

const REQUETE = '(prefers-reduced-motion: reduce)'

/**
 * Respecte la préférence système de réduction des animations.
 * Quand elle est active, le moteur de course place les karts sans transition
 * et le décor cesse de s'animer.
 */
export function useAnimationReduite(): boolean {
  const [reduite, setReduite] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REQUETE).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(REQUETE)
    const surChangement = () => setReduite(media.matches)
    media.addEventListener('change', surChangement)
    return () => media.removeEventListener('change', surChangement)
  }, [])

  return reduite
}
