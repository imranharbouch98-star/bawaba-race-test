/**
 * Simulateur de données — remplace temporairement l'API du centre d'appels.
 *
 * Il produit exactement le même `Instantane` que produira l'API réelle.
 * Le reste de l'application ignore totalement qu'il s'agit d'une simulation.
 *
 * Principe : les scores sont **cumulatifs**. Un agent qui performe moins bien
 * accumule plus lentement, mais ne perd jamais de points — c'est ce qui
 * garantit qu'un kart ne recule jamais au cours d'une même période.
 *
 * ---
 * Copie conforme depuis race-pulse (2D) — src/data/SimulateurCourse.ts.
 * Aucune ligne de logique modifiée. En cas de correctif ici (dont la
 * détection de dépassement qui pilote le réalisateur de caméra 3D), le
 * reporter dans les deux dépôts.
 */

import type {
  Agent,
  EvenementCourse,
  Instantane,
  Performance,
  ScoresParPeriode,
  TypeEvenement,
} from '../domain/types'
import { progressionVersObjectif } from '../domain/classement'
import type { Desabonnement, SourceDonnees } from './SourceDonnees'
import { AGENTS, OBJECTIFS } from './agents'

/** Fenêtre entre deux mises à jour automatiques, en millisecondes. */
const DELAI_MIN = 8_000
const DELAI_MAX = 15_000

const MAX_EVENEMENTS = 14

/**
 * Durée d'une journée simulée, en minutes.
 *
 * Auparavant la journée basculait dès que TOUS les agents avaient franchi
 * l'objectif. Avec le modèle en tours, cette règle empêchait mécaniquement
 * d'observer un deuxième tour : le meneur était remis à zéro dès que le
 * dernier le rattrapait. Une vraie journée se termine à une heure fixe, pas
 * quand le peloton a fini.
 *
 * Vingt minutes, valeur mesurée et non devinée. Au rythme de gain de
 * `tirerGain`, cela donne un meneur autour de 2,6 tours, une médiane proche
 * de 2, et l'ensemble du peloton au-dessus d'un tour — un écart lisible sans
 * que les compteurs deviennent absurdes. Nettement plus court, personne ne
 * boucle son premier tour et le modèle en tours reste invisible ; nettement
 * plus long, on affiche « 6 tours » et le chiffre perd son sens.
 *
 * `?journee=<minutes>` raccourcit la journée pour une démonstration où l'on
 * veut montrer une bascule sans attendre.
 */
const DUREE_JOURNEE_MINUTES = 20

function lireDureeJournee(): number {
  // `globalThis` plutôt que `window` : ce module est aussi chargé côté
  // serveur par l'API simulée de développement, où le type DOM n'existe pas.
  const recherche = (globalThis as { location?: { search?: string } }).location?.search
  if (recherche === undefined) return DUREE_JOURNEE_MINUTES * 60_000
  const valeur = Number(new URLSearchParams(recherche).get('journee'))
  const minutes =
    Number.isFinite(valeur) && valeur > 0 ? Math.min(480, Math.max(0.5, valeur)) : DUREE_JOURNEE_MINUTES
  return minutes * 60_000
}

/** Paliers de progression qui déclenchent une annonce. */
const PALIERS = [0.25, 0.5, 0.75, 0.9, 1] as const

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Une graine fixe rend la démonstration reproductible d'une session à l'autre.
 */
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

interface EtatAgent {
  agent: Agent
  /** Points acquis depuis le début de la journée. */
  scoreJour: number
  /** Points acquis les jours précédents de la semaine / du mois. */
  reportSemaine: number
  reportMois: number
  /** Rythme nominal de l'agent, en points par mise à jour. */
  rythme: number
  /** Moyennes glissantes du gain, sur trois horizons. */
  emaCourt: number
  emaMoyen: number
  emaLong: number
  /** Paliers déjà annoncés, pour ne pas les répéter. */
  paliersFranchis: Set<number>
}

const LISSAGE_COURT = 0.45
const LISSAGE_MOYEN = 0.18
const LISSAGE_LONG = 0.07

export class SimulateurCourse implements SourceDonnees {
  readonly type = 'simulation' as const
  readonly libelle = 'Source de données simulée'

  private readonly aleatoire = creerAleatoire(20260729)
  private readonly etats: EtatAgent[]
  private readonly objectifs: ScoresParPeriode = { ...OBJECTIFS }
  private readonly dureeJourneeMs = lireDureeJournee()
  private debutJournee = Date.now()
  private evenements: EvenementCourse[] = []
  private ecouteurs = new Set<(instantane: Instantane) => void>()
  private minuteur: ReturnType<typeof setTimeout> | null = null
  private compteurEvenement = 0
  private miseAJour = Date.now()

