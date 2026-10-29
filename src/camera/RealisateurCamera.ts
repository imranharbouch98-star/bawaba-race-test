/**
 * Réalisateur de caméra — lit la machine (`machineCamera.ts`), calcule la
 * position/orientation de la caméra active à partir de `circuit3d.ts`, et
 * l'applique directement à chaque frame (même discipline impérative que
 * `Circuit3D.tsx` : jamais via le state React).
 *
 * Quatre plans (voir §2 du plan) :
 *  - aérien   : plan d'ensemble FIXE, toute la piste vue de côté.
 *  - embarqué : caméra embarquée derrière le leader actuel de la période.
 *  - spot     : plan latéral sur l'agent visé par l'événement en cours.
 *  - podium   : plan fixe cadrant la ligne d'arrivée.
 *
 * Cadrage vs. lissage : un changement de PLAN (ou de cible suivie) est une
 * coupe — la caméra apparaît directement dans le nouveau cadrage, comme au
 * montage. À l'intérieur d'un même plan, le sujet suivi (leader ou cible)
 * est lissé exactement comme un kart (`avancerVersCible`, même règle
 * « jamais de recul » sur l'avancement), donc la caméra glisse
 * naturellement avec lui plutôt que de sauter à chaque mise à jour.
 */

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera, Raycaster, Vector3, type Camera, type Object3D } from 'three'
import type { LigneClassement } from '../domain/classement'
import type { IdPiste, PisteCircuit, Vecteur3 } from '../domain/circuit3d'
import type { AgentId, EvenementCourse, Periode } from '../domain/types'
import type { EtatKart } from '../scene/Circuit3D'
import { avancerVersCible } from '../scene/lissageProgression'
import { CALQUE_OCCULTANT, NOM_PISTE_MODELE } from '../scene/calques'
import {
  ecrireAvantDepuisPose,
  ecrireDroiteDepuisPose,
  ecrireHautDepuisPose,
  ecrirePositionDepuisPose,
} from '../scene/transformPiste'
import {
  etatInitialCamera,
  evoluerCamera,
  type EtatMachineCamera,
  type PlanCamera,
  type TypePlan,
} from './machineCamera'

const TAU_SUIVI_PROGRESSION = 0.9
const TAU_SUIVI_VOIE = 0.6

const EMBARQUE_RECUL = 6.5
const EMBARQUE_HAUTEUR = 2.6
const EMBARQUE_REGARD_AVANT = 9

const SPOT_LATERAL = 8
const SPOT_HAUTEUR = 4
const SPOT_RECUL = 3

/**
 * Caméra DÉGAGÉE (29/10) : dans un virage serré contre une montagne, un
 * iceberg ou le flanc d'un gâteau, le décor se glissait entre la caméra et
 * le kart. Chaque image, on teste la ligne kart → caméra ; si le décor la
 * coupe, la caméra monte et se rapproche (paliers de `k`, 0 = cadrage
 * normal, 1 = haut et proche) jusqu'à revoir le kart. Montée vive, retour
 * lent : pas de pompage d'une image à l'autre.
 */
const PALIERS_DEGAGEMENT = [0, 0.25, 0.5, 0.75, 1]
const TAU_DEGAGEMENT_MONTEE = 0.12
const TAU_DEGAGEMENT_RETOUR = 0.9
/** Cadrage « dégagé » (k = 1) des plans embarqué et spot. */
const EMBARQUE_RECUL_DEGAGE = 3.5
const EMBARQUE_HAUTEUR_DEGAGEE = 10
const SPOT_LATERAL_DEGAGE = 2.5
const SPOT_HAUTEUR_DEGAGEE = 11
/** Point visé sur le kart (au-dessus du plancher) et marge laissée côté caméra. */
const HAUTEUR_VISEE = 1
const MARGE_RAYON = 0.4
/**
 * Dernier recours (aucun palier libre, ex. sous les surplombs de glace) :
 * la caméra est ramenée sur la ligne de visée, juste devant le décor —
 * jamais à moins de DISTANCE_MIN du kart.
 */
const DISTANCE_MIN = 2.5

