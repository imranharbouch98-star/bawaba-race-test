import { CIRCUIT } from '../domain/circuit3d'
import type { Pilote } from '../hooks/usePiloteInvite'
import { useTextes } from '../i18n/LangueContexte'

interface ProprietesCommandes {
  pilote: Pilote
}

export function PanneauCommandes({ pilote }: ProprietesCommandes) {
  const textes = useTextes()

  return (
    <section className="carte commandes" aria-label={textes.ariaCommandes}>
      <div className="carte__entete">
        <h2 className="carte__titre">{textes.commandesTitre}</h2>
        <button
          type="button"
          className={`bouton bouton--bascule${pilote.actif ? ' est-actif' : ''}`}
          onClick={pilote.basculer}
          aria-pressed={pilote.actif}
        >
          {pilote.actif ? textes.retirerKartInvite : textes.mettreKartInvite}
        </button>
      </div>

      <p className="commandes__regle">
        <span aria-hidden="true">🔒</span> {textes.regleCommandes}
      </p>

      <div className="commandes__grille" aria-disabled={!pilote.actif}>
        <button
          type="button"
          className="bouton bouton--commande"
          onClick={pilote.versInterieur}
          disabled={!pilote.actif || pilote.voie === 0}
        >
          <span aria-hidden="true">◀</span>
          <span>{textes.voieInterieure}</span>
        </button>

        <button
          type="button"
          className={`bouton bouton--boost${pilote.boostActif ? ' est-actif' : ''}`}
          onClick={pilote.declencherBoost}
          disabled={!pilote.actif}
        >
          <span aria-hidden="true">⚡</span>
          <span>{textes.boost}</span>
        </button>

        <button
          type="button"
          className="bouton bouton--commande"
          onClick={pilote.versExterieur}
          disabled={!pilote.actif || pilote.voie === CIRCUIT.nombreVoies - 1}
        >
          <span aria-hidden="true">▶</span>
          <span>{textes.voieExterieure}</span>
        </button>
      </div>

      <p className="commandes__aide">
        {textes.aideClavierAvant} <kbd>←</kbd> <kbd>→</kbd> {textes.aideClavierEntre}{' '}
        <kbd>{textes.toucheEspace}</kbd> {textes.aideClavierApres} {textes.voieActuelle}{' '}
        <strong>{textes.nomsVoie[pilote.voie]}</strong>.
      </p>
    </section>
  )
}