  constructor(agents: Agent[] = AGENTS) {
    this.etats = agents.map((agent) => this.creerEtatInitial(agent))
    this.evenements = [
      this.creerEvenement('depart', 'Départ donné — la course de la journée est lancée.'),
    ]
  }

  souscrire(ecouteur: (instantane: Instantane) => void): Desabonnement {
    this.ecouteurs.add(ecouteur)
    ecouteur(this.instantane())
    this.planifier()
    return () => {
      this.ecouteurs.delete(ecouteur)
      if (this.ecouteurs.size === 0) this.arreter()
    }
  }

  rafraichir(): void {
    this.avancer()
    this.planifier()
  }

  private arreter(): void {
    if (this.minuteur !== null) {
      clearTimeout(this.minuteur)
      this.minuteur = null
    }
  }

  private planifier(): void {
    this.arreter()
    if (this.ecouteurs.size === 0) return
    const delai = DELAI_MIN + this.aleatoire() * (DELAI_MAX - DELAI_MIN)
    this.minuteur = setTimeout(() => {
      this.avancer()
      this.planifier()
    }, delai)
  }

  // --- Construction de l'état initial -------------------------------------

  private creerEtatInitial(agent: Agent): EtatAgent {
    const rythme = 2.6 + this.aleatoire() * 2.8
    const scoreJour = this.objectifs.jour * (0.18 + this.aleatoire() * 0.44)
    return {
      agent,
      scoreJour,
      reportSemaine: this.objectifs.semaine * (0.2 + this.aleatoire() * 0.35),
      reportMois: this.objectifs.mois * (0.3 + this.aleatoire() * 0.35),
      rythme,
      emaCourt: rythme,
      emaMoyen: rythme,
      emaLong: rythme,
      paliersFranchis: new Set(
        PALIERS.filter((p) => progressionVersObjectif(scoreJour, this.objectifs.jour) >= p),
      ),
    }
  }

  // --- Avancement ---------------------------------------------------------

  private avancer(): void {
    const rangsPrecedents = this.rangsActuels()
    const nouveauxEvenements: EvenementCourse[] = []

    for (const etat of this.etats) {
      const gain = this.tirerGain(etat)

      etat.scoreJour += gain
      etat.emaCourt += (gain - etat.emaCourt) * LISSAGE_COURT
      etat.emaMoyen += (gain - etat.emaMoyen) * LISSAGE_MOYEN
      etat.emaLong += (gain - etat.emaLong) * LISSAGE_LONG

      if (gain > etat.rythme * 2) {
        nouveauxEvenements.push(
          this.creerEvenement(
            'boost',
            `${etat.agent.nom} enchaîne les dossiers : +${Math.round(gain)} points.`,
            etat.agent.id,
          ),
        )
      } else if (gain < etat.rythme * 0.3 && this.aleatoire() < 0.45) {
        nouveauxEvenements.push(
          this.creerEvenement(
            'ralentissement',
            `${etat.agent.nom} lève le pied — progression ralentie.`,
            etat.agent.id,
          ),
        )
      }

      nouveauxEvenements.push(...this.evenementsDePalier(etat))
    }

    nouveauxEvenements.push(...this.evenementsDeDepassement(rangsPrecedents))

    this.miseAJour = Date.now()
    this.evenements = [...this.melangerEtLimiter(nouveauxEvenements), ...this.evenements].slice(
      0,
      MAX_EVENEMENTS,
    )

    // La journée s'achève au bout d'une durée fixe, pas quand le peloton a
    // fini : c'est ce qui laisse les meilleurs agents boucler plusieurs tours.
    // Mesurée en temps réel plutôt qu'en nombre de mises à jour, dont
    // l'intervalle varie de 8 à 15 secondes.
    if (Date.now() - this.debutJournee >= this.dureeJourneeMs) {
      this.nouvelleJournee()
    }

    this.diffuser()
  }

  /**
   * Bascule de journée. Les points du jour viennent alimenter les cumuls
   * hebdomadaire et mensuel, puis la grille de départ est remise à zéro.
   * Lorsqu'un cumul atteint son objectif, la période correspondante repart
   * elle aussi — exactement ce que fera l'API à minuit ou en fin de semaine.
   */
  private nouvelleJournee(): void {
    this.debutJournee = Date.now()
    for (const etat of this.etats) {
      etat.reportSemaine += etat.scoreJour
      etat.reportMois += etat.scoreJour

      if (etat.reportSemaine > this.objectifs.semaine * 0.9) {
        etat.reportSemaine = this.objectifs.semaine * (0.05 + this.aleatoire() * 0.15)
      }
      if (etat.reportMois > this.objectifs.mois * 0.9) {
        etat.reportMois = this.objectifs.mois * (0.08 + this.aleatoire() * 0.2)
      }

      etat.scoreJour = this.objectifs.jour * this.aleatoire() * 0.05
      etat.paliersFranchis.clear()
    }

    this.evenements = [
      this.creerEvenement('depart', 'Nouvelle journée — les karts repartent de la ligne de départ.'),
      ...this.evenements,
    ].slice(0, MAX_EVENEMENTS)
  }

