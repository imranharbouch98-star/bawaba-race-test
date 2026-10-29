/**
 * Branchement sur l'API réelle du centre d'appels.
 *
 * `creerSourceDonnees()` utilise cette source dès que la variable
 * d'environnement `VITE_RACE_PULSE_API_URL` est définie — pointée sur
 * `GET /api/jeu/classement` du dashboard BawabaDash.
 *
 * Deux formats de charge utile sont acceptés :
 *   - le format ÉQUIPES du dashboard (clé `equipes`) : chaque équipe (ou
 *     chaque agent, selon `settings.kart_mode`) devient un kart dont le
 *     score est son AVANCEMENT VERS SON PROPRE OBJECTIF, en % (ratio × 100,
 *     objectifs fixés à 100). Un tour bouclé = un objectif atteint. Aucun
 *     écart entre karts n'est calculé ni affiché — motivation positive.
 *   - le format générique historique (clé `agents`), conservé pour
 *     compatibilité avec la 2D et les captures de démonstration.
 *
 * ---
 * ⚠️ PLUS une copie conforme de race-pulse (2D) depuis le passage aux
 * équipes (24/08) : l'adaptateur `versInstantane` comprend en plus le
 * payload équipes, que la 2D ignore. La partie générique reste commune —
 * un correctif s'y reporte dans les deux dépôts.
 */

import type {
  Agent,
  EquipeInfo,
  EvenementCourse,
  Instantane,
  KpiEquipe,
  MesurePeriodeEquipe,
  Performance,
  Periode,
  TypeEvenement,
  VueMur,
} from '../domain/types'
import { PERIODES } from '../domain/types'
import type { Desabonnement, SourceDonnees } from './SourceDonnees'
import { OBJECTIFS } from './agents'

/** Intervalle d'interrogation de l'API, en millisecondes. */
const PERIODE_SONDAGE = 10_000

/** Palette de repli si l'API ne fournit pas de couleur de kart. */
const COULEURS_REPLI = [
  '#ff6b57',
  '#22d3ee',
  '#ffc93c',
  '#a78bfa',
  '#7ee787',
  '#f472b6',
  '#fb923c',
  '#60a5fa',
  '#34d399',
  '#e879f9',
]

/** Charge utile générique historique (compatible 2D). */
export interface ReponseApi {
  updated_at?: string
  goals?: { daily?: number; weekly?: number; monthly?: number }
  agents: Array<{
    id: string
    display_name: string
    team?: string
    color?: string
    daily_score?: number
    weekly_score?: number
    monthly_score?: number
    daily_trend?: number
    weekly_trend?: number
    monthly_trend?: number
  }>
  events?: Array<{
    id: string
    at?: string
    kind?: string
    message: string
    agent_id?: string
  }>
}

/** Charge utile ÉQUIPES de `GET /api/jeu/classement` (dashboard V2). */
export interface ReponseApiEquipes {
  updated_at?: string
  settings?: { kart_mode?: string; refresh_sec?: number }
  equipes: Array<{
    id: string
    name: string
    color?: string
    kpi: string
    goal_unit?: string
    objectif: number | null
    objectif_source: 'objectif' | 'moyenne30' | null
    periodes: Record<
      string,
      {
        taux: number
        brut: number
        penalites: number
        heures: number
        traitement_moyen_sec: number
        ratio: number | null
        agents: Array<{ id: string; nom: string; taux: number; brut: number }>
      }
    >
  }>
  penalites?: Array<{ team_id: string; work_date: string; delta: number; reason: string }>
  vues?: Array<{
    id: string
    name: string
    team_id: string
    team_name: string
    color?: string
    kpi: string
    goal_unit?: string
    periode: string
    du: string
    au: string
    dwell_sec: number
    ambiance: string
    sort_order: number
    objectif: number | null
    objectif_source: 'objectif' | 'moyenne30' | null
    mesure: {
      taux: number
      brut: number
      penalites: number
      heures: number
      traitement_moyen_sec: number
      ratio: number | null
      agents: Array<{ id: string; nom: string; taux: number; brut: number }>
    }
  }>
}

function initialesDepuisNom(nom: string): string {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join('')
}

