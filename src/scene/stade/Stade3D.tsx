/**
 * Composition du stade : anneau de tribunes continu (lignes droites et
 * virages), foule, signalétique de marque, arbres. Décor autour de la
 * piste ; l'asphalte lui-même vient de `Piste3D.tsx`, inchangé.
 */

import { memo } from 'react'
import { RAYON_EXTERIEUR_TRIBUNE } from './geometrieTribune'
import { Arbre3D } from './Arbre3D'
import { Foule } from './Foule'
import { Signaletique } from './Signaletique'
import { Tribune } from './Tribune'

interface ProprietesStade3D {
  animationReduite: boolean
  fouleReduite: boolean
  /** Avancement collectif de l'équipe, 0 à 1 — remplit les gradins. */
  remplissageTribunes: number
}

// Arbres au-delà du bord extérieur des tribunes (RAYON_EXTERIEUR_TRIBUNE ≈
// 50 depuis l'axe de la piste ; jusqu'à ~105 depuis l'origine au bout des
// virages) — valeurs vérifiées numériquement, pas devinées à l'œil.
const MARGE_ARBRE = RAYON_EXTERIEUR_TRIBUNE + 8

export const Stade3D = memo(function Stade3D({
  animationReduite,
  fouleReduite,
  remplissageTribunes,
}: ProprietesStade3D) {
  return (
    <group>
      <Tribune />
      <Foule
        animationReduite={animationReduite}
        reduite={fouleReduite}
        remplissage={remplissageTribunes}
      />
      <Signaletique />

      {/* Le long des lignes droites, au-delà des tribunes. */}
      <Arbre3D x={-30} z={MARGE_ARBRE} echelle={1.15} />
      <Arbre3D x={30} z={MARGE_ARBRE} echelle={1} teinte="#178a52" />
      <Arbre3D x={-30} z={-MARGE_ARBRE} echelle={1.05} teinte="#178a52" />
      <Arbre3D x={30} z={-MARGE_ARBRE} echelle={1.1} />

      {/* Au bout des virages, au-delà du point le plus éloigné de l'anneau. */}
      <Arbre3D x={110} z={0} echelle={1.2} />
      <Arbre3D x={-110} z={0} echelle={1.1} teinte="#178a52" />
      <Arbre3D x={98} z={35} echelle={0.95} teinte="#178a52" />
      <Arbre3D x={-98} z={-35} echelle={1} />
    </group>
  )
})
