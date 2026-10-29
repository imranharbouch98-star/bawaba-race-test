/**
 * Cycle du jour — position et teinte du soleil selon l'heure réelle.
 *
 * L'écran mural tourne du matin au soir sans que rien ne distingue 9 h de
 * 16 h : c'est une boucle sans début ni fin. Faire suivre l'heure au soleil
 * donne une forme à la journée — rasant et doré au démarrage, haut et blanc
 * à midi, orangé rasant avant la fermeture — pour un coût de rendu nul,
 * puisqu'il ne s'agit que de déplacer une lumière déjà présente.
 *
 * Logique pure, sans React ni Three.js, comme `domain/` et
 * `scene/lissageProgression.ts` : seule la couche de rendu s'en sert.
 */

/** Vecteur brut — la couche de rendu en fera ce qu'elle veut. */
export interface DirectionSoleil {
  x: number
  y: number
  z: number
}

export interface EtatSoleil {
  /** Direction normalisée depuis l'origine vers le soleil. */
  direction: DirectionSoleil
  /** 0 à l'horizon, 1 au plus haut. Pilote la teinte et l'intensité. */
  elevation: number
  /** Couleur de la lumière directionnelle. */
  couleurLumiere: string
  /** Couleur du disque solaire visible. */
  couleurDisque: string
  /** Intensité de la lumière directionnelle. */
  intensite: number
  /**
   * Ambiance générale. Sans elle, l'heure du jour ne se voyait quasiment
   * pas : les lumières ambiante et hémisphérique, fixes, dominaient et
   * diluaient la teinte du soleil au point que 13 h et 17 h 30 rendaient
   * presque à l'identique.
   */
  intensiteAmbiante: number
  couleurAmbiante: string
  couleurBrouillard: string
}

/**
 * Bornes de la journée affichée. En dehors, le soleil reste à sa position
 * d'ouverture ou de fermeture plutôt que de passer sous l'horizon : un écran
 * de centre d'appels allumé à 7 h ou à 20 h doit rester lisible, pas plonger
 * dans le noir.
 */
export const HEURE_OUVERTURE = 8
export const HEURE_FERMETURE = 18

/** Élévation la plus basse conservée, pour ne jamais raser au point d'aveugler. */
const ELEVATION_MIN = 0.26
const ELEVATION_MAX = 0.92

/** Interpolation linéaire entre deux teintes hexadécimales. */
function melanger(depuis: string, vers: string, facteur: number): string {
  const t = Math.min(1, Math.max(0, facteur))
  const lire = (couleur: string, decalage: number) =>
    Number.parseInt(couleur.slice(1 + decalage * 2, 3 + decalage * 2), 16)

  const composantes = [0, 1, 2].map((i) => {
    const valeur = Math.round(lire(depuis, i) + (lire(vers, i) - lire(depuis, i)) * t)
    return valeur.toString(16).padStart(2, '0')
  })
  return `#${composantes.join('')}`
}

const DORE_RASANT = '#ffb257'
const BLANC_MIDI = '#fff0bd'
const DISQUE_RASANT = '#ffb066'
const DISQUE_MIDI = '#fff3c4'
const AMBIANT_RASANT = '#d9a882'
const AMBIANT_MIDI = '#bfe3d4'
const BROUILLARD_RASANT = '#6b6a52'
const BROUILLARD_MIDI = '#3f7a68'

/**
 * État du soleil pour une heure décimale (13,5 = 13 h 30).
 *
 * L'azimut balaie d'est en ouest sur la journée ; l'élévation suit un demi-
 * sinus, maximale au milieu de la plage d'ouverture. Ce n'est pas une
 * éphéméride astronomique — la scène n'a pas de latitude — mais la lecture
 * « le soleil s'est déplacé depuis ce matin » est exacte, et c'est tout ce
 * qu'on demande à un décor.
 */
export function soleilAHeure(heure: number): EtatSoleil {
  const borne = Math.min(HEURE_FERMETURE, Math.max(HEURE_OUVERTURE, heure))
  const avancee = (borne - HEURE_OUVERTURE) / (HEURE_FERMETURE - HEURE_OUVERTURE)

  // Demi-sinus : 0 aux extrémités, 1 au milieu de journée.
  const arc = Math.sin(avancee * Math.PI)
  const elevation = ELEVATION_MIN + (ELEVATION_MAX - ELEVATION_MIN) * arc

  // L'azimut part de l'est (avancee = 0) pour finir à l'ouest (avancee = 1).
  const azimut = Math.PI * (1 - avancee)
  const rayonHorizontal = Math.sqrt(Math.max(0, 1 - elevation * elevation))

  return {
    direction: {
      x: Math.cos(azimut) * rayonHorizontal,
      y: elevation,
      z: Math.sin(azimut) * rayonHorizontal * 0.45,
    },
    elevation: arc,
    couleurLumiere: melanger(DORE_RASANT, BLANC_MIDI, arc),
    couleurDisque: melanger(DISQUE_RASANT, DISQUE_MIDI, arc),
    // Un soleil rasant éclaire moins : la scène s'assombrit légèrement en
    // début et en fin de journée, ce qui suffit à faire sentir l'heure.
    intensite: 1.05 + 0.55 * arc,
    intensiteAmbiante: 0.58 + 0.32 * arc,
    couleurAmbiante: melanger(AMBIANT_RASANT, AMBIANT_MIDI, arc),
    couleurBrouillard: melanger(BROUILLARD_RASANT, BROUILLARD_MIDI, arc),
  }
}

/**
 * Durée du « dernier tour », en minutes avant la fermeture.
 *
 * Dix minutes : assez pour qu'un agent ait le temps d'agir en le voyant,
 * assez court pour que ce soit un événement et non un état. Une heure de
 * « dernier tour » ne serait plus un dernier tour.
 */
export const DUREE_DERNIER_TOUR = 10

export type PhaseJournee = 'avant' | 'course' | 'dernier-tour' | 'apres'

export interface EtatJournee {
  phase: PhaseJournee
  /** Minutes avant la fermeture. Négatif une fois la journée close. */
  minutesRestantes: number
}

/**
 * Phase de la journée pour une heure décimale.
 *
 * L'écran est aujourd'hui une boucle sans début ni fin : à 9 h il ressemble
 * à 16 h. Découper la journée lui donne un rythme — et surtout un pic
 * d'attention quotidien à la fermeture, au moment où il reste encore le
 * temps de faire bouger un classement.
 */
export function journeeAHeure(heure: number): EtatJournee {
  const minutesRestantes = Math.round((HEURE_FERMETURE - heure) * 60)

  if (heure < HEURE_OUVERTURE) return { phase: 'avant', minutesRestantes }
  if (heure >= HEURE_FERMETURE) return { phase: 'apres', minutesRestantes }
  if (minutesRestantes <= DUREE_DERNIER_TOUR) return { phase: 'dernier-tour', minutesRestantes }
  return { phase: 'course', minutesRestantes }
}

/** Heure décimale locale — 13 h 30 renvoie 13,5. */
export function heureDecimale(date: Date): number {
  return date.getHours() + date.getMinutes() / 60
}