  /**
   * Gain de la période. Le facteur de fatigue étale le peloton :
   * plus un agent est proche de son objectif, plus il progresse lentement.
   */
  private tirerGain(etat: EtatAgent): number {
    const tirage = this.aleatoire()
    let facteur = 0.35 + this.aleatoire() * 1.3
    if (tirage < 0.09) facteur *= 2.4 // coup de chaud
    else if (tirage > 0.93) facteur *= 0.15 // coup de mou

    const avancement = progressionVersObjectif(etat.scoreJour, this.objectifs.jour)
    const fatigue = 1 - 0.55 * avancement
    return Math.max(0, etat.rythme * facteur * fatigue)
  }

  private evenementsDePalier(etat: EtatAgent): EvenementCourse[] {
    const avancement = progressionVersObjectif(etat.scoreJour, this.objectifs.jour)
    const evenements: EvenementCourse[] = []
    for (const palier of PALIERS) {
      if (avancement >= palier && !etat.paliersFranchis.has(palier)) {
        etat.paliersFranchis.add(palier)
        evenements.push(
          palier === 1
            ? this.creerEvenement(
                'record',
                `${etat.agent.nom} franchit la ligne d'arrivée du jour !`,
                etat.agent.id,
              )
            : this.creerEvenement(
                'objectif',
                `${etat.agent.nom} passe les ${Math.round(palier * 100)} % de l'objectif.`,
                etat.agent.id,
              ),
        )
      }
    }
    return evenements
  }

  private evenementsDeDepassement(rangsPrecedents: Map<string, number>): EvenementCourse[] {
    const ordre = this.ordreParScoreJour()
    for (let i = 0; i < ordre.length - 1; i += 1) {
      const devant = ordre[i]
      const derriere = ordre[i + 1]
      const rangDevant = rangsPrecedents.get(devant.agent.id)
      const rangDerriere = rangsPrecedents.get(derriere.agent.id)
      if (rangDevant !== undefined && rangDerriere !== undefined && rangDevant > rangDerriere) {
        return [
          this.creerEvenement(
            'depassement',
            `${devant.agent.nom} dépasse ${derriere.agent.nom} et prend la ${i + 1}ᵉ place.`,
            devant.agent.id,
          ),
        ]
      }
    }
    return []
  }

  private melangerEtLimiter(evenements: EvenementCourse[]): EvenementCourse[] {
    // Au plus trois annonces par mise à jour, pour garder un fil lisible.
    const prioritaires = evenements.filter((e) => e.type === 'record' || e.type === 'depassement')
    const autres = evenements.filter((e) => e.type !== 'record' && e.type !== 'depassement')
    return [...prioritaires, ...autres].slice(0, 3)
  }

  // --- Utilitaires --------------------------------------------------------

  private ordreParScoreJour(): EtatAgent[] {
    return [...this.etats].sort((a, b) => b.scoreJour - a.scoreJour)
  }

  private rangsActuels(): Map<string, number> {
    return new Map(this.ordreParScoreJour().map((etat, index) => [etat.agent.id, index]))
  }

  private creerEvenement(
    type: TypeEvenement,
    message: string,
    agentId?: string,
  ): EvenementCourse {
    this.compteurEvenement += 1
    return {
      id: `ev-${this.compteurEvenement}`,
      horodatage: Date.now(),
      type,
      message,
      agentId,
    }
  }

  /** Tendance = écart entre le rythme récent et le rythme nominal, en %. */
  private tendance(recent: number, rythme: number): number {
    return Math.max(-45, Math.min(45, (recent / rythme - 1) * 100))
  }

  private performances(): Performance[] {
    return this.etats.map((etat) => ({
      agentId: etat.agent.id,
      scores: {
        jour: Math.round(etat.scoreJour),
        semaine: Math.round(etat.reportSemaine + etat.scoreJour),
        mois: Math.round(etat.reportMois + etat.scoreJour),
      },
      tendances: {
        jour: this.tendance(etat.emaCourt, etat.rythme),
        semaine: this.tendance(etat.emaMoyen, etat.rythme),
        mois: this.tendance(etat.emaLong, etat.rythme),
      },
    }))
  }

  private instantane(): Instantane {
    return {
      agents: this.etats.map((etat) => etat.agent),
      performances: this.performances(),
      objectifs: this.objectifs,
      evenements: this.evenements,
      miseAJour: this.miseAJour,
      source: this.type,
    }
  }

  private diffuser(): void {
    const instantane = this.instantane()
    for (const ecouteur of this.ecouteurs) ecouteur(instantane)
  }
}
