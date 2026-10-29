/**
 * Sentinelle de performance — v2 : diagnostiquer, pas guillotiner.
 *
 * Surveille le temps de frame moyen et demande une dégradation de qualité
 * quand le rythme reste sous le seuil de façon soutenue. Les paliers (voir
 * `NiveauQualite`) sont appliqués par `App.tsx` : post-traitement retiré →
 * foule réduite → ombres désactivées → « 3D minimale » (piste + karts,
 * sans stade). Il n'y a PLUS d'écran bloquant au bout de l'échelle : une
 * machine faible obtient une scène dépouillée, jamais un mur.
 *
 * Nouveauté v2 — la détection de PLAFONNEMENT : un poste dont le temps de
 * frame est STABLE et collé à une cadence d'affichage connue (60 / 50 /
 * 30 Hz) n'est pas en difficulté, il est bridé (économie d'énergie du
 * navigateur, écran 30 Hz, VDI). Dégrader la qualité n'y changerait rien :
 * on ne dégrade pas. Seule la vraie lenteur — un temps de frame erratique —
 * fait descendre les paliers.
 *
 * La logique de décision est un module pur (testable sans React ni Three) ;
 * seul le composant `SentinellePerformance` en bas de fichier touche à R3F.
 */

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

/** Paliers de qualité, du complet (0) à la 3D minimale (4). */
export const NIVEAUX_QUALITE = {
  complet: 0,
  sansPostTraitement: 1,
  fouleReduite: 2,
  sansOmbres: 3,
  minimal: 4,
} as const

export type NiveauQualite = (typeof NIVEAUX_QUALITE)[keyof typeof NIVEAUX_QUALITE]

export const NIVEAU_MAXIMAL = NIVEAUX_QUALITE.minimal

export interface OptionsSentinelle {
  /** Sous ce rythme moyen, la scène est considérée en difficulté. */
  seuilFps: number
  /** Durée continue sous le seuil avant de dégrader — évite les faux positifs. */
  confirmationMs: number
  /** Démarrage ignoré : compilation des shaders, chargements, premiers cadrages. */
  chauffeMs: number
  /** Répit après chaque dégradation, le temps que son effet se mesure. */
  repitMs: number
}

const OPTIONS_DEFAUT: OptionsSentinelle = {
  seuilFps: 30,
  confirmationMs: 5000,
  chauffeMs: 8000,
  repitMs: 4000,
}

/** Constante de temps du lissage exponentiel du temps de frame (secondes). */
const TAU_LISSAGE = 1

/**
 * Cadences d'affichage connues (ms par image) : 60, 50 et 30 Hz. Un temps de
 * frame stable à ±2,5 ms de l'une d'elles signe une machine bridée, pas une
 * machine qui rame — la gigue d'un GPU en difficulté ne tient jamais dans
 * une fourchette aussi étroite.
 */
const CADENCES_PLAFOND_MS = [1000 / 60, 20, 1000 / 30] as const
const TOLERANCE_PLAFOND_MS = 2.5
/** Gigue lissée maximale (secondes) pour parler de plateau. */
const GIGUE_PLATEAU_S = 0.002

export interface Sentinelle {
  /**
   * À appeler chaque frame. Renvoie `true` quand un palier de dégradation
   * doit être franchi (au plus une fois par période de répit).
   */
  alimenter(dtSecondes: number, maintenantMs: number): boolean
}

export function creerSentinelle(options: Partial<OptionsSentinelle> = {}): Sentinelle {
  const { seuilFps, confirmationMs, chauffeMs, repitMs } = { ...OPTIONS_DEFAUT, ...options }

  let demarrageMs: number | null = null
  let ignorerJusqua = 0
  let dtLisse: number | null = null
  let giguelisse: number | null = null
  let sousSeuilDepuis: number | null = null

  return {
    alimenter(dtSecondes, maintenantMs) {
      if (demarrageMs === null) {
        demarrageMs = maintenantMs
        ignorerJusqua = maintenantMs + chauffeMs
      }
      if (dtSecondes <= 0) return false

      // Lissage exponentiel du temps de frame — même schéma que le reste du
      // projet (1 - e^(-dt/tau)), robuste aux à-coups isolés (GC, onglet).
      const melange = 1 - Math.exp(-dtSecondes / TAU_LISSAGE)
      const ecart = dtLisse === null ? 0 : Math.abs(dtSecondes - dtLisse)
      dtLisse = dtLisse === null ? dtSecondes : dtLisse + (dtSecondes - dtLisse) * melange
      giguelisse = giguelisse === null ? ecart : giguelisse + (ecart - giguelisse) * melange

      if (maintenantMs < ignorerJusqua) {
        sousSeuilDepuis = null
        return false
      }

      if (1 / dtLisse >= seuilFps) {
        sousSeuilDepuis = null
        return false
      }

      // Plafonnement : rythme sous le seuil mais PARFAITEMENT régulier et
      // collé à une cadence d'affichage → machine bridée, pas en difficulté.
      const dtMs = dtLisse * 1000
      const plafonnee =
        giguelisse < GIGUE_PLATEAU_S &&
        CADENCES_PLAFOND_MS.some((cadence) => Math.abs(dtMs - cadence) < TOLERANCE_PLAFOND_MS)
      if (plafonnee) {
        sousSeuilDepuis = null
        return false
      }

      if (sousSeuilDepuis === null) {
        sousSeuilDepuis = maintenantMs
        return false
      }
      if (maintenantMs - sousSeuilDepuis < confirmationMs) return false

      sousSeuilDepuis = null
      ignorerJusqua = maintenantMs + repitMs
      return true
    },
  }
}

interface ProprietesSentinelle {
  /** Palier courant — la surveillance s'arrête une fois la 3D minimale atteinte. */
  niveau: NiveauQualite
  onDegrader: () => void
}

/** À monter dans le `<Canvas>` (la mesure vit dans la boucle de rendu). */
export function SentinellePerformance({ niveau, onDegrader }: ProprietesSentinelle) {
  const sentinelle = useMemo(() => creerSentinelle(), [])

  useFrame((_etatR3F, dt) => {
    if (niveau >= NIVEAU_MAXIMAL) return
    if (sentinelle.alimenter(dt, performance.now())) onDegrader()
  })

  return null
}
