/**
 * Moteur de course 3D — assemble la piste, le décor et les karts, puis anime
 * ces derniers image par image via `useFrame`.
 *
 * Même discipline que le moteur 2D (`Circuit.tsx` de race-pulse) : les
 * positions sont écrites directement sur les objets Three.js (refs), jamais
 * via le state React, pour tourner en continu sans reconciliation inutile.
 * La règle « un kart ne recule jamais » est portée telle quelle (voir
 * `scene/lissageProgression.ts`).
 */

import { Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Object3D } from 'three'
import type { LigneClassement } from '../domain/classement'
import type { PisteCircuit, PosePiste3D } from '../domain/circuit3d'
import type { CommandePilote } from '../hooks/usePiloteInvite'
import { etiquetteVisible, type ModeEtiquettes } from './modeEtiquettes'
import {
  appliquerInstantanement,
  avancerVersCible,
  glisserVersCible,
  type EtatGlisse,
} from './lissageProgression'
import { ecrirePositionDepuisPose, ecrireQuaternionDepuisPose } from './transformPiste'
import { creerEtatFigure, figurer, horsDesSauts, type EtatFigure, type Figure } from './figuresKart'
import { Piste3D } from './Piste3D'
import { PisteModele } from './PisteModele'
import { KartRacePulse } from './KartRacePulse'
import { VehiculeNiveau, vehiculeModelise } from './VehiculeNiveau'

type ProprietesVehiculeAgent = Parameters<typeof KartRacePulse>[0] & { vehiculeId?: string }

/**
 * Le véhicule d'un agent : son achat du garage s'il en a un (modèle chargé à
 * la demande — le kart le remplace le temps du téléchargement, jamais un
 * emplacement vide), sinon le kart de départ teint à sa couleur.
 */
function VehiculeAgent({ vehiculeId, ...proprietes }: ProprietesVehiculeAgent) {
  if (!vehiculeId || !vehiculeModelise(vehiculeId)) return <KartRacePulse {...proprietes} />
  return (
    <Suspense fallback={<KartRacePulse {...proprietes} />}>
      <VehiculeNiveau id={vehiculeId} {...proprietes} />
    </Suspense>
  )
}

/**
 * Roulage des karts (voir `glisserVersCible`) : la distance restante est
 * couverte en ~`DUREE_GLISSE` s — l'ordre de l'intervalle entre deux mises à
 * jour (API : 10 s, simulateur : 8–15 s) — avec des accélérations lissées
 * sur `TAU_VITESSE` s. Résultat : un peloton qui roule en continu au lieu
 * d'un sprint de 2 s suivi d'un arrêt à chaque mise à jour.
 */
const DUREE_GLISSE = 8
const TAU_VITESSE = 1.6
/** Changement de voie des karts classés : lent, comme un déboîtement. */
const TAU_VOIE_KART = 1.4
/** Le kart invité, lui, répond au clavier : changement de voie vif. */
const TAU_VOIE = 0.55

/** Vitesse du kart invité, en unités de piste (mètres) par seconde. */
const VITESSE_PILOTE = 24
const MULTIPLICATEUR_BOOST = 2.6

/**
 * Chute d'avancement traitée comme une nouvelle période plutôt qu'un recul,
 * exprimée en tours. Un changement de journée ramène l'avancement de
 * plusieurs tours à presque zéro, donc très au-delà de ce seuil ; une simple
 * correction de score à la baisse reste, elle, bien en deçà.
 */
const SEUIL_NOUVELLE_PERIODE = 0.5

/**
 * Position AFFICHÉE d'un kart — partagée avec le réalisateur de caméra, qui
 * doit filmer le kart là où il est dessiné, pas là où les données le
 * placent (il y arrive en roulant, quelques secondes plus tard).
 */
export interface EtatKart extends EtatGlisse {
  /**
   * `valeur` : abscisse affichée, en tours, recul de grille COMPRIS
   * (`avancement − recul / longueurTour`). Le recul n'est plus lissé à part :
   * fondu dans la même grandeur, il est soumis lui aussi à « jamais en
   * arrière » — un kart qui rejoint une grille d'ex æquo ralentit au lieu de
   * reculer.
   */
  voie: number
  /**
   * Abscisse réellement DESSINÉE (en tours) : `valeur`, sauf au bord d'un
   * saut (le kart attend au décollage) et en vol (voir `figuresKart`). C'est
   * elle que filme la caméra.
   */
  affiche?: number
  /** Hauteur de saut ajoutée au-dessus de la piste (m) — la caméra suit l'arc. */
  hauteur?: number
}

