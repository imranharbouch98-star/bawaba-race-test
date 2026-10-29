import { useTextes } from '../i18n/LangueContexte'

interface ProprietesExplications {
  simulation: boolean
}

export function Explications({ simulation }: ProprietesExplications) {
  const textes = useTextes()

  return (
    <section className="carte explications" aria-label={textes.ariaExplications}>
      <h2 className="carte__titre">{textes.explicationsTitre}</h2>

      <dl className="explications__liste">
        <div className="explications__entree">
          <dt>{textes.expliquePositionTitre}</dt>
          <dd>{textes.expliquePosition}</dd>
        </div>

        <div className="explications__entree">
          <dt>{textes.expliqueReculTitre}</dt>
          <dd>{textes.expliqueRecul}</dd>
        </div>

        <div className="explications__entree">
          <dt>{textes.expliqueVoiesTitre}</dt>
          <dd>{textes.expliqueVoies}</dd>
        </div>

        <div className="explications__entree">
          <dt>
            {simulation ? textes.expliqueDonneesSimuleesTitre : textes.expliqueDonneesReellesTitre}
          </dt>
          <dd>{simulation ? textes.expliqueDonneesSimulees : textes.expliqueDonneesReelles}</dd>
        </div>

        <div className="explications__entree">
          <dt>{textes.expliqueBranchementTitre}</dt>
          <dd>
            {textes.expliqueBranchementAvant} <code>SourceDonnees</code>
            {textes.expliqueBranchementMilieu} <code>VITE_RACE_PULSE_API_URL</code>{' '}
            {textes.expliqueBranchementApres}
          </dd>
        </div>

        <div className="explications__entree">
          <dt>{textes.explique3DTitre}</dt>
          <dd>{textes.explique3D}</dd>
        </div>
      </dl>
    </section>
  )
}
