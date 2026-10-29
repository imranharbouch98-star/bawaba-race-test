/**
 * Constructeurs de maillage en anneau — la brique géométrique commune qui
 * permet aux tribunes de suivre tout le tracé, lignes droites et virages
 * confondus, plutôt que de se limiter à des blocs droits.
 *
 * Même technique que le ruban de piste (`Piste3D.tsx`) : on échantillonne
 * `pointSurPiste3D` à intervalle régulier sur tout `LONGUEUR_TOUR` et on
 * relie les points en bande de triangles — sauf qu'ici la bande se referme
 * sur elle-même (anneau complet) et peut varier en hauteur plutôt qu'en
 * décalage.
 */

import * as THREE from 'three'
import { LONGUEUR_TOUR, pointSurPiste3D } from '../../domain/circuit3d'

const SEGMENTS_ANNEAU = 160

function construireBande(
  points: (i: number, s: number) => [[number, number, number], [number, number, number]],
): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= SEGMENTS_ANNEAU; i += 1) {
    const s = (i / SEGMENTS_ANNEAU) * LONGUEUR_TOUR
    const [a, b] = points(i, s)
    positions.push(...a, ...b)

    if (i < SEGMENTS_ANNEAU) {
      const i0 = i * 2
      const i1 = i0 + 1
      const i2 = i0 + 2
      const i3 = i0 + 3
      indices.push(i0, i2, i1, i1, i2, i3)
    }
  }

  const geometrie = new THREE.BufferGeometry()
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometrie.setIndex(indices)
  geometrie.computeVertexNormals()
  return geometrie
}

/** Surface plate en anneau, à hauteur constante — le « plancher » d'une rangée. */
export function construireSurfaceAnneau(decalageInt: number, decalageExt: number, hauteur: number): THREE.BufferGeometry {
  return construireBande((_i, s) => {
    const interieur = pointSurPiste3D(s, decalageInt)
    const exterieur = pointSurPiste3D(s, decalageExt)
    return [
      [interieur.position.x, hauteur, interieur.position.z],
      [exterieur.position.x, hauteur, exterieur.position.z],
    ]
  })
}

/** Paroi verticale en anneau, à décalage constant — la face visible d'une contremarche. */
export function construireMurAnneau(decalage: number, hauteurBas: number, hauteurHaut: number): THREE.BufferGeometry {
  return construireBande((_i, s) => {
    const pose = pointSurPiste3D(s, decalage)
    return [
      [pose.position.x, hauteurBas, pose.position.z],
      [pose.position.x, hauteurHaut, pose.position.z],
    ]
  })
}
