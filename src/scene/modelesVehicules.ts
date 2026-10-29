/**
 * Dimensions des véhicules par niveau, en mètres (avant = +X, posés au sol)
 * — FICHIER GÉNÉRÉ par `scripts/preparer-vehicules.mjs preparer`, ne pas
 * éditer à la main. Modèles : `public/modeles/vehicules/niveaux/<id>.glb`.
 */

export interface DimensionsVehicule {
  longueur: number
  largeur: number
  hauteur: number
}

// prettier-ignore
export const DIMENSIONS_VEHICULES: Record<string, DimensionsVehicule> = {
  'kruiwagen': { longueur: 1.8, largeur: 0.98, hauteur: 0.94 },
  'sedan-klassiek': { longueur: 2.8, largeur: 1.2, hauteur: 0.98 },
  'bolle-wagen': { longueur: 2.8, largeur: 1.26, hauteur: 1.15 },
  'limousine': { longueur: 3.4, largeur: 1.28, hauteur: 0.88 },
  'sedan-roze': { longueur: 2.8, largeur: 1.3, hauteur: 1.11 },
  'cabrio': { longueur: 2.8, largeur: 1.11, hauteur: 0.82 },
  'lowrider': { longueur: 2.8, largeur: 1.16, hauteur: 0.97 },
  'stretch-limo': { longueur: 3.4, largeur: 1.27, hauteur: 0.81 },
  'hello-kitty': { longueur: 2, largeur: 1.82, hauteur: 2.25 },
  'appeltaart': { longueur: 2.4, largeur: 1.91, hauteur: 1.51 },
  'dessert-taart': { longueur: 2.2, largeur: 1.9, hauteur: 1.51 },
  'dessert-auto': { longueur: 2.8, largeur: 1.91, hauteur: 0.92 },
  'gevulde-chariot': { longueur: 2.7, largeur: 1.88, hauteur: 1.02 },
  'wafelauto': { longueur: 2, largeur: 1.91, hauteur: 0.96 },
}