interface Degagement {
  /** Niveau courant, lissé (un ref du hook : il survit d'une image à l'autre). */
  niveau: { current: number }
  dt: number
  /** Distance de `de` au premier décor sur le segment `de` → `vers` (Infinity s'il est libre). */
  obstacle: (de: Vector3, vers: Vector3) => number
}

/**
 * Plan aérien : la DISTANCE n'est plus une constante, elle est recalculée à
 * chaque image pour que la piste entière tienne dans le cadre (voir
 * `distanceAerienne`). Une distance fixe ne convenait qu'à une seule forme
 * de fenêtre : le champ vertical étant fixe, une vue plus haute que large
 * voyait moins loin sur les côtés et coupait les virages.
 *
 * Angle de plongée de la caméra — celui de l'ancien couple rayon 90 /
 * hauteur 80 (≈ 42°).
 */
const AERIEN_PLONGEE = Math.atan2(100, 80)
/** Marge autour de l'asphalte (m) : la plaque de nom des karts extérieurs. */
const AERIEN_MARGE = 4
/** Part du cadre occupée par la piste (1 = bord à bord). */
const AERIEN_REMPLISSAGE = 0.94
/**
 * Le plan aérien est FIXE : plus d'orbite (demande 15/10 — la rotation
 * continue distrayait). Angle 0 = vue de côté, la longue ligne droite à
 * l'horizontale ; le mouvement est porté par les plans qui suivent les karts.
 */
const AERIEN_ANGLE = 0

/** Contour d'une piste et point visé par le plan aérien. */
interface CadreAerien {
  /** Points des DEUX bords, relatifs à `cible`. */
  points: Vecteur3[]
  /** Centre du contour (hauteur comprise : la route du désert est à 17–37 m). */
  cible: Vecteur3
}

const CADRES = new Map<IdPiste, CadreAerien>()

/**
 * Les deux bords de la piste, échantillonnés une fois par piste. Les deux,
 * et plus seulement l'extérieur : sur un tracé sinueux, le bord « intérieur »
 * d'un virage peut être le point le plus excentré du circuit.
 */
function cadreDe(piste: PisteCircuit): CadreAerien {
  const enCache = CADRES.get(piste.id)
  if (enCache) return enCache
  const bords: Vecteur3[] = []
  for (let i = 0; i < 192; i++) {
    const s = (i / 192) * piste.longueurTour
    for (const cote of [-1, 1]) {
      bords.push(piste.pointSurPiste3D(s, cote * (piste.demiLargeurVoies + AERIEN_MARGE)).position)
    }
  }
  const borne = (axe: 'x' | 'y' | 'z') => {
    const valeurs = bords.map((p) => p[axe])
    return (Math.min(...valeurs) + Math.max(...valeurs)) / 2
  }
  const cible = { x: borne('x'), y: borne('y'), z: borne('z') }
  const cadre = {
    points: bords.map((p) => ({ x: p.x - cible.x, y: p.y - cible.y, z: p.z - cible.z })),
    cible,
  }
  CADRES.set(piste.id, cadre)
  return cadre
}

/**
 * Plus petite distance (depuis le centre) à laquelle la caméra aérienne voit
 * tout le contour de la piste, pour un angle d'orbite et une forme de vue
 * donnés.
 *
 * Calcul exact, sans itération : quand la caméra recule le long de son axe
 * de visée, les coordonnées latérale et verticale d'un point ne changent
 * pas, seule sa profondeur augmente. Chaque point impose donc une distance
 * minimale, `|x| / tan(demi-champ) − profondeur`, et on retient la plus
 * grande. Varie continûment avec l'angle : la caméra « respire » en douceur
 * pendant l'orbite (plus près quand la piste est vue par le bout).
 */
function distanceAerienne(cadre: CadreAerien, angle: number, tanDemiChampV: number, aspect: number): number {
  const sA = Math.sin(angle)
  const cA = Math.cos(angle)
  const sP = Math.sin(AERIEN_PLONGEE)
  const cP = Math.cos(AERIEN_PLONGEE)
  const tanV = tanDemiChampV * AERIEN_REMPLISSAGE
  const tanH = tanDemiChampV * aspect * AERIEN_REMPLISSAGE

  let distance = 0
  for (const p of cadre.points) {
    // Base de la caméra : droite (cA, 0, −sA), haut (−sA·sP, cP, −cA·sP),
    // visée (−sA·cP, −sP, −cA·cP) — vers le centre du circuit.
    const x = p.x * cA - p.z * sA
    const y = -p.x * sA * sP + p.y * cP - p.z * cA * sP
    const profondeur = -p.x * sA * cP - p.y * sP - p.z * cA * cP
    distance = Math.max(distance, Math.abs(x) / tanH - profondeur, Math.abs(y) / tanV - profondeur)
  }
  return distance
}