const TYPES_EVENEMENT: readonly TypeEvenement[] = [
  'depart',
  'depassement',
  'boost',
  'record',
  'objectif',
  'ralentissement',
]

function versTypeEvenement(valeur: string | undefined): TypeEvenement {
  return TYPES_EVENEMENT.find((type) => type === valeur) ?? 'objectif'
}

const KPIS: readonly KpiEquipe[] = [
  'ss_per_hour',
  'ingepl_per_hour',
  'calls_per_hour',
  'cases_per_day',
]

function versKpi(valeur: string): KpiEquipe {
  return KPIS.find((kpi) => kpi === valeur) ?? 'calls_per_hour'
}

/** Objectifs du mode équipes : 100 % par période — un tour = un objectif. */
const OBJECTIFS_POURCENT = { jour: 100, semaine: 100, mois: 100 } as const

const PERIODE_VIDE: MesurePeriodeEquipe = {
  taux: 0,
  brut: 0,
  penalites: 0,
  heures: 0,
  traitementSec: 0,
  agents: [],
}

/** Traduit le payload équipes du dashboard vers le modèle du domaine. */
export function versInstantaneEquipes(reponse: ReponseApiEquipes): Instantane {
  const modeKart = reponse.settings?.kart_mode === 'agent' ? 'agent' : 'team'
  const miseAJour = reponse.updated_at ? Date.parse(reponse.updated_at) : Date.now()

  const equipes: EquipeInfo[] = reponse.equipes.map((brut, index) => {
    const periodes = Object.fromEntries(
      PERIODES.map((periode) => {
        const p = brut.periodes[periode]
        if (!p) return [periode, PERIODE_VIDE]
        return [
          periode,
          {
            taux: p.taux,
            brut: p.brut,
            penalites: p.penalites,
            heures: p.heures,
            traitementSec: p.traitement_moyen_sec,
            agents: p.agents,
          },
        ]
      }),
    ) as Record<Periode, MesurePeriodeEquipe>

    return {
      id: brut.id,
      nom: brut.name,
      couleur: brut.color ?? COULEURS_REPLI[index % COULEURS_REPLI.length],
      kpi: versKpi(brut.kpi),
      goalUnit: brut.goal_unit === 'per_day' ? 'per_day' : 'per_hour',
      objectif: brut.objectif,
      objectifSource: brut.objectif_source,
      periodes,
      penalites: (reponse.penalites ?? [])
        .filter((p) => p.team_id === brut.id)
        .map((p) => ({ date: p.work_date.slice(0, 10), delta: p.delta, raison: p.reason })),
    }
  })

  // Score d'un kart = avancement vers SON objectif, en % (le ratio est déjà
  // calculé côté serveur pour les équipes ; pour un agent, même formule avec
  // l'objectif de son équipe). Jamais d'écart entre karts.
  const pourcent = (taux: number, objectif: number | null): number =>
    objectif !== null && objectif > 0 ? Math.max(0, Math.round((taux / objectif) * 10000) / 100) : 0

  let agents: Agent[]
  let performances: Performance[]

  if (modeKart === 'agent') {
    // Un kart par agent : l'effectif est l'union des agents vus sur le mois
    // (la fenêtre la plus large), aux couleurs de leur équipe.
    agents = []
    performances = []
    for (const equipe of equipes) {
      const roster = new Map<string, string>()
      for (const periode of PERIODES) {
        for (const a of equipe.periodes[periode].agents) {
          if (!roster.has(a.id)) roster.set(a.id, a.nom)
        }
      }
      for (const [id, nom] of roster) {
        agents.push({
          id: `${equipe.id}:${id}`,
          nom,
          equipe: equipe.nom,
          // La couleur d'équipe rendait TOUT le plateau monochrome dès
          // qu'une seule équipe existe (retour Maya 26/08) : en mode agent,
          // chaque kart prend sa couleur de palette — l'équipe reste lisible
          // dans le panneau et le détail.
          couleur: COULEURS_REPLI[agents.length % COULEURS_REPLI.length],
          initiales: initialesDepuisNom(nom),
        })
        const tauxDe = (periode: Periode): number =>
          equipe.periodes[periode].agents.find((a) => a.id === id)?.taux ?? 0
        performances.push({
          agentId: `${equipe.id}:${id}`,
          scores: {
            jour: pourcent(tauxDe('jour'), equipe.objectif),
            semaine: pourcent(tauxDe('semaine'), equipe.objectif),
            mois: pourcent(tauxDe('mois'), equipe.objectif),
          },
          tendances: { jour: 0, semaine: 0, mois: 0 },
        })
      }
    }
  } else {
    agents = equipes.map((equipe) => ({
      id: equipe.id,
      nom: equipe.nom,
      equipe: equipe.nom,
      couleur: equipe.couleur,
      initiales: initialesDepuisNom(equipe.nom),
    }))
    performances = equipes.map((equipe) => ({
      agentId: equipe.id,
      scores: {
        jour: pourcent(equipe.periodes.jour.taux, equipe.objectif),
        semaine: pourcent(equipe.periodes.semaine.taux, equipe.objectif),
        mois: pourcent(equipe.periodes.mois.taux, equipe.objectif),
      },
      tendances: { jour: 0, semaine: 0, mois: 0 },
    }))
  }

  // Les pénalités récentes alimentent le fil des faits de course (panneau de
  // développement) ; l'affichage mural les montre dans le détail d'équipe.
  const nomEquipe = new Map(equipes.map((e) => [e.id, e.nom]))
  const evenements: EvenementCourse[] = (reponse.penalites ?? [])
    .map((p, index) => ({
      id: `penalite-${p.team_id}-${p.work_date}-${index}`,
      horodatage: Date.parse(`${p.work_date.slice(0, 10)}T12:00:00Z`) || miseAJour,
      type: 'ralentissement' as const,
      message: `Penalty point ${p.delta > 0 ? `+${p.delta}` : p.delta} — ${nomEquipe.get(p.team_id) ?? p.team_id} — ${p.reason}`,
      agentId: p.team_id,
    }))
    .sort((a, b) => b.horodatage - a.horodatage)

  // Les pages du carrousel : chaque vue devient une mini-course autonome —
  // les agents de SA course, mesurés sur SA fenêtre, dans le moteur existant
  // (scores = ratio × 100, objectifs à 100, mêmes règles que le reste).
  const AMBIANCES = ['ochtend', 'zonsondergang', 'nacht'] as const
  const PERIODES_VUE = ['vandaag', 'deze_week', 'deze_maand', 'libre'] as const
  const vuesMur: VueMur[] = (reponse.vues ?? []).map((v) => {
    const kpi = versKpi(v.kpi)
    const agentsVue: Agent[] = v.mesure.agents.map((a, index) => ({
      id: a.id,
      nom: a.nom,
      equipe: v.team_name,
      couleur: COULEURS_REPLI[index % COULEURS_REPLI.length],
      initiales: initialesDepuisNom(a.nom),
    }))
    const performancesVue: Performance[] = v.mesure.agents.map((a) => {
      const p = pourcent(a.taux, v.objectif)
      return { agentId: a.id, scores: { jour: p, semaine: p, mois: p }, tendances: { jour: 0, semaine: 0, mois: 0 } }
    })
    const mesure: MesurePeriodeEquipe = {
      taux: v.mesure.taux,
      brut: v.mesure.brut,
      penalites: v.mesure.penalites,
      heures: v.mesure.heures,
      traitementSec: v.mesure.traitement_moyen_sec,
      agents: v.mesure.agents,
    }
    const equipeVue: EquipeInfo = {
      id: v.team_id,
      nom: v.team_name,
      couleur: v.color ?? COULEURS_REPLI[0],
      kpi,
      goalUnit: v.goal_unit === 'per_day' ? 'per_day' : 'per_hour',
      objectif: v.objectif,
      objectifSource: v.objectif_source,
      periodes: { jour: mesure, semaine: mesure, mois: mesure },
      penalites: (reponse.penalites ?? [])
        .filter((p) => p.team_id === v.team_id)
        .map((p) => ({ date: p.work_date.slice(0, 10), delta: p.delta, raison: p.reason })),
    }
    return {
      id: v.id,
      nom: v.name,
      periode: PERIODES_VUE.find((x) => x === v.periode) ?? 'vandaag',
      du: String(v.du).slice(0, 10),
      au: String(v.au).slice(0, 10),
      dwellSec: Math.max(5, Number(v.dwell_sec) || 45),
      ambiance: AMBIANCES.find((x) => x === v.ambiance) ?? 'ochtend',
      instantane: {
        agents: agentsVue,
        performances: performancesVue,
        objectifs: { ...OBJECTIFS_POURCENT },
        evenements,
        miseAJour,
        source: 'api',
        modeKart: 'agent',
        equipes: [equipeVue],
      },
    }
  })

  return {
    agents,
    performances,
    objectifs: { ...OBJECTIFS_POURCENT },
    evenements,
    miseAJour,
    source: 'api',
    modeKart,
    equipes,
    ...(vuesMur.length > 0 ? { vues: vuesMur } : {}),
  }
}

