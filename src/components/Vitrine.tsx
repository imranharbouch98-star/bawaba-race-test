/**
 * Vitrine de la boutique (30/10) : le garage de confiserie en décor, et au
 * milieu, sur un plateau qui tourne doucement, le véhicule regardé — un des
 * siens (garage) ou un véhicule de la boutique (aperçu avant achat).
 *
 * Une scène 3D À PART, montée seulement quand la boutique est ouverte —
 * pendant ce temps, la scène de course est figée (`frameloop="never"` dans
 * `App.tsx`) : un seul rendu à la fois sur le GPU de l'écran mural.
 */

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Mesh, MeshStandardMaterial, type Group } from 'three'
import { useAnimationReduite } from '../hooks/useAnimationReduite'
import { KartRacePulse } from '../scene/KartRacePulse'
import { VehiculeNiveau, vehiculeModelise } from '../scene/VehiculeNiveau'

const CHEMIN_GARAGE = '/modeles/garage/candy-garage.glb'

/** Caméra : au-dessus du comptoir à bocaux (qui cachait le bas du véhicule), visant le plancher du milieu. */
const POSITION_CAMERA: [number, number, number] = [0, 4.4, 6.2]
const VISEE: [number, number, number] = [0, 0.35, -0.2]
/** Tour complet du plateau en ~18 s. */
const VITESSE_PLATEAU = 0.35

function Garage() {
  const { scene } = useGLTF(CHEMIN_GARAGE)
  const anisotropieMax = useThree((etat) => etat.gl.capabilities.getMaxAnisotropy())
  const modele = useMemo(() => {
    scene.traverse((objet) => {
      if (!(objet instanceof Mesh)) return
      objet.receiveShadow = true
      const materiau = objet.material
      if (materiau instanceof MeshStandardMaterial && materiau.map) {
        materiau.map.anisotropy = anisotropieMax
        materiau.map.needsUpdate = true
      }
    })
    return scene
  }, [scene, anisotropieMax])
  return <primitive object={modele} />
}

function Cadrage() {
  const camera = useThree((etat) => etat.camera)
  useEffect(() => {
    camera.lookAt(...VISEE)
  }, [camera])
  return null
}

function Plateau({ vehiculeId, couleur, tourne }: { vehiculeId: string; couleur: string; tourne: boolean }) {
  const plateau = useRef<Group>(null)
  useFrame((_, dt) => {
    if (tourne && plateau.current) plateau.current.rotation.y += Math.min(dt, 0.1) * VITESSE_PLATEAU
  })
  // Trois quarts avant au repos (animations réduites) : le nez vers la caméra, à gauche.
  return (
    <group ref={plateau} rotation={[0, Math.PI / 5, 0]}>
      {/* Le kart de remplacement le temps du chargement, comme sur la piste. */}
      <Suspense fallback={<KartRacePulse couleur={couleur} etiquetteVisible={false} flammesActives={false} />}>
        {vehiculeId !== 'kart-standaard' && vehiculeModelise(vehiculeId) ? (
          <VehiculeNiveau key={vehiculeId} id={vehiculeId} etiquetteVisible={false} flammesActives={false} />
        ) : (
          <KartRacePulse couleur={couleur} etiquetteVisible={false} flammesActives={false} />
        )}
      </Suspense>
    </group>
  )
}

export function Vitrine({ vehiculeId, couleur }: { vehiculeId: string; couleur: string }) {
  const animationReduite = useAnimationReduite()
  return (
    <Canvas
      className="vitrine__canevas"
      shadows="basic"
      flat
      dpr={[1, 1.5]}
      camera={{ position: POSITION_CAMERA, fov: 42, near: 0.1, far: 100 }}
    >
      <Cadrage />
      <hemisphereLight args={['#fff4e6', '#8a5a3c', 1.1]} />
      <directionalLight position={[3, 7, 5]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <Suspense fallback={null}>
        <Garage />
      </Suspense>
      <Plateau vehiculeId={vehiculeId} couleur={couleur} tourne={!animationReduite} />
    </Canvas>
  )
}

useGLTF.preload(CHEMIN_GARAGE)
