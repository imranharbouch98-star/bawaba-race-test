/**
 * Modèle 3D de la piste. Il est préparé hors ligne par son script, qui en
 * extrait aussi la ligne médiane que suivent les karts — le dessin et le
 * tracé viennent de la même géométrie :
 *
 *  - « snoep » : circuit de bonbons (Sketchfab, matériaux « unlit ») —
 *    `scripts/preparer-piste-snoep.mjs` → `domain/tracePisteSnoep.ts`.
 *
 * Sources et licences : `public/modeles/LICENCES.md`.
 */

import { memo, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh'
import { PISTE_PAR_DEFAUT, type IdPiste } from '../domain/circuit3d'
import { CALQUE_OCCULTANT, NOM_PISTE_MODELE } from './calques'

const CHEMINS: Record<IdPiste, string> = {
  snoep: '/modeles/circuit/snoep-circuit.glb',
}

/** Le ciel du modèle : une sphère de ~830 m, au-delà du début du brouillard. */
const CIEL = /^Sky/i

export const PisteModele = memo(function PisteModele({ id }: { id: IdPiste }) {
  const { scene } = useGLTF(CHEMINS[id])
  const anisotropieMax = useThree((etat) => etat.gl.capabilities.getMaxAnisotropy())

  // Le sol et la route RECOIVENT les ombres des karts ; la piste n'en
  // projette pas : tout le décor dans la passe d'ombre, sans gain visible
  // sur un écran mural.
  //
  // Filtrage anisotrope : vue en biais (tous les plans embarqués), une
  // texture étalée sur des dizaines de mètres devient floue sans lui. Les
  // matériaux « unlit » du circuit de bonbons arrivent en MeshBasicMaterial.
  const modele = useMemo(() => {
    scene.traverse((objet) => {
      if (!(objet instanceof Mesh)) return
      objet.receiveShadow = true
      objet.castShadow = false
      const materiaux = Array.isArray(objet.material) ? objet.material : [objet.material]
      for (const materiau of materiaux) {
        if (!(materiau instanceof MeshStandardMaterial || materiau instanceof MeshBasicMaterial)) continue
        if (materiau.map) {
          materiau.map.anisotropy = anisotropieMax
          materiau.map.needsUpdate = true
        }
        // Le ciel ne se noie pas dans le brouillard de la scène.
        if (CIEL.test(materiau.name)) materiau.fog = false
      }

      // Décor opaque : peut cacher un kart à la caméra. Index spatial (BVH)
      // construit une fois (la géométrie reste en cache entre deux remontages
      // de la scène) : un rayon y coûte quelques microsecondes au lieu de
      // parcourir ~100 000 triangles.
      const opaque = materiaux.every((materiau) => !materiau.transparent && !CIEL.test(materiau.name))
      if (opaque) {
        objet.geometry.boundsTree ??= new MeshBVH(objet.geometry)
        objet.raycast = acceleratedRaycast
        objet.layers.enable(CALQUE_OCCULTANT)
      }
    })
    return scene
  }, [scene, anisotropieMax])

  return (
    <group name={NOM_PISTE_MODELE}>
      <primitive object={modele} />
    </group>
  )
})

useGLTF.preload(CHEMINS[PISTE_PAR_DEFAUT])
