/**
 * Politique d'affichage des plaques d'identification des karts.
 *
 * Trois modes plutôt que deux : sur un écran mural, personne ne touche à la
 * souris et « au survol » revient à ne rien afficher — c'est un réglage de
 * poste de consultation. Inversement, en présentation, masquer complètement
 * les plaques donne une image de course plus propre.
 */
export const MODES_ETIQUETTES = ['toujours', 'survol', 'jamais'] as const

export type ModeEtiquettes = (typeof MODES_ETIQUETTES)[number]

// Les libellés affichés vivent dans `i18n/textes.ts` (NL/EN) — ce module ne
// porte que la politique, pas les mots.

export const MODE_ETIQUETTES_DEFAUT: ModeEtiquettes = 'toujours'

/** La plaque de ce kart doit-elle être rendue ? */
export function etiquetteVisible(mode: ModeEtiquettes, survole: boolean): boolean {
  if (mode === 'jamais') return false
  if (mode === 'survol') return survole
  return true
}
