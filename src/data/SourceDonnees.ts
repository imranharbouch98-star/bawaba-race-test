/**
 * Contrat d'une source de données Race Pulse.
 *
 * L'application ne connaît que cette interface. Brancher le vrai logiciel de
 * centre d'appels revient à écrire une nouvelle implémentation et à la
 * renvoyer depuis `creerSourceDonnees()` (voir `src/data/index.ts`) :
 * aucun composant d'interface n'a à changer.
 *
 * ---
 * Copie conforme depuis race-pulse (2D) — src/data/SourceDonnees.ts. Aucune
 * ligne de logique modifiée. En cas de correctif ici, le reporter dans les
 * deux dépôts.
 */

import type { Instantane } from '../domain/types'

export type Desabonnement = () => void

export interface SourceDonnees {
  /** Affiché à l'écran pour indiquer clairement l'origine des données. */
  readonly type: 'simulation' | 'api'
  readonly libelle: string

  /**
   * S'abonne au flux d'instantanés.
   *
   * L'implémentation doit émettre un premier instantané immédiatement
   * (de façon synchrone si possible), puis un nouveau à chaque mise à jour.
   * La fonction renvoyée coupe l'abonnement et libère les ressources.
   */
  souscrire(ecouteur: (instantane: Instantane) => void): Desabonnement

  /** Force une mise à jour immédiate (bouton « Simuler une mise à jour »). */
  rafraichir(): void
}
