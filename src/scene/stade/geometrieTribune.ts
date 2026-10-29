/**
 * Géométrie partagée d'une tribune — constantes communes à `Tribune.tsx`
 * (la structure visible), `anneauTribune.ts` (les maillages) et
 * `genererPlacesTribune.ts` (les places de la foule), pour que les
 * spectateurs restent posés sur les gradins quels que soient les réglages.
 *
 * Un seul anneau continu de gradins entoure tout le circuit — lignes
 * droites ET virages — plutôt que deux blocs séparés le long des seules
 * lignes droites (choix initial de la Phase 2, remplacé sur demande pour
 * accompagner la montée en charge du nombre d'agents).
 */

import { DEMI_LARGEUR_PISTE } from '../../domain/circuit3d'

export const RANGEES = 6
export const PROFONDEUR_RANGEE = 1.3
export const HAUTEUR_RANGEE = 0.55
/** Écart entre le bord de l'asphalte et le premier rang de gradins. */
export const ECART_PISTE = 3

/**
 * Décalage (perpendiculaire à la piste, unité attendue par `pointSurPiste3D` —
 * qui y ajoute déjà `CIRCUIT.r` en interne) du pied de la première rangée.
 *
 * Piège évité ici : ne PAS repartir du rayon absolu du bord extérieur
 * (`CIRCUIT.r + DEMI_LARGEUR_PISTE`) pour construire ce décalage — ça
 * compterait `CIRCUIT.r` deux fois une fois passé à `pointSurPiste3D`, et
 * enverrait les tribunes bien plus loin que prévu.
 */
export const DECALAGE_BASE = DEMI_LARGEUR_PISTE + ECART_PISTE

/** Décalage du pied de la rangée `rangee` (0 = la plus proche de la piste). */
export function decalageRangee(rangee: number): number {
  return DECALAGE_BASE + rangee * PROFONDEUR_RANGEE
}

/** Hauteur du sommet de la rangée `rangee`. */
export function hauteurRangee(rangee: number): number {
  return (rangee + 1) * HAUTEUR_RANGEE
}

/**
 * Distance à l'axe de la piste du bord extérieur des tribunes.
 *
 * ⚠️ Le stade a été conçu pour l'ancien ovale et n'est plus rendu depuis la
 * piste Fab (voir `App.tsx`) : il se superposerait au nouveau tracé. Le
 * code est conservé pour le jour où les tribunes seront replacées le long
 * de celui-ci.
 */
export const RAYON_EXTERIEUR_TRIBUNE = decalageRangee(RANGEES)
