/**
 * Structure de la tribune — un anneau continu de gradins en escalier
 * entourant tout le circuit (lignes droites et virages), pas seulement deux
 * blocs droits. Formes primitives / rubans procéduraux (dans le même esprit
 * que le kart placeholder de la Phase 1) : pas encore de modèle de marque
 * (Phase 4).
 */

import { memo, useMemo } from 'react'
import { DoubleSide } from 'three'
import { RANGEES, decalageRangee, hauteurRangee } from './geometrieTribune'
import { construireMurAnneau, construireSurfaceAnneau } from './anneauTribune'

export const Tribune = memo(function Tribune() {
  const rangees = useMemo(
    () =>
      Array.from({ length: RANGEES }, (_, i) => {
        const decalageBas = decalageRangee(i)
        const decalageHaut = decalageRangee(i + 1)
        const hauteurBas = i === 0 ? 0 : hauteurRangee(i - 1)
        const hauteurHaut = hauteurRangee(i)
        return {
          surface: construireSurfaceAnneau(decalageBas, decalageHaut, hauteurHaut),
          mur: construireMurAnneau(decalageHaut, hauteurBas, hauteurHaut),
          teinte: i % 2 === 0 ? '#3a4a48' : '#44564f',
        }
      }),
    [],
  )

  const toiture = useMemo(
    () => construireSurfaceAnneau(decalageRangee(RANGEES) - 1.6, decalageRangee(RANGEES), hauteurRangee(RANGEES - 1) + 0.35),
    [],
  )

  return (
    <group>
      {rangees.map((rangee, i) => (
        <group key={i}>
          <mesh geometry={rangee.surface} castShadow receiveShadow>
            <meshStandardMaterial color={rangee.teinte} roughness={0.85} side={DoubleSide} />
          </mesh>
          <mesh geometry={rangee.mur} castShadow receiveShadow>
            <meshStandardMaterial color="#16202a" roughness={0.9} side={DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Toiture en surplomb, au sommet de la dernière rangée. */}
      <mesh geometry={toiture} castShadow>
        <meshStandardMaterial color="#0d5c3a" roughness={0.7} side={DoubleSide} />
      </mesh>
    </group>
  )
})
