/**
 * Stockage des portefeuilles — SIMULATION : le navigateur (`localStorage`).
 *
 * Consigne du client : tout se construit sur le simulateur, les vraies
 * données (pièces, achats) seront branchées plus tard sur BawabaDash. D'où
 * cette interface minimale : la future source serveur la remplacera sans
 * toucher aux écrans ni aux règles (`domain/portefeuille.ts`).
 *
 * Limite assumée de la simulation : chaque navigateur a SON portefeuille, et
 * les pièces ne sont créditées que par un écran ouvert au moment de la
 * bascule de journée.
 */

import { ETAT_VIDE, type EtatPortefeuilles } from '../domain/portefeuille'
import { AGENTS } from './agents'
import { creerPortefeuillesDemo } from './portefeuillesDemo'

export interface StockagePortefeuille {
  lire(): EtatPortefeuilles
  ecrire(etat: EtatPortefeuilles): void
}

const CLE = 'race-pulse:portefeuilles'

export const stockageLocal: StockagePortefeuille = {
  lire() {
    try {
      const brut = window.localStorage.getItem(CLE)
      if (!brut) return ETAT_VIDE
      const etat = JSON.parse(brut) as Partial<EtatPortefeuilles>
      // Garde-fou : un contenu abîmé ou d'un autre format repart à vide
      // plutôt que de casser l'application.
      if (!Array.isArray(etat.mouvements) || typeof etat.vehiculeChoisi !== 'object' || !etat.vehiculeChoisi) {
        return ETAT_VIDE
      }
      return { mouvements: etat.mouvements, vehiculeChoisi: etat.vehiculeChoisi }
    } catch {
      return ETAT_VIDE
    }
  },
  ecrire(etat) {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(etat))
    } catch {
      // Stockage indisponible (navigation privée) : l'état vit le temps de la session.
    }
  },
}

/**
 * Version de l'historique de démonstration. L'incrémenter remplace, une
 * fois, les portefeuilles de chaque navigateur par le nouvel historique.
 */
const VERSION_DEMO = '3'
const CLE_DEMO = 'race-pulse:portefeuilles-demo'

/**
 * Simulateur : au premier passage (ou à un changement de `VERSION_DEMO`),
 * les portefeuilles partent d'un historique réaliste — chaque agent avec son
 * solde, ses véhicules et son level (`portefeuillesDemo.ts`) — au lieu d'être
 * tous vides. Ensuite, tout se comporte normalement (gains, achats).
 */
export function avecHistoriqueDemo(stockage: StockagePortefeuille): StockagePortefeuille {
  return {
    lire() {
      try {
        if (window.localStorage.getItem(CLE_DEMO) !== VERSION_DEMO) {
          const etat = creerPortefeuillesDemo(AGENTS, Date.now())
          stockage.ecrire(etat)
          window.localStorage.setItem(CLE_DEMO, VERSION_DEMO)
          return etat
        }
      } catch {
        // Stockage indisponible : on retombe sur la lecture normale.
      }
      return stockage.lire()
    },
    ecrire: (etat) => stockage.ecrire(etat),
  }
}

/** Le stockage de l'écran : avec l'historique de démo tant qu'on tourne sur le simulateur. */
export const stockageParDefaut: StockagePortefeuille = import.meta.env?.VITE_RACE_PULSE_API_URL
  ? stockageLocal
  : avecHistoriqueDemo(stockageLocal)

/** Agent connecté sur ce poste (connexion par le nom seul, sans mot de passe). */
const CLE_AGENT = 'race-pulse:agent-connecte'

export function lireAgentConnecte(): string | null {
  try {
    return window.localStorage.getItem(CLE_AGENT)
  } catch {
    return null
  }
}

export function ecrireAgentConnecte(agentId: string | null): void {
  try {
    if (agentId) window.localStorage.setItem(CLE_AGENT, agentId)
    else window.localStorage.removeItem(CLE_AGENT)
  } catch {
    // Idem : la connexion vaut pour la session.
  }
}
