/**
 * Géométrie 3D du circuit — moteur de course, partie « piste ».
 *
 * Fork de race-pulse (2D) — src/domain/circuit.ts, à l'origine un ovale de
 * stade analytique. Depuis les pistes modélisées, le tracé n'est plus une
 * formule : c'est la LIGNE MÉDIANE de la route du modèle, extraite par un
 * script dans un fichier généré.
 *
 * Une piste est un objet `PisteCircuit` autonome (longueur de tour, largeur
 * de voie, repère en tout point). Le score, lui, ne dépend d'aucune piste :
 * un kart est placé par son AVANCEMENT en tours (`positionKartTours`) —
 * changer de piste ne change la place de personne dans le tour. Depuis le
 * 29/10, une seule piste : le circuit « snoep » (bonbons) ; la forêt (Fab)
 * et le désert ont été retirés.
 *
 * Comme l'actuel `domain/`, ce fichier n'importe aucun type Three.js : il ne
 * renvoie que des vecteurs bruts `{x,y,z}`. C'est la couche de rendu qui
 * construit un THREE.Quaternion à partir de la base orthonormée renvoyée ici.
 */

import * as TraceSnoep from './tracePisteSnoep'

export interface GeometrieCircuit3D {
  nombreVoies: number
}

/**
 * Nommé `CIRCUIT` (et non `CIRCUIT_3D`) : `classement.ts` en importe
 * `nombreVoies` sous ce nom, hérité de la 2D. Commun à TOUTES les pistes —
 * la voie d'un kart (rang % 4) ne change donc pas d'une piste à l'autre ;
 * seule la LARGEUR des voies est propre à chaque piste.
 */
export const CIRCUIT: GeometrieCircuit3D = {
  nombreVoies: 4,
}

/** Un vecteur brut — le domaine n'importe aucun type Three.js. */
export interface Vecteur3 {
  x: number
  y: number
  z: number
}

/** Repère complet en un point de la piste. */
export interface PosePiste3D {
  position: Vecteur3
  /** Tangente unitaire, dans le sens du déplacement (suit les pentes). */
  avant: Vecteur3
  /** Normale locale de la chaussée (sans dévers latéral). */
  haut: Vecteur3
}

export type IdPiste = 'snoep'

/**
 * Tronçon remarquable de la piste, en mètres le long de la médiane :
 *  - `saut` : la route s'interrompt ou décroche — entre `debut` (décollage)
 *    et `fin` (atterrissage), la médiane est la ligne droite de l'un à
 *    l'autre et `hauteur` l'arc à ajouter au milieu (voir `scene/figuresKart`) ;
 *  - `boost` : pad d'accélération (les flammes s'allument) ;
 *  - `glace` : canal de glace (le kart glisse).
 */
export interface ZonePiste {
  type: 'saut' | 'boost' | 'glace'
  debut: number
  fin: number
  hauteur: number
}

export interface PisteCircuit {
  id: IdPiste
  /** Longueur d'un tour, mesurée sur la médiane (pentes comprises). */
  longueurTour: number
  /** Largeur d'une voie, en mètres. */
  largeurVoie: number
  /** Demi-largeur totale des voies (la route réelle est un peu plus large). */
  demiLargeurVoies: number
  /** Décalage latéral du centre de chaque voie (0 = intérieure). Identique à la 2D. */
  decalageVoie: (voie: number) => number
  /**
   * Position et repère complet sur la piste. `s` est mesurée sur la médiane :
   * à `s` égal, deux karts de voies différentes restent côte à côte — le
   * mieux classé apparaît toujours devant, quelle que soit sa voie.
   * `decalage` est latéral, positif à droite du sens de course.
   */
  pointSurPiste3D: (s: number, decalage?: number) => PosePiste3D
  /**
   * Repère d'un kart dans le modèle « en tours » : seule la partie décimale
   * de l'avancement compte. Le modulo est appliqué ici, au rendu, jamais sur
   * la valeur lissée — `glisserVersCible` travaille sur une grandeur
   * strictement croissante, sans discontinuité d'un tour à l'autre.
   */
  positionKartTours: (avancement: number, voie: number, recul?: number) => PosePiste3D
  /** Tronçons remarquables, dans le sens de course. */
  zones: readonly ZonePiste[]
  /** Le tronçon d'un type donné qui contient l'abscisse `s` (en mètres), s'il y en a un. */
  zoneEn: (s: number, type: ZonePiste['type']) => ZonePiste | null
}