/** Numéro stable d'un agent — varie les figures d'un kart à l'autre. */
function numeroDe(id: string): number {
  let h = 0
  for (const caractere of id) h = (h * 31 + caractere.charCodeAt(0)) >>> 0
  return h
}

/** La carrosserie d'un kart (`caisse`), retrouvée une fois puis gardée. */
function caisseDe(groupe: Group, cache: Map<Group, Object3D>): Object3D | null {
  const connue = cache.get(groupe)
  // Le véhicule peut changer (achat, chargement) : on vérifie qu'elle y est encore.
  if (connue) {
    for (let parent = connue.parent; parent; parent = parent.parent) if (parent === groupe) return connue
  }
  const trouvee = groupe.getObjectByName('caisse') ?? null
  if (trouvee) cache.set(groupe, trouvee)
  else cache.delete(groupe)
  return trouvee
}

/**
 * Roues mobiles d'un véhicule : nœuds `Roue_<n>` (pivot sur l'axe) portant leur
 * rayon en `userData.rayon` — découpés par `scripts/preparer-vehicules.mjs`.
 * Retrouvées une fois par véhicule affiché : la liste est liée au modèle
 * (premier enfant du groupe), qui change quand le kart de remplacement cède
 * la place au véhicule chargé, ou après un achat.
 */
function rouesDe(groupe: Group, cache: Map<Group, { modele: Object3D | undefined; roues: Object3D[] }>): Object3D[] {
  const modele = groupe.children[0]
  const connu = cache.get(groupe)
  if (connu && connu.modele === modele) return connu.roues
  const roues: Object3D[] = []
  groupe.traverse((objet) => {
    if (typeof objet.userData.rayon === 'number' && /^Roue_d+$/.test(objet.name)) roues.push(objet)
  })
  cache.set(groupe, { modele, roues })
  return roues
}

/** Fait rouler les roues : rotation = distance parcourue ÷ rayon (avant +X, essieu Z). */
function tournerRoues(roues: Object3D[], distance: number) {
  for (const roue of roues) roue.rotation.z -= distance / (roue.userData.rayon as number)
}

/** Hauteur, vrille, dérapage et écrasement d'une figure, par-dessus la pose de piste. */
function appliquerFigure(groupe: Group, caisse: Object3D | null, figure: Figure) {
  groupe.position.y += figure.hauteur
  if (!caisse) return
  caisse.rotation.set(figure.roulis, figure.lacet, figure.tangage, 'YZX')
  const etalement = 1 + (1 - figure.ecrasement) * 0.5
  caisse.scale.set(etalement, figure.ecrasement, etalement)
}

/** Où un kart doit être dessiné, d'après les données de course. */
function abscisseCible(ligne: LigneClassement, piste: PisteCircuit): number {
  return ligne.avancement - ligne.reculGrille / piste.longueurTour
}

interface ProprietesCircuit3D {
  lignes: LigneClassement[]
  animationReduite: boolean
  /** Agents dont la traînée de boost est momentanément visible. */
  boosts: ReadonlySet<string>
  /** Sentinelle de performance : flammes de boost coupées au même palier que le post-traitement. */
  flammesActives: boolean
  modeEtiquettes: ModeEtiquettes
  piloteActif: boolean
  piloteBoost: boolean
  commandePilote: { current: CommandePilote }
  /** Positions affichées, écrites ici à chaque image et lues par la caméra. */
  positionsKarts: { current: Map<string, EtatKart> }
  /** Kart choisi dans la liste — sa plaque ressort, les autres s'effacent. */
  selection: string | null
  /** Modèle de piste complet — sinon la piste procédurale légère. */
  pisteDetaillee: boolean
  /** Véhicule choisi au garage, par agent (absent = le kart de départ). */
  vehicules?: ReadonlyMap<string, string>
  /** Piste choisie : tracé suivi par les karts ET modèle affiché. */
  piste: PisteCircuit
}

