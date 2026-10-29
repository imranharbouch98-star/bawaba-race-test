/**
 * Figures des karts : ce que la PISTE leur fait faire — sauter, glisser sur
 * la glace, cracher des flammes sur le pad d'accélération (demande du 29/10).
 *
 * Calcul pur (aucun objet Three.js) : à partir de l'abscisse lissée d'un
 * kart (`lissageProgression`) et de sa cible, renvoie l'abscisse AFFICHÉE
 * et les petits décalages de la carrosserie. `Circuit3D` les applique.
 *
 * Règles des sauts — un kart ne reste JAMAIS suspendu en l'air :
 *  - tant que son score ne l'amène pas au-delà de l'atterrissage, il attend
 *    au bord du décollage ;
 *  - dès qu'il le dépasse, il saute en un temps FIXE (~1,2–1,6 s), quelle
 *    que soit sa vitesse : un grand comme un petit saut a son arc, sa vrille
 *    (tonneau ou salto selon le kart) et ses flammes ;
 *  - à l'atterrissage, il ne recule pas : il reste au point d'arrivée tant
 *    que le lissage ne l'a pas rejoint, puis repart normalement.
 * Le score n'est jamais modifié : seul l'affichage attend ou devance de la
 * longueur d'un saut (une quinzaine de mètres).
 */

import type { PisteCircuit, ZonePiste } from '../domain/circuit3d'

export interface EtatFigure {
  saut: {
    zone: ZonePiste
    /** Abscisses en tours (non bornées, comme `EtatKart.valeur`). */
    depart: number
    arrivee: number
    t: number
    duree: number
    figure: 'tonneau' | 'salto'
  } | null
  /** Après l'atterrissage : abscisse minimale affichée, tant que le lissage n'y est pas. */
  plancher: number | null
  depuisAtterrissage: number
  horloge: number
  /** Flammes encore allumées (s) — pad d'accélération, sortie de saut. */
  flammesRestantes: number
}

export interface Figure {
  /** Abscisse affichée, en tours. */
  valeur: number
  /** Hauteur ajoutée (m, verticale monde) — l'arc du saut. */
  hauteur: number
  /** Rotations de la carrosserie autour de son centre (rad) : nez levé, vrille, dérapage. */
  tangage: number
  roulis: number
  lacet: number
  /** Échelle verticale de la carrosserie (écrasement à l'atterrissage). */
  ecrasement: number
  flammes: boolean
}

/** Durée d'un saut : fixe, un peu plus longue pour les grands. */
const DUREE_SAUT_MIN = 1.2
const DUREE_SAUT_PAR_METRE = 1 / 40
const DUREE_SAUT_MAX = 1.65
/** La vrille occupe le milieu du vol (fractions du vol). */
const VRILLE_DEBUT = 0.12
const VRILLE_FIN = 0.86
/** Écrasement à l'atterrissage : amplitude et durée. */
const ECRASEMENT = 0.28
const DUREE_ECRASEMENT = 0.5
/** Flammes après un pad d'accélération ou un atterrissage (s). */
const FLAMMES_APRES = 1.2
/** Glace : dérapage (rad), fréquence (rad/s), longueur de fondu aux bords (m). */
const DERAPAGE = 0.24
const FREQUENCE_DERAPAGE = 2.4
const FONDU_GLACE = 10

export function creerEtatFigure(): EtatFigure {
  return { saut: null, plancher: null, depuisAtterrissage: Infinity, horloge: 0, flammesRestantes: 0 }
}

const lisse = (u: number) => u * u * (3 - 2 * u)
const borne = (u: number) => Math.min(1, Math.max(0, u))

/** Abscisses (en tours) du saut contenant `valeur`, sur le même tour que lui. */
function sautEn(piste: PisteCircuit, valeur: number) {
  const tour = Math.floor(valeur)
  const zone = piste.zoneEn((valeur - tour) * piste.longueurTour, 'saut')
  if (!zone) return null
  return { zone, depart: tour + zone.debut / piste.longueurTour, arrivee: tour + zone.fin / piste.longueurTour }
}

/**
 * Animations réduites : pas de vol — un kart est au décollage ou à
 * l'atterrissage, jamais entre les deux (il y flotterait sur la ligne droite).
 */
export function horsDesSauts(piste: PisteCircuit, valeur: number, cible: number): number {
  const saut = sautEn(piste, valeur)
  if (!saut) return valeur
  return cible >= saut.arrivee ? saut.arrivee : saut.depart
}

