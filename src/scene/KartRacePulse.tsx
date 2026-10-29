/**
 * Kart de marque « Race Pulse » — modèle glTF modélisé dans Blender
 * (source : `assets-source/vehicules/kart-race-pulse.blend`), optimisé par
 * `npm run assets:optimiser` (Meshopt). Remplace le `KartPlaceholder` de la
 * Phase 1. Même contrat que lui : centré sur l'origine, orienté vers +X —
 * c'est le groupe parent (`Circuit3D`) qui applique position et rotation.
 */

import { memo, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Color, DoubleSide, Mesh, MeshStandardMaterial } from 'three'
import { EtiquetteAgent } from './EtiquetteAgent'
import { FlammeBoost } from './FlammeBoost'

const CHEMIN_MODELE = '/modeles/vehicules/kart-race-pulse.glb'

/**
 * Matériau Blender teinté aux couleurs de l'agent. L'optimiseur d'assets
 * préserve ce nom (voir `SANS_PALETTE` dans `scripts/optimiser-assets.mjs`).
 */
const MATERIAU_TEINTABLE = 'Carrosserie'
const MATERIAU_VISIERE = 'Visiere'

/**
 * La visière est la seule partie transparente du kart. Le matériau est
 * partagé entre les instances : aucun clone supplémentaire par agent et
 * aucune transparence coûteuse sur toute la carrosserie.
 */
const VisiereTransparente = new MeshStandardMaterial({
  name: 'VisiereTransparente',
  color: '#a9e7f5',
  emissive: '#073946',
  emissiveIntensity: 0.16,
  roughness: 0.16,
  metalness: 0.06,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
  side: DoubleSide,
})

/**
 * Luminance émissive en boost — au-delà du seuil de 1 du bloom
 * (`PostTraitement`), pour que seuls les karts en boost rayonnent.
 */
const INTENSITE_BOOST = 2.4

/**
 * Centre de la carrosserie : pivot des figures (vrille, salto, écrasement)
 * qu'applique `Circuit3D` au groupe nommé `caisse` — la plaque, elle, ne
 * tourne pas avec.
 */
const PIVOT_CAISSE = 0.5

interface ProprietesKart {
  couleur: string
  nom?: string
  initiales?: string
  rang?: number
  /** Nombre de karts classés — pour le dégradé de couleur des plaques. */
  total?: number
  miseEnAvant?: boolean
  /** Choisi dans la liste / un autre l'est — mise en évidence de la plaque. */
  selectionne?: boolean
  attenue?: boolean
  /** Politique d'affichage de la plaque, résolue par `Circuit3D`. */
  etiquetteVisible?: boolean
  /** Traînée de boost momentanée — halo émissif capté par le bloom. */
  boost?: boolean
  /** Sentinelle de performance : flamme coupée au même palier que le post-traitement. */
  flammesActives?: boolean
  /** Kart de démonstration piloté au clavier — hors classement. */
  invite?: boolean
}

export const KartRacePulse = memo(function KartRacePulse({
  couleur,
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
  invite = false,
}: ProprietesKart) {
  const { scene } = useGLTF(CHEMIN_MODELE)

  // Clone par kart : la géométrie reste partagée, seul le matériau de
  // carrosserie est dupliqué pour recevoir la teinte de l'agent.
  const { modele, materiauxTeintes } = useMemo(() => {
    const clone = scene.clone(true)
    const teinte = new Color(couleur)
    const teintes: MeshStandardMaterial[] = []
    clone.traverse((objet) => {
      if (!(objet instanceof Mesh)) return
      objet.castShadow = true
      const materiaux = Array.isArray(objet.material) ? objet.material : [objet.material]
      materiaux.forEach((materiau, index) => {
        if (materiau.name === MATERIAU_VISIERE) {
          if (Array.isArray(objet.material)) objet.material[index] = VisiereTransparente
          else objet.material = VisiereTransparente
          return
        }
        if (materiau.name !== MATERIAU_TEINTABLE) return
        if (!(materiau instanceof MeshStandardMaterial)) return
        const copie = materiau.clone()
        copie.color.copy(teinte)
        copie.emissive.copy(teinte)
        copie.emissiveIntensity = 0
        teintes.push(copie)
        if (Array.isArray(objet.material)) objet.material[index] = copie
        else objet.material = copie
      })
    })
    return { modele: clone, materiauxTeintes: teintes }
  }, [scene, couleur])

  useEffect(() => {
    for (const materiau of materiauxTeintes) {
      materiau.emissiveIntensity = boost ? INTENSITE_BOOST : 0
    }
  }, [materiauxTeintes, boost])

  // Dispose des matériaux clonés par kart (pas la géométrie ni les autres
  // matériaux, partagés avec le glTF mis en cache par `useGLTF` et donc
  // avec les autres instances — les libérer casserait les karts restants).
  // Portée pratique faible aujourd'hui (roster d'agents statique, aucun
  // kart ne démonte en fonctionnement normal) mais correct si la liste
  // d'agents devient un jour dynamique (voir README, "brancher les
  // données réelles").
  useEffect(() => {
    return () => {
      for (const materiau of materiauxTeintes) materiau.dispose()
    }
  }, [materiauxTeintes])

  return (
    <group>
      <group name="caisse" position={[0, PIVOT_CAISSE, 0]}>
        <group position={[0, -PIVOT_CAISSE, 0]}>
          <primitive object={modele} />
          {flammesActives && <FlammeBoost actif={boost} />}
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
        />
      )}

      {invite && (
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.05, 1.15, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.75} />
        </mesh>
      )}
    </group>
  )
})

useGLTF.preload(CHEMIN_MODELE)
