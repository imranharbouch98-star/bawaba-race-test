/**
 * Silhouette de kart — Phase 1 : formes primitives assemblées, en attendant
 * le modèle glTF de marque (Phase 4, voir §4 du plan). Comme le kart 2D,
 * dessiné centré sur l'origine et orienté vers +X (« avant ») — c'est le
 * groupe parent (`Circuit3D`) qui applique position et rotation par frame.
 */

import { memo } from 'react'

interface ProprietesKart {
  couleur: string
  /** Kart de démonstration piloté au clavier — hors classement. */
  invite?: boolean
}

const COULEUR_ROUE = '#14171c'

export const KartPlaceholder = memo(function KartPlaceholder({
  couleur,
  invite = false,
}: ProprietesKart) {
  return (
    <group>
      {/* Châssis */}
      <mesh position={[0, 0.24, 0]} castShadow>
        <boxGeometry args={[1.5, 0.32, 0.85]} />
        <meshStandardMaterial color={couleur} roughness={0.5} metalness={0.15} />
      </mesh>

      {/* Nez incliné */}
      <mesh position={[0.78, 0.22, 0]} rotation={[0, 0, Math.PI / 10]} castShadow>
        <boxGeometry args={[0.4, 0.22, 0.7]} />
        <meshStandardMaterial color={couleur} roughness={0.5} metalness={0.15} />
      </mesh>

      {/* Cockpit */}
      <mesh position={[-0.1, 0.46, 0]} castShadow>
        <boxGeometry args={[0.55, 0.22, 0.55]} />
        <meshStandardMaterial color="#0e1216" roughness={0.3} />
      </mesh>

      {/* Aileron arrière */}
      <mesh position={[-0.85, 0.42, 0]} castShadow>
        <boxGeometry args={[0.08, 0.36, 0.85]} />
        <meshStandardMaterial color={couleur} roughness={0.6} />
      </mesh>

      {/* Roues */}
      {[
        [0.55, 0.5],
        [0.55, -0.5],
        [-0.55, 0.5],
        [-0.55, -0.5],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.16, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.18, 16]} />
          <meshStandardMaterial color={COULEUR_ROUE} roughness={0.9} />
        </mesh>
      ))}

      {invite && (
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.95, 1.05, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.75} />
        </mesh>
      )}
    </group>
  )
})