/**
 * Une image de figure. `numero` varie les figures d'un kart à l'autre
 * (tonneau ou salto, phase du dérapage).
 */
export function figurer(
  etat: EtatFigure,
  piste: PisteCircuit,
  valeurLissee: number,
  cible: number,
  dt: number,
  numero: number,
): Figure {
  const figure: Figure = { valeur: valeurLissee, hauteur: 0, tangage: 0, roulis: 0, lacet: 0, ecrasement: 1, flammes: false }
  etat.horloge += dt
  etat.depuisAtterrissage += dt
  etat.flammesRestantes = Math.max(0, etat.flammesRestantes - dt)

  // Nouvelle période (retour sur la ligne) : on oublie tout saut en cours.
  if (etat.saut && valeurLissee < etat.saut.depart - 0.5) etat.saut = null
  if (etat.plancher !== null && valeurLissee < etat.plancher - 0.5) etat.plancher = null

  // En vol.
  if (etat.saut) {
    const saut = etat.saut
    saut.t += dt
    const u = borne(saut.t / saut.duree)
    const longueur = Math.max(1, (saut.arrivee - saut.depart) * piste.longueurTour)
    figure.valeur = saut.depart + (saut.arrivee - saut.depart) * u
    figure.hauteur = saut.zone.hauteur * 4 * u * (1 - u)
    // Le nez suit l'arc (la pose, elle, suit déjà la ligne droite du saut).
    figure.tangage = Math.atan((4 * saut.zone.hauteur * (1 - 2 * u)) / longueur) * 0.7
    const tour = 2 * Math.PI * lisse(borne((u - VRILLE_DEBUT) / (VRILLE_FIN - VRILLE_DEBUT)))
    if (saut.figure === 'tonneau') figure.roulis = numero % 4 < 2 ? tour : -tour
    else figure.tangage += tour
    figure.flammes = true
    if (u >= 1) {
      etat.saut = null
      etat.plancher = saut.arrivee
      etat.depuisAtterrissage = 0
      etat.flammesRestantes = FLAMMES_APRES * 0.5
    }
    return figure
  }

  // Après l'atterrissage : jamais en arrière du point d'arrivée.
  let valeur = valeurLissee
  if (etat.plancher !== null) {
    if (valeur >= etat.plancher) etat.plancher = null
    else valeur = etat.plancher
  }

  // Au bord d'un saut : on attend, ou on s'élance si le score le permet.
  const saut = etat.plancher === null ? sautEn(piste, valeur) : null
  if (saut) {
    if (cible >= saut.arrivee) {
      const longueur = (saut.arrivee - saut.depart) * piste.longueurTour
      etat.saut = {
        ...saut,
        t: 0,
        duree: Math.min(DUREE_SAUT_MAX, DUREE_SAUT_MIN + longueur * DUREE_SAUT_PAR_METRE),
        figure: numero % 2 === 0 ? 'tonneau' : 'salto',
      }
    }
    valeur = saut.depart
  }
  figure.valeur = valeur

  const s = (valeur - Math.floor(valeur)) * piste.longueurTour

  // Pad d'accélération : flammes, nez légèrement levé.
  if (piste.zoneEn(s, 'boost')) etat.flammesRestantes = FLAMMES_APRES
  figure.flammes = etat.flammesRestantes > 0
  if (figure.flammes) figure.tangage = 0.05 * Math.min(1, etat.flammesRestantes / 0.3)

  // Glace : le kart dérape, fondu à l'entrée et à la sortie.
  const glace = piste.zoneEn(s, 'glace')
  if (glace) {
    const fondu = borne(Math.min(s - glace.debut, glace.fin - s) / FONDU_GLACE)
    figure.lacet = DERAPAGE * lisse(fondu) * Math.sin(etat.horloge * FREQUENCE_DERAPAGE + numero * 1.7)
    figure.roulis = -figure.lacet * 0.25
  }

  // Atterrissage : la carrosserie s'écrase puis rebondit.
  if (etat.depuisAtterrissage < DUREE_ECRASEMENT) {
    const k = etat.depuisAtterrissage / DUREE_ECRASEMENT
    figure.ecrasement = 1 - ECRASEMENT * Math.sin(Math.PI * k) * (1 - k * 0.6)
  }
  return figure
}
