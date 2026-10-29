/**
 * Ciel en dégradé — sphère englobante avec une couleur par sommet, du bleu
 * profond au zénith vers un bleu pâle à l'horizon. Remplace le `<Sky>`
 * procédural de drei : plus simple à garantir vivement bleu (pas de réglages
 * physiques subtils à calibrer), et surtout `fog={false}` explicite — sans
 * ça, à cette distance, le brouillard de `Decor3D.tsx` (qui commence à 220)
 * teinte tout en vert délavé et le ciel paraît blanc terne au lieu de bleu.
 */

import { useMemo } from 'react'
import * as THREE from 'three'

const RAYON = 550

function construireGeometrieCiel(): THREE.BufferGeometry {
  const geometrie = new THREE.SphereGeometry(RAYON, 32, 24)
  const position = geometrie.getAttribute('position')
  const couleurs = new Float32Array(position.count * 3)
  const zenith = new THREE.Color('#1f6fb0')
  const horizon = new THREE.Color('#cdeaf5')
  const couleur = new THREE.Color()

  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i) / RAYON // -1 (nadir) .. 1 (zénith)
    const t = THREE.MathUtils.clamp((y + 0.1) / 0.6, 0, 1)
    couleur.copy(horizon).lerp(zenith, t)
    couleurs[i * 3] = couleur.r
    couleurs[i * 3 + 1] = couleur.g
    couleurs[i * 3 + 2] = couleur.b
  }

  geometrie.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3))
  return geometrie
}

export function CielDegrade() {
  const geometrie = useMemo(() => construireGeometrieCiel(), [])

  return (
    <mesh geometry={geometrie}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  )
}