/** Traduit la charge utile de l'API vers le modèle du domaine. */
export function versInstantane(reponse: ReponseApi | ReponseApiEquipes): Instantane {
  if ('equipes' in reponse) return versInstantaneEquipes(reponse)

  const agents: Agent[] = reponse.agents.map((brut, index) => ({
    id: brut.id,
    nom: brut.display_name,
    equipe: brut.team ?? 'Sans équipe',
    couleur: brut.color ?? COULEURS_REPLI[index % COULEURS_REPLI.length],
    initiales: initialesDepuisNom(brut.display_name),
  }))

  const performances: Performance[] = reponse.agents.map((brut) => ({
    agentId: brut.id,
    scores: {
      jour: brut.daily_score ?? 0,
      semaine: brut.weekly_score ?? 0,
      mois: brut.monthly_score ?? 0,
    },
    tendances: {
      jour: brut.daily_trend ?? 0,
      semaine: brut.weekly_trend ?? 0,
      mois: brut.monthly_trend ?? 0,
    },
  }))

  const evenements: EvenementCourse[] = (reponse.events ?? []).map((brut) => ({
    id: brut.id,
    horodatage: brut.at ? Date.parse(brut.at) : Date.now(),
    type: versTypeEvenement(brut.kind),
    message: brut.message,
    agentId: brut.agent_id,
  }))

  return {
    agents,
    performances,
    objectifs: {
      jour: reponse.goals?.daily ?? OBJECTIFS.jour,
      semaine: reponse.goals?.weekly ?? OBJECTIFS.semaine,
      mois: reponse.goals?.monthly ?? OBJECTIFS.mois,
    },
    evenements,
    miseAJour: reponse.updated_at ? Date.parse(reponse.updated_at) : Date.now(),
    source: 'api',
  }
}

