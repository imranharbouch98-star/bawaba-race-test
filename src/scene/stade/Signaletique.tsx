/**
 * Signalétique de marque — arche et panneaux à l'intérieur du circuit.
 * Contenu repris de l'actuel `Decor.tsx` (2D) pour garder la même identité :
 * même slogan, mêmes valeurs affichées. Formes primitives + texte drei
 * (`<Text>`, suspend le temps de charger sa police par défaut — d'où le
 * `<Suspense>`), en attendant les panneaux de marque Phase 4.
 */

import { Suspense, memo } from 'react'
import { Text } from '@react-three/drei'
import { FrontSide } from 'three'

function Panneau({
  x,
  z,
  rotationY,
  texte,
  couleur,
}: {
  x: number
  z: number
  rotationY: number
  texte: string
  couleur: string
}) {
  return (
    <group position={[x, 1.3, z]} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[9, 1.6, 0.15]} />
        <meshStandardMaterial color="#08281c" roughness={0.6} />
      </mesh>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.09]}
          fontSize={0.62}
          color={couleur}
          anchorX="center"
          anchorY="middle"
          maxWidth={8.2}
          letterSpacing={0.02}
          material-side={FrontSide}
        >
          {texte}
        </Text>
      </Suspense>
    </group>
  )
}

export const Signaletique = memo(function Signaletique() {
  return (
    <group>
      {/* Arche centrale, au milieu de l'intérieur du circuit. */}
      <group position={[0, 0, 0]}>
        <mesh position={[-9, 3, 0]} castShadow>
          <boxGeometry args={[0.5, 6, 0.5]} />
          <meshStandardMaterial color="#052b1c" roughness={0.8} />
        </mesh>
        <mesh position={[9, 3, 0]} castShadow>
          <boxGeometry args={[0.5, 6, 0.5]} />
          <meshStandardMaterial color="#052b1c" roughness={0.8} />
        </mesh>
        <mesh position={[0, 5.8, 0]} castShadow>
          <boxGeometry args={[19, 1.2, 0.5]} />
          <meshStandardMaterial color="#08281c" roughness={0.6} />
        </mesh>
        <Suspense fallback={null}>
          <Text
            position={[0, 5.8, 0.3]}
            fontSize={0.72}
            color="#ffc93c"
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.06}
            material-side={FrontSide}
          >
            RACE PULSE
          </Text>
        </Suspense>
        <Suspense fallback={null}>
          <Text
            position={[0, 4.85, 0]}
            fontSize={0.34}
            color="#7ee787"
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.03}
            material-side={FrontSide}
          >
            LA PERFORMANCE PREND LA PISTE
          </Text>
        </Suspense>
      </group>

      {/* Rangée face à la piste basse (+Z) : rotationY = π retourne la face du
          panneau (normale +Z par défaut) vers -Z, donc vers le centre du circuit. */}
      <Panneau x={-13} z={9} rotationY={Math.PI} texte="FAIR-PLAY" couleur="#7ee787" />
      <Panneau x={0} z={9} rotationY={Math.PI} texte="ESPRIT D'ÉQUIPE" couleur="#22d3ee" />
      <Panneau x={13} z={9} rotationY={Math.PI} texte="ENTRAIDE" couleur="#ff6b57" />
    </group>
  )
})
