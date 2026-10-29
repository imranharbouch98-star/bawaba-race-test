/**
 * Disque de soleil visible dans le ciel.
 *
 * Positionné exactement dans l'axe de la vraie lumière directionnelle de
 * `Decor3D.tsx` — les deux reçoivent le même `EtatSoleil`, si bien que « ce
 * qui éclaire » et « ce qu'on voit briller » ne peuvent pas diverger. Ce
 * n'est pas un décor, c'est la représentation de la source réelle. Matière
 * non éclairée (`meshBasicMaterial`) : un soleil ne doit jamais paraître
 * dans l'ombre de lui-même.
 */

import { memo } from 'react'
import type { EtatSoleil } from './cycleJour'

const DISTANCE = 400

interface ProprietesSoleil3D {
  soleil: EtatSoleil
}

export const Soleil3D = memo(function Soleil3D({ soleil }: ProprietesSoleil3D) {
  const position: [number, number, number] = [
    soleil.direction.x * DISTANCE,
    soleil.direction.y * DISTANCE,
    soleil.direction.z * DISTANCE,
  ]

  return (
    <group position={position}>
      {/* Halo doux, plus grand et transparent. `fog={false}` : à cette
          distance (voir DISTANCE ci-dessus), le brouillard de Decor3D
          noierait le soleil dans sa teinte plutôt que de le laisser briller. */}
      <mesh>
        <sphereGeometry args={[40, 24, 24]} />
        <meshBasicMaterial
          color={soleil.couleurDisque}
          transparent
          opacity={0.25}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      {/* Disque plein, net. */}
      <mesh>
        <sphereGeometry args={[22, 24, 24]} />
        <meshBasicMaterial color={soleil.couleurDisque} fog={false} />
      </mesh>
    </group>
  )
})