/** Place la caméra aérienne sur son orbite, à la distance qui cadre toute la piste. */
function placerAerien(
  camera: { position: Vector3; lookAt: (x: number, y: number, z: number) => void },
  piste: PisteCircuit,
  angle: number,
  tanDemiChampV: number,
  aspect: number,
) {
  const cadre = cadreDe(piste)
  const { cible } = cadre
  const distance = distanceAerienne(cadre, angle, tanDemiChampV, aspect)
  const horizontal = Math.cos(AERIEN_PLONGEE) * distance
  camera.position.set(
    cible.x + Math.sin(angle) * horizontal,
    cible.y + Math.sin(AERIEN_PLONGEE) * distance,
    cible.z + Math.cos(angle) * horizontal,
  )
  camera.lookAt(cible.x, cible.y, cible.z)
}

const PODIUM_LATERAL = 4
const PODIUM_HAUTEUR = 11
const PODIUM_RECUL = 20

interface ProprietesRealisateur {
  lignes: LigneClassement[]
  evenements: EvenementCourse[]
  periode: Periode
  animationReduite: boolean
  /** Positions affichées des karts (écrites par `Circuit3D`). */
  positionsKarts?: { current: ReadonlyMap<string, EtatKart> }
  /** Piste affichée : cadrage aérien, plans embarqués, ligne d'arrivée. */
  piste: PisteCircuit
  /** Kart choisi dans la liste : la caméra le suit tant qu'il est défini. */
  agentSuivi?: AgentId | null
}

interface EtatSuivi {
  avancement: number
  voie: number
  /** Hauteur de saut du kart suivi (m) : la caméra monte avec lui. */
  hauteur: number
}

/** Cadrage du suivi manuel : la caméra embarquée, derrière le kart choisi. */
const PLAN_SUIVI_MANUEL: PlanCamera = { type: 'embarque', expireA: 0 }

function trouverLigne(lignes: LigneClassement[], agentId: AgentId | undefined) {
  return agentId ? lignes.find((ligne) => ligne.agent.id === agentId) : undefined
}

/** Cible dynamique du plan courant : le leader pour « embarqué », la cible fixée pour « spot ». */
function cibleDuPlan(plan: PlanCamera, lignes: LigneClassement[]): AgentId | undefined {
  if (plan.type === 'embarque') return lignes[0]?.agent.id
  if (plan.type === 'spot') return plan.cibleAgentId
  return undefined
}

