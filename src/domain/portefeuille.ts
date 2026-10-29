/**
 * Portefeuille des agents — pièces gagnées en kilomètres parcourus, dépensées
 * dans la boutique (« Winkel »). Logique PURE : ni React, ni navigateur, ni
 * horloge — l'appelant fournit les horodatages.
 *
 * Règle demandée (23/10) : chaque agent reçoit, en fin de journée, des
 * pièces proportionnelles à la distance que son kart a parcourue ce jour-là,
 * plafonnées par jour. La distance découle uniquement du score : un tour =
 * un objectif atteint (voir `classement.ts`).
 *
 * Tout est stocké comme une suite de MOUVEMENTS (gains, achats) : le solde
 * n'est jamais stocké, il se recalcule — un historique ne peut pas se
 * désynchroniser de son total. C'est aussi la forme que prendra la table
 * côté BawabaDash.
 */

export interface ReglesPieces {
  /**
   * Kilomètres comptés pour un tour (= un objectif atteint). FIXE et
   * indépendant de la longueur réelle de la piste 3D, pour que changer de
   * piste ne change jamais ce que gagnent les agents. 3 = « un tiers de
   * piste vaut 1 km ».
   */
  kmParTour: number
  piecesParKm: number
  /** Plafond de pièces par agent et par jour. */
  maxParJour: number
}

/** Réglages actuels — à rendre configurables côté BawabaDash (haute saison…). */
export const REGLES_PIECES: ReglesPieces = {
  kmParTour: 3,
  piecesParKm: 10,
  maxParJour: 50,
}

/** Distance parcourue sur la journée, en km, pour un avancement en tours. */
export function kmParcourus(avancementJour: number, regles: ReglesPieces = REGLES_PIECES): number {
  return Math.max(0, avancementJour) * regles.kmParTour
}

/** Pièces que vaut une journée — arrondies à l'unité inférieure, plafonnées. */
export function piecesPourJournee(avancementJour: number, regles: ReglesPieces = REGLES_PIECES): number {
  return Math.min(regles.maxParJour, Math.floor(kmParcourus(avancementJour, regles) * regles.piecesParKm))
}

// --- Véhicules ----------------------------------------------------------------

export interface Vehicule {
  id: string
  prix: number
  /**
   * Niveau du véhicule (numérotation du chef de projet : « level 2 », …).
   * Le niveau d'un agent est celui de son meilleur véhicule.
   */
  niveau: number
}

/**
 * Le kart de départ : offert à tous, il ne s'achète pas (niveau 0). Les noms
 * affichés vivent dans `i18n/textes.ts`, les modèles 3D dans
 * `public/modeles/vehicules/niveaux/` (`scripts/preparer-vehicules.mjs`).
 */
export const VEHICULE_DE_DEPART: Vehicule = { id: 'kart-standaard', prix: 0, niveau: 0 }

/**
 * Catalogue de la boutique, du plus simple au plus beau.
 *
 * Depuis le 29/10 (circuit de bonbons) : les cinq véhicules « bonbons »
 * ouvrent la progression (levels 1–5), puis les voitures pastel qui
 * collent au thème, et Hello Kitty tout en haut, récompense ultime (27/10).
 * Levels renumérotés de 1 à 11, sans trou.
 *
 * Prix à valider avec le chef de projet : à 50 pièces par jour au plus, le
 * premier véhicule se gagne en ~1 jour, Hello Kitty en près d'un an —
 * de quoi garder un objectif de long terme.
 */
export const CATALOGUE: readonly Vehicule[] = [
  { id: 'appeltaart', niveau: 1, prix: 50 },
  { id: 'dessert-taart', niveau: 2, prix: 120 },
  { id: 'wafelauto', niveau: 3, prix: 200 },
  { id: 'gevulde-chariot', niveau: 4, prix: 300 },
  { id: 'dessert-auto', niveau: 5, prix: 450 },
  { id: 'sedan-roze', niveau: 6, prix: 650 },
  { id: 'cabrio', niveau: 7, prix: 900 },
  { id: 'limousine', niveau: 8, prix: 1200 },
  { id: 'lowrider', niveau: 9, prix: 1500 },
  { id: 'stretch-limo', niveau: 10, prix: 1900 },
  { id: 'hello-kitty', niveau: 11, prix: 2500 },
]

