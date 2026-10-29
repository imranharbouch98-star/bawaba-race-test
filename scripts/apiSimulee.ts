/**
 * Faux endpoint de développement — sert le simulateur en HTTP.
 *
 * Pourquoi : `SourceApi` (le client HTTP réel) n'avait jamais été exécuté.
 * Le simulateur alimente l'application en mémoire, sans jamais passer par
 * `fetch`, la conversion `versInstantane`, ni la gestion d'erreur réseau.
 * Tout ce chemin restait donc théorique jusqu'à l'arrivée de la vraie API.
 *
 * Ce que ce module N'EST PAS : un test d'intégration. Il produit exactement
 * la forme que le frontend attend, donc il passera forcément — il ne dit
 * rien de ce que renverra le vrai backend. Il valide le BRANCHEMENT, pas le
 * contrat.
 *
 * Ce qu'il apporte en revanche :
 *  - le chemin HTTP complet s'exécute enfin pour de vrai ;
 *  - il sert de référence exécutable pour l'API à écrire — « ton service
 *    doit renvoyer ceci » est plus clair qu'un paragraphe de spécification.
 *
 * Il n'ajoute aucun serveur ni aucune dépendance : c'est un middleware du
 * serveur de développement Vite, qui vit et meurt avec lui. La donnée servie
 * est celle du simulateur déjà utilisé par l'application — pas un second
 * jeu de fausses données à maintenir en parallèle.
 */

import type { Connect, Plugin } from 'vite'
import { SimulateurCourse } from '../src/data/SimulateurCourse'
import type { Instantane } from '../src/domain/types'

/** Chemin servi. À reprendre tel quel dans `VITE_RACE_PULSE_API_URL`. */
export const CHEMIN_API_SIMULEE = '/api/course/instantane'

/**
 * Second endpoint : le format ÉQUIPES de `GET /api/jeu/classement` du
 * dashboard BawabaDash. Même vertu de référence exécutable — c'est la forme
 * exacte que le dashboard renvoie — et c'est la façon de voir le mode
 * équipes en local avant que Maya ait composé les siennes :
 * `VITE_RACE_PULSE_API_URL=/api/course/equipes npm run dev`.
 */
export const CHEMIN_API_EQUIPES = '/api/course/equipes'

/** Équipes d'exemple, calquées sur la feuille de Maya (24/08). */
const EQUIPES_DEMO = [
  { id: 'eq-fc-leads', name: 'FC Leads', color: '#ff6b57', kpi: 'ss_per_hour', objectif: 4, source: 'objectif', base: 3.4, agents: ['Samira B', 'Yassine K', 'Nora E', 'Hamza T'] },
  { id: 'eq-onderhoud', name: 'Onderhoud', color: '#22d3ee', kpi: 'ingepl_per_hour', objectif: 6, source: 'objectif', base: 6.6, agents: ['Karim L', 'Fatiha Z', 'Imane R'] },
  { id: 'eq-inbound', name: 'Inbound', color: '#ffc93c', kpi: 'calls_per_hour', objectif: 11.2, source: 'moyenne30', base: 10.1, agents: ['Sofia M', 'Adam C', 'Lina D', 'Omar F'] },
  { id: 'eq-fc-admin', name: 'FC Admin', color: '#a78bfa', kpi: 'cases_per_day', objectif: 9, source: 'moyenne30', base: 8.2, agents: ['Rachid A', 'Meryem O'] },
  { id: 'eq-solar', name: 'Solar', color: '#7ee787', kpi: 'ss_per_hour', objectif: 3.5, source: 'objectif', base: 2.6, agents: ['Bilal N', 'Aya S', 'Walid G'] },
  { id: 'eq-mabani', name: 'Mabani', color: '#f472b6', kpi: 'cases_per_day', objectif: 4, source: 'objectif', base: 4.5, agents: ['Imrane H'] },
] as const

