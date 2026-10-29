/**
 * Véhicule acheté dans la boutique (« Winkel ») et choisi au garage — même
 * contrat que `KartRacePulse` : posé au sol, centré, avant vers +X ; c'est le
 * groupe parent (`Circuit3D`) qui le place sur la piste.
 *
 * Modèles préparés par `scripts/preparer-vehicules.mjs` (~10 000 triangles,
 * couleurs dans la texture). Contrairement au kart, ils ne se teignent PAS
 * aux couleurs de l'agent : leur couleur fait partie du véhicule acheté — la
 * plaque de nom reste l'identification sur la piste.
 */

import { memo, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Mesh } from 'three'
import { EtiquetteAgent } from './EtiquetteAgent'
import { FlammeBoost } from './FlammeBoost'
import { DIMENSIONS_VEHICULES } from './modelesVehicules'

/** La plaque flotte à cette hauteur au-dessus du toit. */
const MARGE_ETIQUETTE = 0.55

export function cheminVehicule(id: string): string {
  return `/modeles/vehicules/niveaux/${id}.glb`
}

/** Le véhicule a-t-il un modèle 3D ? (sinon `Circuit3D` garde le kart). */
export function vehiculeModelise(id: string): boolean {
  return id in DIMENSIONS_VEHICULES
}

interface ProprietesVehiculeNiveau {
  id: string
  nom?: string
  initiales?: string
  rang?: number
  total?: number
  miseEnAvant?: boolean
  selectionne?: boolean
  attenue?: boolean
  etiquetteVisible?: boolean
  boost?: boolean
  flammesActives?: boolean
}

export const VehiculeNiveau = memo(function VehiculeNiveau({
  id,
  nom,
  initiales,
  rang,
  total,
  miseEnAvant = false,
  selectionne = false,
  attenue = false,
  etiquetteVisible = true,
  boost = false,
  flammesActives = true,
}: ProprietesVehiculeNiveau) {
  const { scene } = useGLTF(cheminVehicule(id))
  const dimensions = DIMENSIONS_VEHICULES[id]

  // Clone par instance : géométrie et matériaux partagés (rien n'est teint),
  // seule la hiérarchie d'objets est propre à chaque agent.
  const modele = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((objet) => {
      if (objet instanceof Mesh) objet.castShadow = true
    })
    return clone
  }, [scene])

  return (
    <group>
      {/* `caisse` : pivot des figures (voir `KartRacePulse`), au centre du véhicule. */}
      <group name="caisse" position={[0, dimensions.hauteur / 2, 0]}>
        <group position={[0, -dimensions.hauteur / 2, 0]}>
          <primitive object={modele} />
          {flammesActives && (
            <FlammeBoost actif={boost} position={[-dimensions.longueur / 2, 0.3, dimensions.largeur * 0.3]} />
          )}
        </group>
      </group>

      {etiquetteVisible && nom && initiales && typeof rang === 'number' && (
        <EtiquetteAgent
          nom={nom}
          initiales={initiales}
          rang={rang}
          total={total ?? rang}
          miseEnAvant={miseEnAvant}
          selectionne={selectionne}
          attenue={attenue}
          hauteur={dimensions.hauteur + MARGE_ETIQUETTE}
        />
      )}

    </group>
  )
})