export function useRealisateurCamera({
  lignes,
  evenements,
  periode,
  animationReduite,
  positionsKarts,
  agentSuivi = null,
  piste,
}: ProprietesRealisateur) {
  const camera = useThree((etat) => etat.camera)

  const machine = useRef<EtatMachineCamera | null>(null)
  const typeApplique = useRef<TypePlan | null>(null)
  const agentApplique = useRef<AgentId | undefined>(undefined)
  const suivi = useRef<EtatSuivi>({ avancement: 0, voie: 1, hauteur: 0 })

  // Rayons « le décor cache-t-il le kart ? », contre le seul modèle de piste
  // (calque CALQUE_OCCULTANT, index BVH — voir `PisteModele`).
  const scene = useThree((etat) => etat.scene)
  const piste3D = useRef<Object3D | null>(null)
  const niveauDegagement = useRef(0)

  const dernierIdEvenement = useRef<string | null>(null)
  const evenementsEnAttente = useRef<EvenementCourse[]>([])
  const periodePrecedente = useRef(periode)
  const changementPeriodeEnAttente = useRef(false)

  // Détecte les nouveaux événements de course — ne tourne qu'à l'arrivée
  // d'un nouvel instantané (pas à chaque frame).
  useEffect(() => {
    if (evenements.length === 0) return
    const idPlusRecent = evenements[0].id

    if (dernierIdEvenement.current === null) {
      // Premier instantané : on ne rejoue pas un historique déjà ancien.
      dernierIdEvenement.current = idPlusRecent
      return
    }
    if (idPlusRecent === dernierIdEvenement.current) return

    const nouveaux: EvenementCourse[] = []
    for (const evenement of evenements) {
      if (evenement.id === dernierIdEvenement.current) break
      nouveaux.push(evenement)
    }
    dernierIdEvenement.current = idPlusRecent
    // `evenements` est du plus récent au plus ancien : on remet les nouveaux
    // dans l'ordre chronologique avant de les rejouer.
    evenementsEnAttente.current.push(...nouveaux.reverse())
  }, [evenements])

  useEffect(() => {
    if (periodePrecedente.current !== periode) {
      changementPeriodeEnAttente.current = true
      periodePrecedente.current = periode
    }
  }, [periode])

  useFrame((etatR3F, dtBrut) => {
    const dt = Math.min(0.1, Math.max(0, dtBrut))
    const maintenant = etatR3F.clock.elapsedTime * 1000
    // Le modèle de piste peut changer (chargement, remontage) : on le retrouve au besoin.
    if (!piste3D.current?.parent) piste3D.current = scene.getObjectByName(NOM_PISTE_MODELE) ?? null
    const racine = piste3D.current
    const vue: Degagement = {
      niveau: niveauDegagement,
      dt,
      obstacle: (de, vers) => (racine ? decorEntre(racine, de, vers) : Infinity),
    }

    if (!machine.current) machine.current = etatInitialCamera(maintenant)

    if (animationReduite) {
      // Plan fixe, sans coupe ni dérive — équivalent 3D du décor figé 2D.
      // La file d'événements doit quand même être vidée : le `useEffect`
      // continue de l'alimenter tant que des instantanés arrivent, et un
      // retour anticipé sans purge la faisait croître sans borne (~15/min,
      // soit ~7 200 sur une journée de kiosque). Pire, une levée de
      // `prefers-reduced-motion` en cours de session aurait rejoué tout
      // l'arriéré en une seule frame.
      evenementsEnAttente.current.length = 0
      changementPeriodeEnAttente.current = false
      // Le même plan aérien fixe, sans les coupes vers les autres plans.
      const { tanDemiChampV, aspect } = champDeVue(camera)
      placerAerien(camera, piste, AERIEN_ANGLE, tanDemiChampV, aspect)
      return
    }

    if (changementPeriodeEnAttente.current) {
      machine.current = evoluerCamera(machine.current, { nature: 'reinitialisation', maintenant })
      changementPeriodeEnAttente.current = false
    }

    if (evenementsEnAttente.current.length > 0) {
      for (const evenement of evenementsEnAttente.current) {
        machine.current = evoluerCamera(machine.current, { nature: 'evenement', evenement, maintenant })
      }
      evenementsEnAttente.current = []
    }

    machine.current = evoluerCamera(machine.current, { nature: 'tick', maintenant })

    // Kart choisi dans la liste : la caméra se place derrière lui et le
    // suit, quel que soit le plan du réalisateur. La machine continue de
    // tourner en coulisse ; `typeApplique` remis à null garantit une coupe
    // propre vers son plan courant quand le suivi se termine.
    const suiviManuel = agentSuivi ? positionsKarts?.current.get(agentSuivi) : undefined
    if (suiviManuel) {
      suivi.current.avancement = suiviManuel.affiche ?? suiviManuel.valeur
      suivi.current.voie = suiviManuel.voie
      suivi.current.hauteur = suiviManuel.hauteur ?? 0
      typeApplique.current = null
      cadrer(PLAN_SUIVI_MANUEL, suivi.current, camera, piste, vue)
      return
    }

    const plan = machine.current.planActuel
    const cible = cibleDuPlan(plan, lignes)
    const coupe = typeApplique.current !== plan.type || agentApplique.current !== cible

    if (coupe) {
      typeApplique.current = plan.type
      agentApplique.current = cible
      if (plan.type === 'embarque' || plan.type === 'spot') {
        const ligne = trouverLigne(lignes, cible)
        if (ligne) suivi.current = { avancement: ligne.avancement, voie: ligne.voie, hauteur: 0 }
      }
    }

    if (plan.type === 'embarque' || plan.type === 'spot') {
      const ligne = trouverLigne(lignes, cible)
      // Le kart tel qu'il est DESSINÉ : il rejoint les données en roulant,
      // plusieurs secondes après elles — suivre `ligne.avancement` placerait
      // la caméra embarquée devant lui. Sa position affichée est déjà lisse
      // et ne recule jamais : on la reprend telle quelle.
      const affiche = cible ? positionsKarts?.current.get(cible) : undefined
      if (affiche) {
        suivi.current.avancement = affiche.affiche ?? affiche.valeur
        suivi.current.voie = affiche.voie
        suivi.current.hauteur = affiche.hauteur ?? 0
      } else if (ligne) {
        // Même règle que les karts : la cible suivie par la caméra ne recule
        // jamais au sein d'une même période.
        suivi.current.avancement = avancerVersCible(
          suivi.current.avancement,
          ligne.avancement,
          dt,
          TAU_SUIVI_PROGRESSION,
          true,
        )
        suivi.current.voie = avancerVersCible(suivi.current.voie, ligne.voie, dt, TAU_SUIVI_VOIE, false)
      }
    }

    cadrer(plan, suivi.current, camera, piste, vue)
  })
}

