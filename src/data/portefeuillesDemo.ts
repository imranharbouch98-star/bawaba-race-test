/**
 * Historique de démonstration des portefeuilles — SIMULATION uniquement.
 *
 * Consigne du client : tout se montre sur le simulateur. Pour que la boutique
 * ressemble à son usage réel (demande du 27/10), chaque agent arrive avec un
 * passé : une ancienneté, un niveau de performance et une façon de dépenser
 * qui lui sont propres. On rejoue ce passé JOUR PAR JOUR avec les vraies
 * règles (`crediterJournee`, `acheter`, `choisirVehicule`) : soldes, levels et
 * garages respectent donc le plafond quotidien et l'ordre des levels, comme
 * si l'écran avait tourné depuis des mois.
 *
 * Déterministe (graine fixe par agent) : la démo est identique d'une
 * ouverture à l'autre, comme `SimulateurCourse`.
 */

import {
  acheter,
  choisirVehicule,
  crediterJournee,
  ETAT_VIDE,
  prochainVehicule,
  solde,
  vehiculesPossedes,
  type EtatPortefeuilles,
} from '../domain/portefeuille'
import type { Agent } from '../domain/types'

/** Façon de dépenser — ce qui rend deux agents au même score différents. */
type Style =
  /** Achète dès que le prochain level est payable. */
  | 'depensier'
  /** Garde une réserve avant d'acheter : gros solde, level plus bas. */
  | 'epargnant'
  /** Monte les levels mais roule souvent avec un véhicule plus ancien. */
  | 'nostalgique'

const STYLES: readonly Style[] = ['depensier', 'depensier', 'epargnant', 'nostalgique']

/** Ancienneté maximale, en jours ouvrés (~1 an). */
const ANCIENNETE_MAX = 260

/** Probabilité d'une journée d'absence (congé, maladie, formation). */
const ABSENCE = 0.08

const JOUR = 86_400_000

/** PRNG mulberry32 — même famille que `creerAleatoire` du simulateur. */
function aleatoire(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function graineDe(texte: string): number {
  let h = 2166136261
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h
}

function dateLocale(horodatage: number): string {
  const d = new Date(horodatage)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Jours ouvrés écoulés AVANT aujourd'hui, du plus ancien au plus récent (fin de journée 17h30). */
function joursOuvres(nombre: number, maintenant: number): number[] {
  const jours: number[] = []
  const curseur = new Date(maintenant)
  curseur.setHours(17, 30, 0, 0)
  while (jours.length < nombre) {
    curseur.setTime(curseur.getTime() - JOUR)
    const jour = curseur.getDay()
    if (jour !== 0 && jour !== 6) jours.push(curseur.getTime())
  }
  return jours.reverse()
}

export function creerPortefeuillesDemo(agents: readonly Agent[], maintenant: number): EtatPortefeuilles {
  const profils = agents.map((agent) => {
    const hasard = aleatoire(graineDe(`portefeuille:${agent.id}`))
    return {
      agent,
      hasard,
      // Beaucoup de nouveaux venus (quelques jours), quelques anciens (un an).
      anciennete: Math.round(3 + hasard() ** 2.2 * (ANCIENNETE_MAX - 3)),
      // Avancement moyen par jour, en tours (1 tour = 30 pièces, plafond 50).
      talent: 0.25 + hasard() * 1.1,
      style: STYLES[Math.floor(hasard() * STYLES.length)],
    }
  })

  const jours = joursOuvres(ANCIENNETE_MAX, maintenant)
  let etat = ETAT_VIDE

  jours.forEach((finJournee, index) => {
    const journee = `${dateLocale(finJournee)}@demo`
    const avancements = new Map<string, number>()
    for (const p of profils) {
      if (index < jours.length - p.anciennete) continue
      if (p.hasard() < ABSENCE) continue
      avancements.set(p.agent.id, p.talent * (0.5 + p.hasard()))
    }
    etat = crediterJournee(etat, avancements, journee, finJournee)

    // Les achats se font le lendemain matin, en ouvrant la boutique.
    const matin = finJournee + 15.5 * 3_600_000
    for (const p of profils) {
      const prochain = prochainVehicule(etat, p.agent.id)
      if (!prochain) continue
      const reserve = p.style === 'epargnant' ? prochain.prix * 0.6 : 0
      if (solde(etat, p.agent.id) < prochain.prix + reserve) continue
      // Un dépensier n'attend pas ; les autres hésitent quelques jours.
      if (p.style !== 'depensier' && p.hasard() < 0.5) continue
      etat = acheter(etat, p.agent.id, prochain.id, matin).etat
    }
  })

  // Le véhicule du jour : le dernier acheté, sauf pour les nostalgiques.
  for (const p of profils) {
    const possedes = vehiculesPossedes(etat, p.agent.id)
    const choix =
      p.style === 'nostalgique' && possedes.length > 2
        ? possedes[1 + Math.floor(p.hasard() * (possedes.length - 2))]
        : possedes[possedes.length - 1]
    etat = choisirVehicule(etat, p.agent.id, choix)
  }

  return etat
}
