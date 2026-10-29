/**
 * Race Pulse — modèle de données du domaine.
 *
 * Ce fichier est le contrat unique entre :
 *   - la source de données (simulateur aujourd'hui, API du centre d'appels demain)
 *   - le moteur de course
 *   - les composants d'interface
 *
 * Aucun composant React n'importe autre chose que ces types pour décrire un agent.
 *
 * ---
 * ⚠️ PLUS une copie conforme de race-pulse (2D) depuis le passage aux
 * ÉQUIPES (24/08) : `Instantane` gagne deux champs optionnels (`modeKart`,
 * `equipes`) que la 2D ignore. Le reste du contrat est inchangé — un
 * correctif de la partie commune se reporte toujours dans les deux dépôts.
 */

/** Les trois horizons de classement proposés à l'écran. */
export type Periode = 'jour' | 'semaine' | 'mois'

export const PERIODES: readonly Periode[] = ['jour', 'semaine', 'mois'] as const

export const LIBELLES_PERIODE: Record<Periode, string> = {
  jour: "Aujourd'hui",
  semaine: 'Cette semaine',
  mois: 'Ce mois',
}

/** Identifiant stable d'un agent. Doit rester identique entre deux mises à jour. */
export type AgentId = string

/**
 * Profil d'un agent. Ces données changent rarement :
 * elles proviendront de l'annuaire du centre d'appels.
 */
export interface Agent {
  id: AgentId
  /** Nom ou pseudonyme affiché à côté du kart. */
  nom: string
  /** Équipe / pôle de rattachement. */
  equipe: string
  /** Couleur du kart, au format hexadécimal. */
  couleur: string
  /** Initiales affichées dans la pastille d'avatar. */
  initiales: string
}

/** Score brut de l'agent pour chaque période, en points de performance. */
export type ScoresParPeriode = Record<Periode, number>

/**
 * Tendance en pourcentage : écart entre le rythme récent de l'agent
 * et son rythme moyen. Positif = accélération, négatif = ralentissement.
 */
export type TendancesParPeriode = Record<Periode, number>

/** Performance mesurée d'un agent à l'instant de la mise à jour. */
export interface Performance {
  agentId: AgentId
  scores: ScoresParPeriode
  tendances: TendancesParPeriode
}

export type TypeEvenement =
  | 'depart'
  | 'depassement'
  | 'boost'
  | 'record'
  | 'objectif'
  | 'ralentissement'

/** Fait de course affiché dans le fil d'actualité. */
export interface EvenementCourse {
  id: string
  /** Epoch en millisecondes. */
  horodatage: number
  type: TypeEvenement
  message: string
  agentId?: AgentId
}

/** KPI d'une équipe (mode équipes — piloté par l'API du dashboard). */
export type KpiEquipe = 'ss_per_hour' | 'ingepl_per_hour' | 'calls_per_hour' | 'cases_per_day'

/** Mesure d'une équipe sur une période (jour, semaine ou mois). */
export interface MesurePeriodeEquipe {
  /** Taux mesuré (ex. 4,2 RDV/h) — l'unité dépend du KPI. */
  taux: number
  /** Numérateur brut avant pénalités (RDV, INGEPL, appels, dossiers). */
  brut: number
  /** Somme des ajustements de la période (négatif = pénalités). */
  penalites: number
  /** Heures de login des campagnes de l'équipe. */
  heures: number
  /** Temps de traitement moyen (info inbound), en secondes. */
  traitementSec: number
  /** Les agents de l'équipe, triés par taux décroissant. */
  agents: Array<{ id: string; nom: string; taux: number; brut: number }>
}

/** Détail d'une équipe pour le panneau latéral (mode équipes). */
export interface EquipeInfo {
  id: string
  nom: string
  couleur: string
  kpi: KpiEquipe
  /** 'per_day' : l'objectif est un montant journalier (0017). */
  goalUnit: 'per_hour' | 'per_day'
  /** La cible (objectif fixé en admin, ou moyenne 30 j en repli). */
  objectif: number | null
  objectifSource: 'objectif' | 'moyenne30' | null
  periodes: Record<Periode, MesurePeriodeEquipe>
  /** « Penalty point −1 » : les entrées récentes, avec leur raison. */
  penalites: Array<{ date: string; delta: number; raison: string }>
}

/** Une page du mur : une course, une période, une ambiance (0016). */
export interface VueMur {
  id: string
  nom: string
  periode: 'vandaag' | 'deze_week' | 'deze_maand' | 'libre'
  du: string
  au: string
  dwellSec: number
  ambiance: 'ochtend' | 'zonsondergang' | 'nacht'
  /** La course de la page, prête à afficher par le moteur existant. */
  instantane: Instantane
}

/**
 * Photographie complète de la course à un instant donné.
 * C'est l'unique objet qu'une source de données doit savoir produire.
 */
export interface Instantane {
  agents: Agent[]
  performances: Performance[]
  /** Score à atteindre pour franchir la ligne d'arrivée, par période. */
  objectifs: ScoresParPeriode
  /** Du plus récent au plus ancien. */
  evenements: EvenementCourse[]
  /** Epoch en millisecondes de la mesure. */
  miseAJour: number
  /** Origine des données — affichée à l'écran pour lever toute ambiguïté. */
  source: 'simulation' | 'api'
  /** Mode d'affichage décidé par la config admin (API) : 1 kart/équipe ou 1 kart/agent. */
  modeKart?: 'team' | 'agent'
  /** Détail des équipes (API) — les scores des karts sont alors des % d'objectif. */
  equipes?: EquipeInfo[]
  /** Les pages du carrousel mural (API) — présentes dès qu'une page est active. */
  vues?: VueMur[]
}