function chargeUtileEquipes(plat = false) {
  // Une légère progression au fil de l'heure, pour voir les karts avancer
  // entre deux sondages — déterministe à la minute près.
  const minute = new Date().getMinutes()
  const jourISO = new Date().toISOString().slice(0, 10)

  const periode = (base: number, facteur: number, agents: readonly string[], idEquipe: string, objectif: number) => {
    // `plat` : toutes les équipes au même taux — le scénario « grille de
    // départ » (égalité parfaite) pour valider la formation en damier.
    const taux = plat ? 0 : Math.round((base * facteur + minute * 0.008) * 100) / 100
    const heures = Math.round(6.5 * facteur * 10) / 10
    return {
      taux,
      brut: Math.round(taux * heures),
      penalites: 0,
      heures,
      traitement_moyen_sec: idEquipe === 'eq-inbound' ? 176 : 0,
      ratio: objectif > 0 ? Math.round((taux / objectif) * 100) / 100 : null,
      agents: agents.map((nom, index) => ({
        id: `${idEquipe}-a${index}`,
        nom,
        taux: Math.round(taux * (1.25 - index * 0.15) * 100) / 100,
        brut: Math.round(taux * heures * (1.25 - index * 0.15)),
      })),
    }
  }

  return {
    updated_at: new Date().toISOString(),
    settings: { kart_mode: 'team', refresh_sec: 60 },
    equipes: EQUIPES_DEMO.map((equipe) => ({
      id: equipe.id,
      name: equipe.name,
      color: equipe.color,
      kpi: equipe.kpi,
      objectif: equipe.objectif,
      objectif_source: equipe.source,
      periodes: {
        jour: periode(equipe.base, 1, equipe.agents, equipe.id, equipe.objectif),
        semaine: periode(equipe.base, 0.94, equipe.agents, equipe.id, equipe.objectif),
        mois: periode(equipe.base, 0.9, equipe.agents, equipe.id, equipe.objectif),
      },
    })),
    penalites: [
      { team_id: 'eq-fc-leads', work_date: jourISO, delta: -1, reason: 'No-show afspraak' },
      { team_id: 'eq-onderhoud', work_date: jourISO, delta: -1, reason: 'Dubbele INGEPL geteld' },
    ],
    // Trois pages de démo pour le carrousel — le format exact du dashboard.
    vues: [
      { equipe: EQUIPES_DEMO[0], vid: 'vue-1', nom: 'Scores van vandaag', periodeVue: 'vandaag', du: jourISO, au: jourISO, facteur: 1, ambiance: 'ochtend', dwell: 20 },
      { equipe: EQUIPES_DEMO[1], vid: 'vue-2', nom: 'Deze maand — Onderhoud', periodeVue: 'deze_maand', du: `${jourISO.slice(0, 7)}-01`, au: jourISO, facteur: 0.9, ambiance: 'zonsondergang', dwell: 20 },
      { equipe: EQUIPES_DEMO[5], vid: 'vue-3', nom: 'Mabani sprint', periodeVue: 'libre', du: '2026-08-18', au: jourISO, facteur: 0.94, ambiance: 'nacht', dwell: 20 },
    ].map(({ equipe, vid, nom, periodeVue, du, au, facteur, ambiance, dwell }, index) => ({
      id: vid,
      name: nom,
      team_id: equipe.id,
      team_name: equipe.name,
      color: equipe.color,
      kpi: equipe.kpi,
      periode: periodeVue,
      du,
      au,
      dwell_sec: dwell,
      ambiance,
      sort_order: index,
      objectif: equipe.objectif,
      objectif_source: equipe.source,
      mesure: periode(equipe.base, facteur, equipe.agents, equipe.id, equipe.objectif),
    })),
    fraicheur: [],
  }
}

/**
 * Traduit un `Instantane` du domaine vers la charge utile HTTP.
 *
 * C'est l'exact inverse de `versInstantane()` côté client. Écrire les deux
 * sens a une vertu : la conversion aller-retour exerce réellement le
 * contrat, là où servir directement l'objet du domaine l'aurait
 * court-circuité et n'aurait rien prouvé.
 */
function versChargeUtile(instantane: Instantane) {
  const performanceParAgent = new Map(
    instantane.performances.map((performance) => [performance.agentId, performance]),
  )

  return {
    updated_at: new Date(instantane.miseAJour).toISOString(),
    goals: {
      daily: instantane.objectifs.jour,
      weekly: instantane.objectifs.semaine,
      monthly: instantane.objectifs.mois,
    },
    agents: instantane.agents.map((agent) => {
      const performance = performanceParAgent.get(agent.id)
      return {
        id: agent.id,
        display_name: agent.nom,
        team: agent.equipe,
        color: agent.couleur,
        daily_score: performance?.scores.jour ?? 0,
        weekly_score: performance?.scores.semaine ?? 0,
        monthly_score: performance?.scores.mois ?? 0,
        daily_trend: performance?.tendances.jour ?? 0,
        weekly_trend: performance?.tendances.semaine ?? 0,
        monthly_trend: performance?.tendances.mois ?? 0,
      }
    }),
    events: instantane.evenements.map((evenement) => ({
      id: evenement.id,
      at: new Date(evenement.horodatage).toISOString(),
      kind: evenement.type,
      message: evenement.message,
      agent_id: evenement.agentId,
    })),
  }
}

export function apiSimulee(): Plugin {
  let dernier: Instantane | null = null
  let desabonner: (() => void) | null = null

  return {
    name: 'race-pulse-api-simulee',
    apply: 'serve',

    configureServer(serveur) {
      // Un seul simulateur pour le serveur, abonné une fois pour toutes : le
      // dernier instantané reçu est servi tel quel à chaque requête. Les
      // sondages successifs voient donc la même donnée jusqu'au tick suivant,
      // exactement comme face à un vrai backend.
      const simulateur = new SimulateurCourse()
      desabonner = simulateur.souscrire((instantane) => {
        dernier = instantane
      })

      const gerer: Connect.NextHandleFunction = (requete, reponse, suivant) => {
        if (requete.url?.startsWith(CHEMIN_API_EQUIPES)) {
          reponse.setHeader('Content-Type', 'application/json')
          reponse.setHeader('Cache-Control', 'no-store')
          reponse.setHeader('Access-Control-Allow-Origin', '*')
          reponse.end(JSON.stringify(chargeUtileEquipes(requete.url.includes('plat=1'))))
          return
        }
        if (!requete.url?.startsWith(CHEMIN_API_SIMULEE)) return suivant()

        if (!dernier) {
          reponse.statusCode = 503
          reponse.setHeader('Content-Type', 'application/json')
          reponse.end(JSON.stringify({ error: 'Simulateur pas encore prêt' }))
          return
        }

        reponse.setHeader('Content-Type', 'application/json')
        // Le frontend sonde toutes les dix secondes : rien ne doit être mis
        // en cache, sans quoi les karts se figeraient.
        reponse.setHeader('Cache-Control', 'no-store')
        reponse.setHeader('Access-Control-Allow-Origin', '*')
        reponse.end(JSON.stringify(versChargeUtile(dernier)))
      }

      serveur.middlewares.use(gerer)

      serveur.httpServer?.once('listening', () => {
        serveur.config.logger.info(
          `  ➜  API simulée :  ${CHEMIN_API_SIMULEE}  ` +
            `(VITE_RACE_PULSE_API_URL pour l'utiliser)`,
        )
      })
    },

    closeBundle() {
      desabonner?.()
      desabonner = null
    },
  }
}
