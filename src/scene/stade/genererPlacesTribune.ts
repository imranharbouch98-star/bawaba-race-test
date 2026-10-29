/**
 * Places de la foule — fonction pure, ne dépend d'aucun type Three.js
 * (même discipline que `domain/`, bien que ce fichier vive dans `scene/`
 * puisqu'il s'agit de géométrie de décor, pas de sémantique de course).
 *
 * Les places suivent tout l'anneau des tribunes (lignes droites et virages),
 * pas seulement deux blocs le long des lignes droites.
 */

import { LONGUEUR_TOUR, pointSurPiste3D } from '../../domain/circuit3d'
import { RANGEES, decalageRangee, hauteurRangee } from './geometrieTribune'

/**
 * Écart approximatif entre deux spectateurs d'une même rangée, en mètres.
 * L'anneau complet (virages compris) couvre ~2,4x plus de périmètre que les
 * deux seuls blocs droits de la Phase 2 : cet écart est un peu plus large
 * qu'alors pour rester dans le budget de perfs du plan (§8, 800-2000
 * instances) malgré la couverture plus large.
 */
const ECART_SIEGE = 1.5

export interface PlaceTribune {
  position: { x: number; y: number; z: number }
  /** Rotation autour de l'axe Y, en radians — le spectateur fait face à la piste. */
  rotationY: number
  /** Déphasage du balancement d'ambiance, propre à chaque spectateur. */
  dephasage: number
  /** Index de teinte dans la palette de `Foule.tsx`. */
  teinte: number
}

const NOMBRE_TEINTES = 7

/** Générateur pseudo-aléatoire déterministe — un stade stable d'un rendu à l'autre. */
function creerAleatoire(graine: number): () => number {
  let etat = graine >>> 0
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0
    let t = etat
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Places d'une rangée, tout autour de l'anneau. */
function placesRangee(rangee: number, aleatoire: () => number): PlaceTribune[] {
  const decalage = (decalageRangee(rangee) + decalageRangee(rangee + 1)) / 2
  const y = hauteurRangee(rangee) + 0.28
  const nombreSieges = Math.round(LONGUEUR_TOUR / ECART_SIEGE)
  const places: PlaceTribune[] = []

  for (let i = 0; i < nombreSieges; i += 1) {
    // Quelques sièges vides pour casser la régularité trop parfaite.
    if (aleatoire() < 0.12) continue

    const s = (i / nombreSieges) * LONGUEUR_TOUR
    const pose = pointSurPiste3D(s, decalage)
    // Le spectateur fait face au centre du circuit : direction opposée à
    // « droite » (avant × haut), qui pointe vers l'extérieur par construction.
    const versInterieur = { x: pose.avant.z, z: -pose.avant.x }

    places.push({
      position: {
        x: pose.position.x + (aleatoire() - 0.5) * 0.25,
        y,
        z: pose.position.z + (aleatoire() - 0.5) * 0.25,
      },
      rotationY: Math.atan2(versInterieur.x, versInterieur.z),
      dephasage: aleatoire() * Math.PI * 2,
      teinte: Math.floor(aleatoire() * NOMBRE_TEINTES),
    })
  }

  return places
}

/** Places de toutes les rangées, tout autour du circuit. Déterministe. */
export function genererPlacesTribune(): PlaceTribune[] {
  const aleatoire = creerAleatoire(20260730)
  const places: PlaceTribune[] = []
  for (let rangee = 0; rangee < RANGEES; rangee += 1) {
    places.push(...placesRangee(rangee, aleatoire))
  }
  return places
}