/**
 * Véhicules DÉSACTIVÉS le 29/10 — ils ne collent pas au circuit de bonbons
 * (brouette, berline grise réaliste, Coccinelle jaune). Retirés de la vente,
 * PAS supprimés : modèles, vignettes et noms restent en place, et un agent
 * qui en possède un le garde au garage et peut toujours le conduire. Pour en
 * réactiver un, le remettre dans CATALOGUE (avec un level et un prix).
 */
export const VEHICULES_DESACTIVES: readonly Vehicule[] = [
  { id: 'kruiwagen', niveau: 1, prix: 50 },
  { id: 'sedan-klassiek', niveau: 2, prix: 120 },
  { id: 'bolle-wagen', niveau: 3, prix: 200 },
]

// --- Mouvements et état --------------------------------------------------------

export type Mouvement =
  | {
      type: 'gain'
      id: string
      agentId: string
      horodatage: number
      montant: number
      /** Clé de la journée créditée — garantit un seul gain par agent et par jour. */
      journee: string
      km: number
    }
  | {
      type: 'achat'
      id: string
      agentId: string
      horodatage: number
      /** Négatif : une dépense. */
      montant: number
      vehiculeId: string
    }

export interface EtatPortefeuilles {
  mouvements: Mouvement[]
  /** Véhicule conduit par agent ; absent = le kart de départ. */
  vehiculeChoisi: Record<string, string>
}

export const ETAT_VIDE: EtatPortefeuilles = { mouvements: [], vehiculeChoisi: {} }

export function solde(etat: EtatPortefeuilles, agentId: string): number {
  return etat.mouvements.reduce((total, m) => (m.agentId === agentId ? total + m.montant : total), 0)
}

/** Véhicules possédés : le kart de départ + tout ce qui a été acheté. */
export function vehiculesPossedes(etat: EtatPortefeuilles, agentId: string): string[] {
  const achetes = etat.mouvements
    .filter((m): m is Extract<Mouvement, { type: 'achat' }> => m.type === 'achat' && m.agentId === agentId)
    .map((m) => m.vehiculeId)
  return [VEHICULE_DE_DEPART.id, ...achetes]
}

/** Niveau de l'agent : celui de son meilleur véhicule (0 avec le seul kart). */
export function niveauAgent(
  etat: EtatPortefeuilles,
  agentId: string,
  catalogue: readonly Vehicule[] = CATALOGUE,
): number {
  const possedes = vehiculesPossedes(etat, agentId)
  return catalogue.reduce((niveau, v) => (possedes.includes(v.id) ? Math.max(niveau, v.niveau) : niveau), 0)
}

/**
 * Le seul véhicule achetable : le premier du catalogue (par niveau) que
 * l'agent ne possède pas encore. On monte les niveaux un par un — c'est le
 * « level up » demandé. `null` quand tout est acheté.
 */
export function prochainVehicule(
  etat: EtatPortefeuilles,
  agentId: string,
  catalogue: readonly Vehicule[] = CATALOGUE,
): Vehicule | null {
  const possedes = vehiculesPossedes(etat, agentId)
  return [...catalogue].sort((a, b) => a.niveau - b.niveau).find((v) => !possedes.includes(v.id)) ?? null
}

export function vehiculeChoisi(etat: EtatPortefeuilles, agentId: string): string {
  const choix = etat.vehiculeChoisi[agentId]
  return choix && vehiculesPossedes(etat, agentId).includes(choix) ? choix : VEHICULE_DE_DEPART.id
}