// Tampons de cadrage, réutilisés d'une image à l'autre — `cadrer` tourne à
// chaque image et allouait auparavant une douzaine de vecteurs par appel.
const tamponPosition = new Vector3()
const tamponAvant = new Vector3()
const tamponHaut = new Vector3()
const tamponDroite = new Vector3()
const tamponRegard = new Vector3()
const tamponVisee = new Vector3()
const tamponEssai = new Vector3()
const tamponDirection = new Vector3()
const rayonOcclusion = new Raycaster()
rayonOcclusion.layers.set(CALQUE_OCCULTANT)
rayonOcclusion.firstHitOnly = true

/** Distance au premier décor de la piste (`racine`) sur le segment `de` → `vers`, Infinity s'il est libre. */
function decorEntre(racine: Object3D, de: Vector3, vers: Vector3): number {
  tamponDirection.subVectors(vers, de)
  const distance = tamponDirection.length()
  if (distance < MARGE_RAYON) return Infinity
  rayonOcclusion.set(de, tamponDirection.divideScalar(distance))
  rayonOcclusion.far = distance - MARGE_RAYON
  return rayonOcclusion.intersectObject(racine, true)[0]?.distance ?? Infinity
}

/**
 * Place la caméra au cadrage `position(k)` le moins dégagé qui voit le kart
 * (`visee`), en lissant `k` — voir PALIERS_DEGAGEMENT.
 */
function placerDegage(
  camera: Camera,
  visee: Vector3,
  position: (k: number, sortie: Vector3) => Vector3,
  vue: Degagement | undefined,
) {
  if (vue) {
    let voulu = 1
    for (const k of PALIERS_DEGAGEMENT) {
      if (vue.obstacle(visee, position(k, tamponEssai)) === Infinity) {
        voulu = k
        break
      }
    }
    const niveau = vue.niveau
    const tau = voulu > niveau.current ? TAU_DEGAGEMENT_MONTEE : TAU_DEGAGEMENT_RETOUR
    niveau.current += (voulu - niveau.current) * (1 - Math.exp(-vue.dt / tau))
  }
  position(vue?.niveau.current ?? 0, camera.position)

  // Bras-ressort : si le décor coupe encore la vue (paliers tous bouchés, ou
  // retour lissé pas encore arrivé), la caméra avance sur la ligne de visée
  // jusque devant lui — le kart n'est jamais caché.
  const coupe = vue ? vue.obstacle(visee, camera.position) : Infinity
  if (coupe !== Infinity) {
    tamponEssai.subVectors(camera.position, visee).normalize()
    camera.position.copy(visee).addScaledVector(tamponEssai, Math.max(DISTANCE_MIN, coupe - MARGE_RAYON))
  }
}

/**
 * Champ de vue courant. R3F tient `aspect` à jour au redimensionnement du
 * canvas — c'est lui qui fait suivre le cadrage à la forme de la fenêtre.
 */