/** Catmull-Rom uniforme : valeur et dérivée entre p1 et p2, u ∈ [0, 1]. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, u: number): [number, number] {
  const a = 2 * p1
  const b = p2 - p0
  const c = 2 * p0 - 5 * p1 + 4 * p2 - p3
  const d = -p0 + 3 * p1 - 3 * p2 + p3
  return [0.5 * (a + b * u + c * u * u + d * u * u * u), 0.5 * (b + 2 * c * u + 3 * d * u * u)]
}

/**
 * Construit une piste à partir de sa médiane générée.
 *
 * @param points  (x, y, z) tous les ~2 m, boucle fermée, sens de course.
 * @param pentes  pente latérale par point (hauteur d'un kart décalé de `d` :
 *   `y + pente × d`) — vide si la route est plate.
 * @param releves  relèvement des karts par point (virages en pente, où un
 *   kart rigide toucherait la route du coin) — vide si inutile.
 * @param largeurRouteMin  largeur des passages étroits : les voies doivent y tenir.
 * @param ecartements  resserrement des voies par point (1 = normal) — vide si inutile.
 * @param zones  [type, premier point, dernier point, hauteur d'arc] du fichier généré.
 */
function creerPiste(
  id: IdPiste,
  points: readonly number[],
  pentes: readonly number[],
  releves: readonly number[],
  largeurVoie: number,
  largeurRouteMin: number,
  ecartements: readonly number[] = [],
  zonesBrutes: readonly (readonly [ZonePiste['type'], number, number, number])[] = [],
): PisteCircuit {
  if (largeurVoie * CIRCUIT.nombreVoies > largeurRouteMin) {
    throw new Error(`circuit3d : les voies de la piste « ${id} » débordent de la route — revoir sa largeur de voie.`)
  }

  const nombre = points.length / 3
  const indice = (i: number) => 3 * (((i % nombre) + nombre) % nombre)
  const px = (i: number) => points[indice(i)]
  const py = (i: number) => points[indice(i) + 1]
  const pz = (i: number) => points[indice(i) + 2]

  // Abscisse curviligne cumulée au point i (le dernier élément = un tour).
  const abscisses: number[] = [0]
  for (let i = 1; i <= nombre; i++) {
    abscisses.push(abscisses[i - 1] + Math.hypot(px(i) - px(i - 1), py(i) - py(i - 1), pz(i) - pz(i - 1)))
  }
  const longueurTour = abscisses[nombre]

  /** Segment [i, i+1] contenant l'abscisse `t` (recherche dichotomique). */
  const segmentDe = (t: number) => {
    let bas = 0
    let haut = nombre - 1
    while (bas < haut) {
      const milieu = (bas + haut + 1) >> 1
      if (abscisses[milieu] <= t) bas = milieu
      else haut = milieu - 1
    }
    return bas
  }

  /** Valeur par point interpolée entre i et i+1 (`absente` si la série manque). */
  const interpoler = (serie: readonly number[], i: number, u: number, absente = 0) => {
    if (serie.length !== nombre) return absente
    const a = serie[i % nombre]
    const b = serie[(i + 1) % nombre]
    return a + (b - a) * u
  }

  const decalageVoie = (voie: number) => (voie - (CIRCUIT.nombreVoies - 1) / 2) * largeurVoie

  const pointSurPiste3D = (s: number, decalage = 0): PosePiste3D => {
    const t = ((s % longueurTour) + longueurTour) % longueurTour
    const i = segmentDe(t)
    const u = (t - abscisses[i]) / (abscisses[i + 1] - abscisses[i])

    const [x, dx] = catmullRom(px(i - 1), px(i), px(i + 1), px(i + 2), u)
    const [y, dy] = catmullRom(py(i - 1), py(i), py(i + 1), py(i + 2), u)
    const [z, dz] = catmullRom(pz(i - 1), pz(i), pz(i + 1), pz(i + 2), u)

    const norme = Math.hypot(dx, dy, dz) || 1
    const avant = { x: dx / norme, y: dy / norme, z: dz / norme }

    // Droite = avant × (0, 1, 0), à plat, puis inclinée du DÉVERS mesuré de
    // la route ; haut = droite × avant — la base que reconstruit
    // `transformPiste.ts`. Dans un virage relevé, le kart penche avec la route.
    const normeDroite = Math.hypot(avant.z, avant.x) || 1
    const droiteX = -avant.z / normeDroite
    const droiteZ = avant.x / normeDroite
    const pente = interpoler(pentes, i, u)
    const normeIncline = Math.hypot(1, pente)
    const [rx, ry, rz] = [droiteX / normeIncline, pente / normeIncline, droiteZ / normeIncline]
    const haut = {
      x: ry * avant.z - rz * avant.y,
      y: rz * avant.x - rx * avant.z,
      z: rx * avant.y - ry * avant.x,
    }

    // Passages étroits : les voies s'y resserrent (mesuré par le script).
    const ecart = decalage * interpoler(ecartements, i, u, 1)

    return {
      position: {
        x: x + droiteX * ecart,
        y: y + pente * ecart + interpoler(releves, i, u),
        z: z + droiteZ * ecart,
      },
      avant,
      haut,
    }
  }

  const positionKartTours = (avancement: number, voie: number, recul = 0): PosePiste3D => {
    const fraction = ((avancement % 1) + 1) % 1
    // Le recul de grille peut faire passer derrière la ligne : on re-module —
    // à l'avancement 0, la grille s'aligne juste AVANT la ligne de départ.
    const abscisse = ((fraction * longueurTour - recul) % longueurTour + longueurTour) % longueurTour
    return pointSurPiste3D(abscisse, decalageVoie(voie))
  }

  const zones: ZonePiste[] = zonesBrutes.map(([type, premier, dernier, hauteur]) => ({
    type,
    debut: abscisses[premier],
    fin: abscisses[dernier],
    hauteur,
  }))
  const zoneEn = (s: number, type: ZonePiste['type']) => {
    const t = ((s % longueurTour) + longueurTour) % longueurTour
    return zones.find((z) => z.type === type && t >= z.debut && t < z.fin) ?? null
  }

  return {
    id,
    longueurTour,
    zones,
    zoneEn,
    largeurVoie,
    demiLargeurVoies: (CIRCUIT.nombreVoies * largeurVoie) / 2,
    decalageVoie,
    pointSurPiste3D,
    positionKartTours,
  }
}

