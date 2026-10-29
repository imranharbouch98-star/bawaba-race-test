/**
 * Annonce du dernier tour — les dernières minutes avant la fermeture.
 *
 * Conçu pour la vision périphérique, pas pour la lecture : un agent au
 * téléphone ne fixe pas le mur, il l'aperçoit. C'est donc la bande de
 * couleur pulsée qui porte l'information, le texte ne fait que la préciser
 * pour qui lève vraiment les yeux.
 *
 * Muet, comme tout le reste : le son est exclu sur un plateau où les agents
 * sont en ligne avec des clients.
 */

import type { EtatJournee } from '../scene/cycleJour'
import { useTextes } from '../i18n/LangueContexte'

interface ProprietesBandeauDernierTour {
  journee: EtatJournee
}

export function BandeauDernierTour({ journee }: ProprietesBandeauDernierTour) {
  const textes = useTextes()
  if (journee.phase !== 'dernier-tour') return null

  const minutes = Math.max(0, journee.minutesRestantes)

  return (
    <div className="dernier-tour" role="status">
      <span className="dernier-tour__drapeau" aria-hidden="true" />
      <span className="dernier-tour__titre">{textes.dernierTour}</span>
      <span className="dernier-tour__reste">
        {minutes <= 1 ? textes.moinsUneMinute : textes.minutesRestantes(minutes)}
      </span>
    </div>
  )
}
