/**
 * Décor d'ambiance — sol, ciel, soleil, nuages, éclairage. Le stade
 * (tribunes, foule, signalétique, arbres) vit dans `stade/Stade3D.tsx` ;
 * ce fichier reste concentré sur l'atmosphère générale.
 */

import { memo, useMemo } from 'react'
import type { EtatSoleil } from './cycleJour'
import { CielDegrade } from './CielDegrade'
import { Nuage3D } from './Nuage3D'
import { Soleil3D } from './Soleil3D'

/**
 * Distance de la lumière directionnelle — seule sa direction compte, mais
 * la caméra d'ombre part de là : elle doit rester en dehors de la piste Fab
 * (~550 × 320 m) pour en couvrir toute l'étendue.
 */
const PORTEE_LUMIERE = 450
/** Demi-côté du frustum d'ombre : toute la piste Fab, recentrée sur l'origine. */
const ETENDUE_OMBRE = 300

interface ProprietesDecor3D {
  /** Position et teinte du soleil pour l'heure courante. */
  soleil: EtatSoleil
  animationReduite: boolean
  /** Sentinelle de performance : coupe l'ombre portée au palier « sans ombres ». */
  ombresActives: boolean
  /**
   * Disque de pelouse procédural. Inutile (et gênant) sous la piste Fab, qui
   * a son propre terrain vallonné : le disque plat le percerait dans les
   * creux. Ne sert plus qu'au palier « 3D minimale ».
   */
  solProcedural: boolean
}

/**
 * Nuages répartis tout autour (pas alignés le long d'un seul axe) : quel
 * que soit le plan choisi par le réalisateur de caméra (§2 du plan), il y
 * en a toujours au moins deux ou trois dans le champ plutôt qu'une chance
 * sur quatre de tomber sur le seul axe où ils étaient regroupés.
 */
function construireNuages() {
  // Rayons et taille ×2,5 depuis la piste Fab : à l'échelle de l'ancien
  // ovale, les nuages flottaient au-dessus du circuit, en plein champ.
  const rayons = [475, 600, 410, 650, 525, 390, 575, 450]
  return rayons.map((rayon, i) => {
    const angle = (i / rayons.length) * Math.PI * 2 + (i % 2) * 0.3
    return {
      x: Math.cos(angle) * rayon,
      y: 160 + ((i * 37) % 80),
      z: Math.sin(angle) * rayon,
      echelle: 2.5 * (0.85 + ((i * 13) % 10) / 20),
      vitesse: 0.8 + ((i * 7) % 10) / 10,
    }
  })
}

export const Decor3D = memo(function Decor3D({
  animationReduite,
  ombresActives,
  soleil,
  solProcedural,
}: ProprietesDecor3D) {
  const nuages = useMemo(() => construireNuages(), [])

  return (
    <group>
      <CielDegrade />
      <Soleil3D soleil={soleil} />
      {/* Brouillard repoussé pour la piste Fab : la caméra aérienne en est à
          ~500 m, l'ancien 220–440 en noyait la moitié. */}
      <fog attach="fog" args={[soleil.couleurBrouillard, 700, 1800]} />

      <ambientLight intensity={soleil.intensiteAmbiante} color={soleil.couleurAmbiante} />
      <hemisphereLight
        args={[soleil.couleurAmbiante, '#0c5335', soleil.intensiteAmbiante * 0.9]}
      />
      <directionalLight
        position={[
          soleil.direction.x * PORTEE_LUMIERE,
          soleil.direction.y * PORTEE_LUMIERE,
          soleil.direction.z * PORTEE_LUMIERE,
        ]}
        intensity={soleil.intensite}
        color={soleil.couleurLumiere}
        castShadow={ombresActives}
        // NE PAS descendre à 1024² — essayé, rejeté sur constat visuel.
        //
        // Le frustum couvre ±120 unités (il doit englober tout l'anneau :
        // décalage latéral max ~94, plus les tribunes et les arbres). À
        // 2048² un texel d'ombre mesure 11,7 cm ; à 1024² il en mesure
        // 23,4, et comme le rendu est en `BasicShadowMap` (voir `shadows`
        // sur le <Canvas>) il n'y a AUCUN filtrage pour adoucir les bords :
        // l'ombre du kart devient un escalier de gros carrés.
        //
        // Le raisonnement « la caméra est loin, on ne verra pas » ne vaut
        // que pour le plan aérien (rayon 145). Les plans « embarqué »
        // (recul 6,5) et « spot » (latéral 8) du réalisateur cadrent le
        // kart de très près — c'est là que ça se voit.
        //
        // Le gain de la passe d'ombre est à chercher du côté du nombre de
        // casters (la foule ne projette plus, cf. `Foule.tsx`), pas de la
        // résolution.
        //
        // Piste Fab (19/10) : le frustum passe à ±300 pour couvrir tout le
        // circuit, soit un texel de ~29 cm à 2048². Les ombres des karts en
        // plan rapproché sont donc plus grossières qu'avant — piste connue :
        // un frustum qui suit la caméra au lieu de couvrir toute la piste.
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-ETENDUE_OMBRE}
        shadow-camera-right={ETENDUE_OMBRE}
        shadow-camera-top={ETENDUE_OMBRE}
        shadow-camera-bottom={-ETENDUE_OMBRE}
        shadow-camera-far={PORTEE_LUMIERE * 2.5}
      />

      {nuages.map((nuage, i) => (
        <Nuage3D
          key={i}
          x={nuage.x}
          y={nuage.y}
          z={nuage.z}
          echelle={nuage.echelle}
          vitesse={nuage.vitesse}
          animationReduite={animationReduite}
        />
      ))}

      {/* Rayon généreux (500, contre 260 avant) : le bord fini d'un disque
          plat, vu depuis l'intérieur de son empreinte à cette hauteur,
          dessine une silhouette arrondie sur l'horizon — plus le disque est
          grand, plus ce bord recule et se noie dans le brouillard avant de
          devenir visible. */}
      {solProcedural && (
        <mesh position={[0, -0.02, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[1200, 64]} />
          <meshStandardMaterial color="#0c5335" roughness={1} />
        </mesh>
      )}
    </group>
  )
})
