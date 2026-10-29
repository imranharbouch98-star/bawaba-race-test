/**
 * Arbre stylisé — formes primitives (cône + cylindre), même esprit que les
 * arbres de l'actuel `Decor.tsx` (2D) transposés en 3D.
 */

import { memo } from 'react'

interface ProprietesArbre {
  x: number
  z: number
  echelle?: number
  teinte?: string
}

export const Arbre3D = memo(function Arbre3D({ x, z, echelle = 1, teinte = '#1f7a4d' }: ProprietesArbre) {
  return (
    <group position={[x, 0, z]} scale={echelle}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 1.6, 6]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow>
        <coneGeometry args={[1.1, 1.9, 8]} />
        <meshStandardMaterial color={teinte} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <coneGeometry args={[0.75, 1.3, 8]} />
        <meshStandardMaterial color={teinte} roughness={0.85} />
      </mesh>
    </group>
  )
})