/**
 * « snoep » : circuit de bonbons (Sketchfab, `preparer-piste-snoep.mjs`) —
 * bandes de route de ~10,5 m au plus étroit, rampes, anneau surélevé, deux
 * sauts → 4 voies de 2,2 m (resserrées dans les passages étroits), hauteur et
 * dévers mesurés sur la surface de roulage. La largeur de voie doit rester
 * égale à `LARGEUR_VOIE` du script : c'est avec elle qu'il vérifie qu'aucun
 * véhicule ne touche le décor.
 */
export const PISTES: Record<IdPiste, PisteCircuit> = {
  snoep: creerPiste(
    'snoep',
    TraceSnoep.POINTS_PISTE,
    TraceSnoep.PENTES_PISTE,
    TraceSnoep.RELEVEMENTS_KARTS,
    2.2,
    TraceSnoep.LARGEUR_ASPHALTE_MIN,
    TraceSnoep.ECARTEMENTS_VOIES,
    TraceSnoep.ZONES_PISTE,
  ),
}

export const PISTE_PAR_DEFAUT: IdPiste = 'snoep'

// --- Compatibilité : piste par défaut -----------------------------------------
// Seul le stade (`scene/stade/`, plus rendu depuis les pistes modélisées)
// s'en sert encore. Tout ce qui s'affiche reçoit sa `PisteCircuit` en prop.

const PISTE_DEFAUT = PISTES[PISTE_PAR_DEFAUT]
export const LONGUEUR_TOUR = PISTE_DEFAUT.longueurTour
export const DEMI_LARGEUR_PISTE = PISTE_DEFAUT.demiLargeurVoies
export const pointSurPiste3D = PISTE_DEFAUT.pointSurPiste3D