function champDeVue(camera: Camera): { tanDemiChampV: number; aspect: number } {
  if (camera instanceof PerspectiveCamera) {
    return { tanDemiChampV: Math.tan(MathUtils.degToRad(camera.fov) / 2), aspect: camera.aspect }
  }
  return { tanDemiChampV: Math.tan(MathUtils.degToRad(48) / 2), aspect: 16 / 9 }
}

function cadrer(plan: PlanCamera, suivi: EtatSuivi, camera: Camera, piste: PisteCircuit, vue?: Degagement) {
  switch (plan.type) {
    case 'aerien': {
      const { tanDemiChampV, aspect } = champDeVue(camera)
      placerAerien(camera, piste, AERIEN_ANGLE, tanDemiChampV, aspect)
      return
    }

    case 'embarque': {
      const pose = piste.positionKartTours(suivi.avancement, suivi.voie)
      ecrirePositionDepuisPose(pose, tamponPosition)
      tamponPosition.y += suivi.hauteur
      ecrireAvantDepuisPose(pose, tamponAvant)
      ecrireHautDepuisPose(pose, tamponHaut)

      tamponVisee.copy(tamponPosition).addScaledVector(tamponHaut, HAUTEUR_VISEE)
      placerDegage(camera, tamponVisee, (k, sortie) =>
        sortie
          .copy(tamponPosition)
          .addScaledVector(tamponAvant, -MathUtils.lerp(EMBARQUE_RECUL, EMBARQUE_RECUL_DEGAGE, k))
          .addScaledVector(tamponHaut, MathUtils.lerp(EMBARQUE_HAUTEUR, EMBARQUE_HAUTEUR_DEGAGEE, k)),
      vue)

      tamponRegard.copy(tamponPosition).addScaledVector(tamponAvant, EMBARQUE_REGARD_AVANT)
      camera.lookAt(tamponRegard.x, tamponRegard.y, tamponRegard.z)
      return
    }

    case 'spot': {
      const pose = piste.positionKartTours(suivi.avancement, suivi.voie)
      ecrirePositionDepuisPose(pose, tamponPosition)
      tamponPosition.y += suivi.hauteur
      ecrireAvantDepuisPose(pose, tamponAvant)
      ecrireHautDepuisPose(pose, tamponHaut)
      ecrireDroiteDepuisPose(pose, tamponDroite)

      tamponVisee.copy(tamponPosition).addScaledVector(tamponHaut, HAUTEUR_VISEE)
      placerDegage(camera, tamponVisee, (k, sortie) =>
        sortie
          .copy(tamponPosition)
          .addScaledVector(tamponDroite, MathUtils.lerp(SPOT_LATERAL, SPOT_LATERAL_DEGAGE, k))
          .addScaledVector(tamponHaut, MathUtils.lerp(SPOT_HAUTEUR, SPOT_HAUTEUR_DEGAGEE, k))
          .addScaledVector(tamponAvant, -SPOT_RECUL),
      vue)

      tamponRegard.copy(tamponPosition).addScaledVector(tamponHaut, 0.6)
      camera.lookAt(tamponRegard.x, tamponRegard.y, tamponRegard.z)
      return
    }

    case 'podium': {
      // La ligne d'arrivée est à l'abscisse 0 depuis le passage aux tours —
      // c'est la même que la ligne de départ. Cadrer `ABSCISSE_ARRIVEE`
      // pointerait un endroit du circuit où plus rien n'est dessiné.
      const pose = piste.pointSurPiste3D(0)
      ecrirePositionDepuisPose(pose, tamponPosition)
      ecrireAvantDepuisPose(pose, tamponAvant)
      ecrireHautDepuisPose(pose, tamponHaut)
      ecrireDroiteDepuisPose(pose, tamponDroite)

      camera.position
        .copy(tamponPosition)
        .addScaledVector(tamponDroite, PODIUM_LATERAL)
        .addScaledVector(tamponHaut, PODIUM_HAUTEUR)
        .addScaledVector(tamponAvant, -PODIUM_RECUL)

      camera.lookAt(tamponPosition.x, tamponPosition.y + 1, tamponPosition.z)
      return
    }
  }
}

/** Composant-pont : `useFrame` doit tourner à l'intérieur du `<Canvas>`. */
export function Realisateur(proprietes: ProprietesRealisateur) {
  useRealisateurCamera(proprietes)
  return null
}
