/**
 * Lissage de progression — logique pure, sans React ni Three.js.
 *
 * Porte la règle non négociable de race-pulse (2D) : **un kart ne recule
 * jamais au cours d'une même période**. Une contre-performance ralentit sa
 * progression, elle ne l'inverse pas. Extrait en fonction pure (plutôt que
 * mêlé à la boucle `useFrame`) pour rester testable sans contexte WebGL —
 * même principe que la séparation domaine/rendu du reste du projet.
 */

/**
 * Fait avancer `actuel` vers `cible` par lissage exponentiel, sans jamais
 * reculer en dessous de la valeur déjà atteinte.
 *
 * @param actuel   valeur actuelle (progression 0..1, ou index de voie)
 * @param cible    valeur visée par les données de course
 * @param dt       delta-temps en secondes
 * @param tau      constante de temps du lissage, en secondes
 * @param jamaisReculer  si vrai (progression), la cible effective est
 *   `max(cible, actuel)` — c'est la règle de course. Si faux (voie, purement
 *   visuel), la cible peut être inférieure à l'actuel.
 */
export function avancerVersCible(
  actuel: number,
  cible: number,
  dt: number,
  tau: number,
  jamaisReculer: boolean,
): number {
  const cibleEffective = jamaisReculer ? Math.max(cible, actuel) : cible
  const facteur = 1 - Math.exp(-dt / tau)
  return actuel + (cibleEffective - actuel) * facteur
}

/** État d'un mobile qui glisse vers sa cible : position ET vitesse. */
export interface EtatGlisse {
  valeur: number
  /** Toujours ≥ 0 : un kart n'a pas de marche arrière. */
  vitesse: number
}

/**
 * Fait ROULER `etat.valeur` vers `cible`, comme une voiture plutôt qu'un
 * saut : les données n'arrivent que toutes les ~10 s, et un simple lissage
 * exponentiel rapide donnait un sprint de 2 s suivi d'un arrêt — la piste
 * avait l'air de sauter à chaque mise à jour.
 *
 * Deux étages :
 *  - la vitesse VISÉE couvre la distance restante en `dureeGlisse` secondes
 *    (de l'ordre de l'intervalle entre deux mises à jour) : le kart roule
 *    jusqu'à la suivante au lieu de s'arrêter net ;
 *  - la vitesse RÉELLE rejoint la vitesse visée avec un temps de réponse
 *    `tauVitesse` : accélérations et freinages progressifs, sans à-coups.
 *
 * Jamais de recul : la vitesse visée est bornée à 0, la vitesse réelle
 * (moyenne de valeurs positives) aussi, et la valeur est plafonnée à la
 * cible pour ne jamais la dépasser — sans quoi la règle la figerait devant.
 * Modifie `etat` en place : appelé pour chaque kart à chaque image.
 */
export function glisserVersCible(
  etat: EtatGlisse,
  cible: number,
  dt: number,
  dureeGlisse: number,
  tauVitesse: number,
): void {
  const vitesseVisee = Math.max(0, cible - etat.valeur) / dureeGlisse
  etat.vitesse += (vitesseVisee - etat.vitesse) * (1 - Math.exp(-dt / tauVitesse))
  if (etat.valeur < cible) {
    etat.valeur = Math.min(cible, etat.valeur + etat.vitesse * dt)
  }
}

/** Applique le lissage instantanément (mode `prefers-reduced-motion`). */
export function appliquerInstantanement(cible: number, actuel: number, jamaisReculer: boolean): number {
  return jamaisReculer ? Math.max(cible, actuel) : cible
}
