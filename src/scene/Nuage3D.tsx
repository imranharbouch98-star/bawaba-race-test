/**
 * Nuage animé — quelques sphères aplaties superposées (même esprit que les
 * nuages du décor 2D), qui dérivent lentement dans le ciel. Formes
 * primitives, aucune texture ni dépendance externe (le `<Cloud>` de drei
 * s'appuie sur un CDN tiers, explicitement déconseillé en production —
 * d'où ce composant maison).
 */

import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

interface ProprietesNuage {
  x: number
  y: number
  z: number
  echelle?: number
  /** Mètres par seconde — lent, jamais distrayant sur un écran mural. */
  vitesse?: number
  animationReduite: boolean
}

/** Demi-portée de la dérive avant de repartir de l'autre côté (boucle discrète). */
const PORTEE = 260

export const Nuage3D = memo(function Nuage3D({
  x,
  y,
  z,
  echelle = 1,
  vitesse = 1.2,
  animationReduite,
}: ProprietesNuage) {
  const ref = useRef<Group>(null)
  const decalageInitial = useRef(x)

  const puffs = useMemo(
    () => [
      { dx: 0, dz: 0, rayon: 14 },
      { dx: -18, dz: 3, rayon: 10 },
      { dx: 16, dz: -2, rayon: 11 },
      { dx: 4, dz: 6, rayon: 9 },
    ],
    [],
  )

  useFrame((_etat, dt) => {
    const groupe = ref.current
    if (!groupe || animationReduite) return
    let nouveauX = groupe.position.x + vitesse * dt
    if (nouveauX > decalageInitial.current + PORTEE) nouveauX -= 2 * PORTEE
    groupe.position.x = nouveauX
  })

  return (
    <group ref={ref} position={[x, y, z]} scale={echelle}>
      {puffs.map((puff, i) => (
        <mesh key={i} position={[puff.dx, 0, puff.dz]}>
          <sphereGeometry args={[puff.rayon, 12, 10]} />
          {/* Opaque et `fog={false}` : semi-transparent, deux nuages qui se
              recouvrent viraient au gris ; à cette distance, le brouillard
              délaverait encore la teinte en plus de ça. */}
          <meshBasicMaterial color="#fdfdfb" fog={false} />
        </mesh>
      ))}
    </group>
  )
})