export function Circuit3D({
  lignes,
  animationReduite,
  boosts,
  flammesActives,
  modeEtiquettes,
  piloteActif,
  piloteBoost,
  commandePilote,
  positionsKarts,
  selection,
  pisteDetaillee,
  piste,
  vehicules,
}: ProprietesCircuit3D) {
  const registre = useRef(new Map<string, Group>())
  const piloteRef = useRef<Group | null>(null)
  const etats = positionsKarts
  const etatPilote = useRef({ s: 0, voie: 1 })
  const cibles = useRef(lignes)
  const avancementMaximalPrecedent = useRef(0)
  const figures = useRef(new Map<string, EtatFigure>())
  const caisses = useRef(new Map<Group, Object3D>())
  const roues = useRef(new Map<Group, { modele: Object3D | undefined; roues: Object3D[] }>())
  // Dernière abscisse dessinée, par kart : la distance de l'image fait tourner les roues.
  const dernieresAbscisses = useRef(new Map<string, number>())
  // Flammes allumées par la piste (saut, pad d'accélération) : un état React,
  // mais qui ne change qu'à l'entrée ou la sortie d'une figure.
  const [flammesPiste, setFlammesPiste] = useState<ReadonlySet<string>>(() => new Set())
  const flammesPisteRef = useRef(flammesPiste)

  // Survolé à la souris — n'a de sens qu'en mode « au survol », et ne coûte
  // rien sinon : R3F ne lance un rayon que sur événement de pointeur, jamais
  // à chaque image.
  const [survole, setSurvole] = useState<string | null>(null)

  const positionner = useCallback((groupe: Group | null, pose: PosePiste3D) => {
    if (!groupe) return
    // Écriture directe dans les objets du groupe : ni allocation ni copie
    // intermédiaire. Appelé trente fois par image, c'est le point le plus
    // chaud de la boucle de course.
    ecrirePositionDepuisPose(pose, groupe.position)
    ecrireQuaternionDepuisPose(pose, groupe.quaternion)
  }, [])

  const referencerKart = useCallback(
    (id: string) => (element: Group | null) => {
      if (element) registre.current.set(id, element)
      else registre.current.delete(id)
    },
    [],
  )

  // Placement instantané des nouvelles cibles en mode animations réduites.
  useLayoutEffect(() => {
    cibles.current = lignes

    // Nouvelle période : détectée au niveau du PELOTON, pas kart par kart.
    //
    // Un changement de journée remet tous les scores à zéro en même temps.
    // Testé individuellement, un agent resté sous un demi-tour ne chutait pas
    // assez pour franchir le seuil : la règle « jamais de recul » figeait son
    // kart là où il était, jusqu'à ce que son score du lendemain repasse
    // au-dessus. Le meneur, lui, chute toujours de plusieurs tours — c'est
    // donc lui qui donne le signal, pour tout le monde.
    const avancementMaximal = lignes.reduce((max, ligne) => Math.max(max, ligne.avancement), 0)
    if (avancementMaximal < avancementMaximalPrecedent.current - SEUIL_NOUVELLE_PERIODE) {
      for (const ligne of lignes) {
        const etat = etats.current.get(ligne.agent.id)
        if (etat) {
          etat.valeur = abscisseCible(ligne, piste)
          etat.vitesse = 0
        }
      }
    }
    avancementMaximalPrecedent.current = avancementMaximal

    if (!animationReduite) return
    for (const ligne of lignes) {
      const id = ligne.agent.id
      let etat = etats.current.get(id)
      if (!etat) {
        etat = { valeur: abscisseCible(ligne, piste), vitesse: 0, voie: ligne.voie }
        etats.current.set(id, etat)
      }
      etat.valeur = appliquerInstantanement(abscisseCible(ligne, piste), etat.valeur, true)
      etat.vitesse = 0
      etat.voie = ligne.voie
      etat.affiche = horsDesSauts(piste, etat.valeur, abscisseCible(ligne, piste))
      positionner(registre.current.get(id) ?? null, piste.positionKartTours(etat.affiche, etat.voie))
    }
  }, [lignes, animationReduite, positionner, etats, piste])

  useFrame((_etatR3F, dtBrut) => {
    const dt = Math.min(0.1, Math.max(0, dtBrut))
    const flammesAllumees = new Set<string>()

    for (const ligne of cibles.current) {
      const id = ligne.agent.id
      let etat = etats.current.get(id)
      if (!etat) {
        etat = { valeur: abscisseCible(ligne, piste), vitesse: 0, voie: ligne.voie }
        etats.current.set(id, etat)
      }

      if (animationReduite) {
        etat.affiche = horsDesSauts(piste, etat.valeur, abscisseCible(ligne, piste))
        positionner(registre.current.get(id) ?? null, piste.positionKartTours(etat.affiche, etat.voie))
        continue
      }

      // La bascule de journée est traitée en amont, à l'arrivée des nouvelles
      // cibles (voir le `useLayoutEffect`) : ici il ne reste que la règle de
      // course, « un kart ne recule jamais » — portée par `glisserVersCible`.
      const cible = abscisseCible(ligne, piste)
      glisserVersCible(etat, cible, dt, DUREE_GLISSE, TAU_VITESSE)
      etat.voie = avancerVersCible(etat.voie, ligne.voie, dt, TAU_VOIE_KART, false)

      // Ce que la piste fait faire au kart : sauts, glace, pad d'accélération.
      let etatFigure = figures.current.get(id)
      if (!etatFigure) {
        etatFigure = creerEtatFigure()
        figures.current.set(id, etatFigure)
      }
      const figure = figurer(etatFigure, piste, etat.valeur, cible, dt, numeroDe(id))
      etat.affiche = figure.valeur
      etat.hauteur = figure.hauteur
      if (figure.flammes) flammesAllumees.add(id)

      const groupe = registre.current.get(id) ?? null
      positionner(groupe, piste.positionKartTours(figure.valeur, etat.voie))
      if (groupe) {
        appliquerFigure(groupe, caisseDe(groupe, caisses.current), figure)
        const precedente = dernieresAbscisses.current.get(id) ?? figure.valeur
        const distance = (figure.valeur - precedente) * piste.longueurTour
        dernieresAbscisses.current.set(id, figure.valeur)
        // Un saut de plus d'un demi-tour = nouvelle période, pas une distance roulée.
        if (Math.abs(distance) < piste.longueurTour / 2) tournerRoues(rouesDe(groupe, roues.current), distance)
      }
    }

    // Flammes de piste : React n'est sollicité que si l'ensemble a changé.
    const precedentes = flammesPisteRef.current
    if (
      flammesAllumees.size !== precedentes.size ||
      [...flammesAllumees].some((id) => !precedentes.has(id))
    ) {
      flammesPisteRef.current = flammesAllumees
      setFlammesPiste(flammesAllumees)
    }

    if (piloteActif && piloteRef.current) {
      const commande = commandePilote.current
      const boost = performance.now() < commande.boostJusqua ? MULTIPLICATEUR_BOOST : 1
      const pilote = etatPilote.current
      // Le pilote n'a pas d'objectif : on l'avance directement en abscisse
      // curviligne, à vitesse constante, plutôt qu'en tours d'objectif.
      pilote.s = (pilote.s + VITESSE_PILOTE * boost * dt) % piste.longueurTour
      pilote.voie = avancerVersCible(pilote.voie, commande.voie, dt, TAU_VOIE, false)
      positionner(piloteRef.current, piste.pointSurPiste3D(pilote.s, piste.decalageVoie(pilote.voie)))
      const saut = piste.zoneEn(pilote.s, 'saut')
      if (saut) {
        const u = (pilote.s - saut.debut) / (saut.fin - saut.debut)
        piloteRef.current.position.y += saut.hauteur * 4 * u * (1 - u)
      }
    }
  })

  return (
    <group>
      {/* La piste Fab en qualité normale ; au palier « 3D minimale », la
          piste procédurale (un ruban le long du MÊME tracé, quelques draw
          calls) remplace ses ~220 000 triangles. */}
      {/* Suspense PROPRE au modèle : au changement de piste, le nouveau
          modèle se charge sans faire disparaître les karts (ils restent sur
          leur avancement, seul le décor change). */}
      {pisteDetaillee ? (
        <Suspense fallback={null}>
          <PisteModele id={piste.id} />
        </Suspense>
      ) : (
        <Piste3D piste={piste} />
      )}

      {lignes.map((ligne) => {
        const boost = boosts.has(ligne.agent.id) || flammesPiste.has(ligne.agent.id)
        return (
          <group
            key={ligne.agent.id}
            ref={referencerKart(ligne.agent.id)}
            onPointerOver={
              modeEtiquettes === 'survol' ? () => setSurvole(ligne.agent.id) : undefined
            }
            onPointerOut={
              modeEtiquettes === 'survol'
                ? () => setSurvole((actuel) => (actuel === ligne.agent.id ? null : actuel))
                : undefined
            }
          >
            <VehiculeAgent
              vehiculeId={vehicules?.get(ligne.agent.id)}
              couleur={ligne.agent.couleur}
              nom={ligne.agent.nom}
              initiales={ligne.agent.initiales}
              rang={ligne.rang}
              total={lignes.length}
              selectionne={selection === ligne.agent.id}
              attenue={selection !== null && selection !== ligne.agent.id}
              miseEnAvant={ligne.rang === 1 || boost}
              etiquetteVisible={etiquetteVisible(modeEtiquettes, survole === ligne.agent.id)}
              boost={boost}
              flammesActives={flammesActives}
            />
          </group>
        )
      })}

      {piloteActif && (
        <group ref={piloteRef}>
          <KartRacePulse
            couleur="#22d3ee"
            boost={piloteBoost}
            flammesActives={flammesActives}
            invite
          />
        </group>
      )}
    </group>
  )
}