/**
 * Crédite la journée écoulée : un gain par agent ayant roulé, jamais deux
 * fois la même journée (si la bascule est vue deux fois, rien ne change).
 */
export function crediterJournee(
  etat: EtatPortefeuilles,
  avancements: ReadonlyMap<string, number>,
  journee: string,
  horodatage: number,
  regles: ReglesPieces = REGLES_PIECES,
): EtatPortefeuilles {
  const dejaCredites = new Set(
    etat.mouvements.filter((m) => m.type === 'gain' && m.journee === journee).map((m) => m.agentId),
  )
  const gains: Mouvement[] = []
  for (const [agentId, avancement] of avancements) {
    const montant = piecesPourJournee(avancement, regles)
    if (montant <= 0 || dejaCredites.has(agentId)) continue
    gains.push({
      type: 'gain',
      id: `gain-${journee}-${agentId}`,
      agentId,
      horodatage,
      montant,
      journee,
      km: Math.round(kmParcourus(avancement, regles) * 10) / 10,
    })
  }
  return gains.length === 0 ? etat : { ...etat, mouvements: [...etat.mouvements, ...gains] }
}

export type RefusAchat = 'inconnu' | 'deja-possede' | 'niveau-requis' | 'solde-insuffisant'

/** Achat d'un véhicule du catalogue — l'état inchangé et la raison s'il est refusé. */
export function acheter(
  etat: EtatPortefeuilles,
  agentId: string,
  vehiculeId: string,
  horodatage: number,
  catalogue: readonly Vehicule[] = CATALOGUE,
): { etat: EtatPortefeuilles; refus?: RefusAchat } {
  const vehicule = catalogue.find((v) => v.id === vehiculeId)
  if (!vehicule) return { etat, refus: 'inconnu' }
  if (vehiculesPossedes(etat, agentId).includes(vehiculeId)) return { etat, refus: 'deja-possede' }
  if (prochainVehicule(etat, agentId, catalogue)?.id !== vehiculeId) return { etat, refus: 'niveau-requis' }
  if (solde(etat, agentId) < vehicule.prix) return { etat, refus: 'solde-insuffisant' }
  const achat: Mouvement = {
    type: 'achat',
    id: `achat-${agentId}-${vehiculeId}-${horodatage}`,
    agentId,
    horodatage,
    montant: -vehicule.prix,
    vehiculeId,
  }
  return { etat: { ...etat, mouvements: [...etat.mouvements, achat] } }
}

/** Choisir le véhicule conduit — uniquement parmi ceux possédés. */
export function choisirVehicule(etat: EtatPortefeuilles, agentId: string, vehiculeId: string): EtatPortefeuilles {
  if (!vehiculesPossedes(etat, agentId).includes(vehiculeId)) return etat
  return { ...etat, vehiculeChoisi: { ...etat.vehiculeChoisi, [agentId]: vehiculeId } }
}

// --- Fin de journée ----------------------------------------------------------

/**
 * La journée s'est-elle terminée entre deux instantanés ?
 *
 * Deux signaux, l'un ou l'autre suffit :
 *  - la date de mesure a changé (API réelle : bascule à minuit) ;
 *  - le peloton est reparti de la ligne : le meilleur avancement du jour a
 *    chuté de plus d'un demi-tour (simulateur : journée de 20 min). Même
 *    critère que la détection de nouvelle période de `Circuit3D.tsx`.
 */
export function journeeTerminee(
  avant: { miseAJour: number; avancements: ReadonlyMap<string, number> },
  apres: { miseAJour: number; avancements: ReadonlyMap<string, number> },
  dateDe: (horodatage: number) => string,
): boolean {
  if (dateDe(avant.miseAJour) !== dateDe(apres.miseAJour)) return true
  const max = (carte: ReadonlyMap<string, number>) => Math.max(0, ...carte.values())
  return max(apres.avancements) < max(avant.avancements) - 0.5
}
