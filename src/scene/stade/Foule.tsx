/**
 * Foule animée — spectateurs instanciés, posés sur les tribunes.
 *
 * Choix technique à retenir pour la suite : animation en CPU (matrices
 * d'instance recalculées à chaque frame) plutôt que par shader GPU comme
 * envisagé au plan. À l'échelle actuelle (moins de 1000 places), c'est
 * largement dans le budget de performance (§8 du plan) et plus sûr à écrire
 * correctement que de deviner l'ordre exact des chunks de shader
 * d'instanciation de la version de Three.js en cours. Si le profilage en
 * Phase 5 montre que ça compte vraiment, ce fichier est le seul à changer —
 * `genererPlacesTribune.ts` n'a pas à bouger.
 *
 * Piège rencontré, à ne pas réintroduire : NE PAS mettre `vertexColors` sur
 * le matériau. `InstancedMesh.instanceColor` s'applique automatiquement,
 * indépendamment de ce flag ; `vertexColors={true}` attend en plus un
 * attribut `color` par SOMMET sur la géométrie (différent de la couleur par
 * INSTANCE) que cette géométrie n'a pas, et sa présence fait alors sortir
 * les instances entièrement noires — testé et confirmé sur Standard,
 * Lambert et Basic, avec et sans éclairage renforcé. Sans ce flag, la
 * couleur par instance s'affiche correctement, y compris avec un matériau
 * éclairé (ombres et gradient corrects).
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedBufferAttribute, InstancedMesh, Object3D } from 'three'
import { genererPlacesTribune } from './genererPlacesTribune'

const PALETTE = ['#ff6b57', '#ffc93c', '#22d3ee', '#a78bfa', '#7ee787', '#f472b6', '#fb923c']

const AMPLITUDE_BALANCEMENT = 0.05
const VITESSE_BALANCEMENT = 1.6

/**
 * Part des places déjà occupées à l'ouverture. Une tribune vide au démarrage
 * donnerait l'image d'un stade abandonné plutôt que d'une journée qui
 * commence.
 */
const REMPLISSAGE_INITIAL = 0.18

interface ProprietesFoule {
  animationReduite: boolean
  /** Sentinelle de performance : moitié des sièges vidés au palier « foule réduite ». */
  reduite?: boolean
  /**
   * Avancement de l'équipe vers son objectif COLLECTIF, entre 0 et 1. Les
   * gradins se remplissent au fil de la journée.
   *
   * C'est un indicateur d'équipe, jamais nominatif : il monte quand le
   * groupe avance, sans désigner personne. Lisible de très loin — on voit
   * une tribune se garnir bien avant de pouvoir lire un chiffre.
   */
  remplissage?: number
}

export function Foule({ animationReduite, reduite = false, remplissage = 1 }: ProprietesFoule) {
  const toutesLesPlaces = useMemo(() => genererPlacesTribune(), [])
  // Un siège sur deux plutôt qu'un tronçon entier : la tribune s'éclaircit
  // uniformément au lieu de se vider d'un seul côté.
  const places = useMemo(
    () => (reduite ? toutesLesPlaces.filter((_place, index) => index % 2 === 0) : toutesLesPlaces),
    [toutesLesPlaces, reduite],
  )
  const ref = useRef<InstancedMesh>(null)
  const objetTemp = useMemo(() => new Object3D(), [])

  // Couleurs posées une seule fois — ne dépendent pas de l'animation.
  //
  // Volontairement PAS `mesh.setColorAt()` : combinée à React Three Fiber,
  // cette méthode produit de façon fiable des instances noires (bug connu
  // et documenté de la communauté — pmndrs/react-three-fiber#2854). Le
  // contournement établi consiste à construire soi-même l'attribut
  // `instanceColor` et à l'assigner directement, ce qui évite l'ordre
  // d'initialisation en cause.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const tableauCouleurs = new Float32Array(places.length * 3)
    const couleur = new Color()
    for (let i = 0; i < places.length; i += 1) {
      couleur.set(PALETTE[places[i].teinte % PALETTE.length])
      tableauCouleurs[i * 3] = couleur.r
      tableauCouleurs[i * 3 + 1] = couleur.g
      tableauCouleurs[i * 3 + 2] = couleur.b
    }
    mesh.instanceColor = new InstancedBufferAttribute(tableauCouleurs, 3)
  }, [places])

  const positionner = (temps: number) => {
    const mesh = ref.current
    if (!mesh) return
    // Borné à `count` et non à `places.length` : inutile de recalculer la
    // matrice de spectateurs qui ne seront pas dessinés. Au démarrage, quand
    // les gradins sont encore aux deux tiers vides, c'est autant de travail
    // CPU épargné à chaque image.
    for (let i = 0; i < mesh.count; i += 1) {
      const place = places[i]
      const bob = animationReduite ? 0 : Math.sin(temps * VITESSE_BALANCEMENT + place.dephasage) * AMPLITUDE_BALANCEMENT
      objetTemp.position.set(place.position.x, place.position.y + bob, place.position.z)
      objetTemp.rotation.set(0, place.rotationY, 0)
      objetTemp.updateMatrix()
      mesh.setMatrixAt(i, objetTemp.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  // Placement initial avant la première peinture (sinon un instant à l'origine).
  useLayoutEffect(() => positionner(0), [places]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nombre de spectateurs réellement dessinés. On règle `count` plutôt que de
  // reconstruire l'InstancedMesh : les matrices et les couleurs déjà posées
  // restent valides, seule la borne de rendu change. Les places étant
  // générées dans un ordre mêlé, la tribune se garnit uniformément au lieu
  // de se remplir par bloc.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const part = REMPLISSAGE_INITIAL + (1 - REMPLISSAGE_INITIAL) * Math.min(1, Math.max(0, remplissage))
    mesh.count = Math.max(1, Math.round(places.length * part))
  }, [places, remplissage])

  useFrame((etat) => {
    if (animationReduite) return
    positionner(etat.clock.elapsedTime)
  })

  return (
    // Pas de `castShadow` : les 1 378 spectateurs représentent ~39 % des
    // triangles de la passe d'ombre, pour des ombres de capsules de 22 cm
    // projetées sur les gradins — jamais lisibles depuis les plans de
    // caméra du réalisateur (le plus proche est à 145 m). `receiveShadow`
    // n'a pas plus d'intérêt ici : rien ne surplombe les tribunes.
    <instancedMesh key={places.length} ref={ref} args={[undefined, undefined, places.length]}>
      <capsuleGeometry args={[0.22, 0.35, 4, 8]} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  )
}