export class SourceApi implements SourceDonnees {
  readonly type = 'api' as const
  readonly libelle = 'Données du centre d’appels'

  private ecouteurs = new Set<(instantane: Instantane) => void>()
  private minuteur: ReturnType<typeof setInterval> | null = null
  private dernier: Instantane | null = null
  private readonly url: string

  constructor(url: string) {
    this.url = url
  }

  souscrire(ecouteur: (instantane: Instantane) => void): Desabonnement {
    this.ecouteurs.add(ecouteur)
    if (this.dernier) ecouteur(this.dernier)
    void this.interroger()
    if (this.minuteur === null) {
      this.minuteur = setInterval(() => void this.interroger(), PERIODE_SONDAGE)
    }
    return () => {
      this.ecouteurs.delete(ecouteur)
      if (this.ecouteurs.size === 0 && this.minuteur !== null) {
        clearInterval(this.minuteur)
        this.minuteur = null
      }
    }
  }

  rafraichir(): void {
    void this.interroger()
  }

  private async interroger(): Promise<void> {
    try {
      const reponse = await fetch(this.url, { headers: { Accept: 'application/json' } })
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
      const instantane = versInstantane((await reponse.json()) as ReponseApi | ReponseApiEquipes)
      this.dernier = instantane
      for (const ecouteur of this.ecouteurs) ecouteur(instantane)
    } catch (erreur) {
      // On conserve le dernier instantané valide : l'écran ne se vide jamais.
      console.error('[Race Pulse] Mise à jour impossible depuis l’API.', erreur)
    }
  }
}
