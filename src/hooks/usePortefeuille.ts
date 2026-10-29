/**
 * Portefeuilles des agents côté écran : crédite les pièces à chaque fin de
 * journée détectée, et porte la connexion « par le nom » de la boutique.
 *
 * Les règles (montants, plafond, refus d'achat) vivent dans
 * `domain/portefeuille.ts` ; le stockage dans `data/stockagePortefeuille.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { avancementEnTours } from '../domain/classement'
import {
  acheter as acheterVehicule,
  choisirVehicule,
  crediterJournee,
  journeeTerminee,
  kmParcourus,
  piecesPourJournee,
  type EtatPortefeuilles,
  type RefusAchat,
} from '../domain/portefeuille'
import type { Agent, Instantane } from '../domain/types'
import {
  ecrireAgentConnecte,
  lireAgentConnecte,
  stockageParDefaut,
  type StockagePortefeuille,
} from '../data/stockagePortefeuille'

interface PhotoJournee {
  miseAJour: number
  /** Début de la journée en cours — sert de clé unique de journée. */
  debut: number
  avancements: Map<string, number>
}

/** Date calendaire LOCALE (la bascule de l'API se fait à minuit, heure du centre). */
function dateLocale(horodatage: number): string {
  const d = new Date(horodatage)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Comparaison de noms tolérante : casse, accents et espaces ne comptent pas. */
export function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('nl')
    .replace(/\s+/g, ' ')
    .trim()
}

function avancementsDuJour(instantane: Instantane): Map<string, number> {
  const objectif = instantane.objectifs.jour
  return new Map(
    instantane.performances.map((p) => [p.agentId, avancementEnTours(p.scores.jour, objectif)]),
  )
}

export interface Portefeuille {
  etat: EtatPortefeuilles
  agent: Agent | null
  /** Distance et pièces de la journée EN COURS pour l'agent connecté. */
  aujourdhui: { km: number; pieces: number } | null
  connecter: (nom: string) => boolean
  deconnecter: () => void
  acheter: (vehiculeId: string) => RefusAchat | null
  choisir: (vehiculeId: string) => void
}

export function usePortefeuille(
  instantane: Instantane | null,
  stockage: StockagePortefeuille = stockageParDefaut,
): Portefeuille {
  const [etat, setEtat] = useState<EtatPortefeuilles>(() => stockage.lire())
  const [agentId, setAgentId] = useState<string | null>(lireAgentConnecte)
  const photo = useRef<PhotoJournee | null>(null)

  const modifier = useCallback(
    (transformer: (actuel: EtatPortefeuilles) => EtatPortefeuilles) => {
      setEtat((actuel) => {
        const suivant = transformer(actuel)
        if (suivant !== actuel) stockage.ecrire(suivant)
        return suivant
      })
    },
    [stockage],
  )

  // Un autre onglet (l'écran mural) a crédité ou un agent a acheté : on relit.
  useEffect(() => {
    const relire = (evenement: StorageEvent) => {
      if (evenement.key === null || evenement.key.startsWith('race-pulse:portefeuilles')) {
        setEtat(stockage.lire())
      }
    }
    window.addEventListener('storage', relire)
    return () => window.removeEventListener('storage', relire)
  }, [stockage])

  // Fin de journée : on crédite la journée qui vient de se terminer, d'après
  // la DERNIÈRE photo prise avant la bascule (les scores sont déjà remis à
  // zéro dans l'instantané qui la révèle).
  useEffect(() => {
    if (!instantane) return
    const avancements = avancementsDuJour(instantane)
    const avant = photo.current
    const nouvelle = avant !== null && journeeTerminee(avant, { miseAJour: instantane.miseAJour, avancements }, dateLocale)

    if (avant && nouvelle) {
      const journee = `${dateLocale(avant.debut)}@${avant.debut}`
      modifier((actuel) => crediterJournee(actuel, avant.avancements, journee, instantane.miseAJour))
    }

    photo.current = {
      miseAJour: instantane.miseAJour,
      debut: avant && !nouvelle ? avant.debut : instantane.miseAJour,
      avancements,
    }
  }, [instantane, modifier])

  const agent = useMemo(
    () => instantane?.agents.find((a) => a.id === agentId) ?? null,
    [instantane, agentId],
  )

  const aujourdhui = useMemo(() => {
    if (!agent || !instantane) return null
    const avancement = avancementsDuJour(instantane).get(agent.id) ?? 0
    return { km: Math.round(kmParcourus(avancement) * 10) / 10, pieces: piecesPourJournee(avancement) }
  }, [agent, instantane])

  const connecter = useCallback(
    (nom: string) => {
      const cherche = normaliserNom(nom)
      const trouve = cherche ? instantane?.agents.find((a) => normaliserNom(a.nom) === cherche) : undefined
      if (!trouve) return false
      setAgentId(trouve.id)
      ecrireAgentConnecte(trouve.id)
      return true
    },
    [instantane],
  )

  const deconnecter = useCallback(() => {
    setAgentId(null)
    ecrireAgentConnecte(null)
  }, [])

  const acheter = useCallback(
    (vehiculeId: string): RefusAchat | null => {
      if (!agent) return 'inconnu'
      // Calcul synchrone sur l'état courant pour pouvoir renvoyer le refus.
      const resultat = acheterVehicule(etat, agent.id, vehiculeId, Date.now())
      if (resultat.refus) return resultat.refus
      modifier(() => resultat.etat)
      return null
    },
    [agent, etat, modifier],
  )

  const choisir = useCallback(
    (vehiculeId: string) => {
      if (agent) modifier((actuel) => choisirVehicule(actuel, agent.id, vehiculeId))
    },
    [agent, modifier],
  )

  return { etat, agent, aujourdhui, connecter, deconnecter, acheter, choisir }
}
