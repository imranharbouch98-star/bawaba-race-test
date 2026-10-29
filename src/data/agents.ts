/**
 * Effectif fictif du centre d'appels.
 *
 * Ces données sont des exemples : aucune donnée personnelle réelle n'est
 * utilisée. Elles seront remplacées par l'annuaire renvoyé par l'API.
 *
 * ---
 * Copie conforme depuis race-pulse (2D) — src/data/agents.ts. Aucune ligne de
 * logique modifiée. En cas de correctif ici, le reporter dans les deux dépôts.
 */

import type { Agent, ScoresParPeriode } from '../domain/types'

export const AGENTS: Agent[] = [
  { id: 'a01', nom: 'Amine Belkacem', equipe: 'Pôle Ventes', couleur: '#ff6b57', initiales: 'AB' },
  { id: 'a02', nom: 'Sofia Renard', equipe: 'Pôle Support', couleur: '#22d3ee', initiales: 'SR' },
  { id: 'a03', nom: 'Lucas Marchand', equipe: 'Pôle Rétention', couleur: '#ffc93c', initiales: 'LM' },
  { id: 'a04', nom: 'Nadia Cherif', equipe: 'Pôle Ventes', couleur: '#a78bfa', initiales: 'NC' },
  { id: 'a05', nom: 'Yassine Ferrand', equipe: 'Pôle Assistance', couleur: '#7ee787', initiales: 'YF' },
  { id: 'a06', nom: 'Clara Vidal', equipe: 'Pôle Support', couleur: '#f472b6', initiales: 'CV' },
  { id: 'a07', nom: 'Malik Osei', equipe: 'Pôle Rétention', couleur: '#fb923c', initiales: 'MO' },
  { id: 'a08', nom: 'Inès Lambert', equipe: 'Pôle Assistance', couleur: '#60a5fa', initiales: 'IL' },
  { id: 'a09', nom: 'Hugo Perrin', equipe: 'Pôle Ventes', couleur: '#34d399', initiales: 'HP' },
  { id: 'a10', nom: 'Leïla Ben Amor', equipe: 'Pôle Support', couleur: '#e879f9', initiales: 'LB' },
  { id: 'a11', nom: 'Omar Benali', equipe: 'Pôle Rétention', couleur: '#f87171', initiales: 'OB' },
  { id: 'a12', nom: 'Camille Moreau', equipe: 'Pôle Assistance', couleur: '#38bdf8', initiales: 'CM' },
  { id: 'a13', nom: 'Rachid El Fassi', equipe: 'Pôle Ventes', couleur: '#facc15', initiales: 'RF' },
  { id: 'a14', nom: 'Emma Dubois', equipe: 'Pôle Support', couleur: '#c084fc', initiales: 'ED' },
  { id: 'a15', nom: 'Karim Nasser', equipe: 'Pôle Rétention', couleur: '#4ade80', initiales: 'KN' },
  { id: 'a16', nom: 'Chloé Martin', equipe: 'Pôle Assistance', couleur: '#fb7185', initiales: 'CM' },
  { id: 'a17', nom: 'Mehdi Bensaïd', equipe: 'Pôle Ventes', couleur: '#f97316', initiales: 'MB' },
  { id: 'a18', nom: 'Julie Rousseau', equipe: 'Pôle Support', couleur: '#818cf8', initiales: 'JR' },
  { id: 'a19', nom: 'Samira Haddad', equipe: 'Pôle Rétention', couleur: '#2dd4bf', initiales: 'SH' },
  { id: 'a20', nom: 'Thomas Leroy', equipe: 'Pôle Assistance', couleur: '#f9a8d4', initiales: 'TL' },
  { id: 'a21', nom: 'Salma El Idrissi', equipe: 'Pôle Ventes', couleur: '#a3e635', initiales: 'SE' },
  { id: 'a22', nom: 'Nathan Garcia', equipe: 'Pôle Support', couleur: '#67e8f9', initiales: 'NG' },
  { id: 'a23', nom: 'Aya Mansouri', equipe: 'Pôle Rétention', couleur: '#fde047', initiales: 'AM' },
  { id: 'a24', nom: 'Louis Fontaine', equipe: 'Pôle Assistance', couleur: '#d8b4fe', initiales: 'LF' },
  { id: 'a25', nom: 'Meryem Alaoui', equipe: 'Pôle Ventes', couleur: '#86efac', initiales: 'MA' },
  { id: 'a26', nom: 'Gabriel Petit', equipe: 'Pôle Support', couleur: '#fda4af', initiales: 'GP' },
  { id: 'a27', nom: 'Kenza Ait Ali', equipe: 'Pôle Rétention', couleur: '#fdba74', initiales: 'KA' },
  { id: 'a28', nom: 'Raphaël Simon', equipe: 'Pôle Assistance', couleur: '#93c5fd', initiales: 'RS' },
  { id: 'a29', nom: 'Imane Zahra', equipe: 'Pôle Ventes', couleur: '#5eead4', initiales: 'IZ' },
  { id: 'a30', nom: 'Jules Bernard', equipe: 'Pôle Support', couleur: '#f0abfc', initiales: 'JB' },
]

/**
 * Objectifs à atteindre pour franchir la ligne d'arrivée.
 * Un point = une interaction traitée, pondérée par la qualité.
 */
export const OBJECTIFS: ScoresParPeriode = {
  jour: 120,
  semaine: 620,
  mois: 2500,
}
