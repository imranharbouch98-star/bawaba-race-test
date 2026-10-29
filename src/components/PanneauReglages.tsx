/**
 * Panneau de réglages — outil de mise au point (jamais sur l'écran mural).
 *
 * Mesures WebGL, effectif simulé, mode d'étiquettes, et la maîtrise de
 * l'échelle de qualité : couper la sentinelle ou remettre la qualité au
 * maximum. Plus de bascule 2D — l'échelle descend en « 3D minimale » sur
 * les postes faibles (décision produit 24/08).
 */

import type { MesurePerformance3D } from '../perf/metriques3d'
import { MODES_ETIQUETTES, type ModeEtiquettes } from '../scene/modeEtiquettes'
import { type NiveauQualite } from '../perf/SentinellePerformance'
import { useTextes } from '../i18n/LangueContexte'
import type { Textes } from '../i18n/textes'

const EFFECTIFS_TEST = [10, 20, 30] as const

function niveauFluidite(fps: number, textes: Textes): { libelle: string; classe: string } {
  if (fps <= 0) return { libelle: textes.fluidite.mesure, classe: 'correct' }
  if (fps >= 55) return { libelle: textes.fluidite.fluide, classe: 'fluide' }
  if (fps >= 40) return { libelle: textes.fluidite.correct, classe: 'correct' }
  if (fps >= 30) return { libelle: textes.fluidite.tension, classe: 'tension' }
  return { libelle: textes.fluidite.critique, classe: 'critique' }
}

interface ProprietesPanneauReglages {
  nombreAgents: number
  onChangerNombreAgents: (nombre: number) => void
  mesure: MesurePerformance3D
  sentinelleActive: boolean
  onChangerSentinelle: (active: boolean) => void
  modeEtiquettes: ModeEtiquettes
  onChangerModeEtiquettes: (mode: ModeEtiquettes) => void
  niveauQualite: NiveauQualite
  onReinitialiserQualite: () => void
}

export function PanneauReglages({
  nombreAgents,
  onChangerNombreAgents,
  mesure,
  sentinelleActive,
  onChangerSentinelle,
  modeEtiquettes,
  onChangerModeEtiquettes,
  niveauQualite,
  onReinitialiserQualite,
}: ProprietesPanneauReglages) {
  const textes = useTextes()
  const fluidite = niveauFluidite(mesure.fps, textes)

  return (
    <section className="carte reglages" aria-label={textes.ariaReglages}>
      <div className="carte__entete">
        <h2 className="carte__titre">{textes.reglagesTitre}</h2>
        <span className={`reglages__etat reglages__etat--${fluidite.classe}`}>
          {fluidite.libelle}
        </span>
      </div>

      <div className="reglages__section">
        <span className="reglages__libelle">{textes.nomsDesKarts}</span>
        <div className="reglages__effectifs" role="group" aria-label={textes.ariaNomsDesKarts}>
          {MODES_ETIQUETTES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`bouton bouton--charge${modeEtiquettes === mode ? ' est-actif' : ''}`}
              aria-pressed={modeEtiquettes === mode}
              onClick={() => onChangerModeEtiquettes(mode)}
            >
              {textes.modesEtiquettes[mode]}
            </button>
          ))}
        </div>
        <p className="reglages__aide">{textes.aideSurvol}</p>
      </div>

      <div className="reglages__section">
        <span className="reglages__libelle">{textes.effectifSimule}</span>
        <div className="reglages__effectifs" role="group" aria-label={textes.ariaEffectifSimule}>
          {EFFECTIFS_TEST.map((effectif) => (
            <button
              key={effectif}
              type="button"
              className={`bouton bouton--charge${nombreAgents === effectif ? ' est-actif' : ''}`}
              aria-pressed={nombreAgents === effectif}
              onClick={() => onChangerNombreAgents(effectif)}
            >
              {textes.nbAgents(effectif)}
            </button>
          ))}
        </div>
      </div>

      <dl className="reglages__mesures" aria-label={textes.ariaMesures}>
        <div>
          <dt>FPS</dt>
          <dd>{mesure.fps > 0 ? mesure.fps.toFixed(0) : '—'}</dd>
        </div>
        <div>
          <dt>{textes.mesureImageMoyenne}</dt>
          <dd>{mesure.tempsImageMs > 0 ? `${mesure.tempsImageMs.toFixed(1)} ms` : '—'}</dd>
        </div>
        <div>
          <dt>{textes.mesurePireImage}</dt>
          <dd>{mesure.pireImageMs > 0 ? `${mesure.pireImageMs.toFixed(1)} ms` : '—'}</dd>
        </div>
        <div>
          <dt>Draw calls</dt>
          <dd>{mesure.appelsRendu.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>{textes.mesureTriangles}</dt>
          <dd>{mesure.triangles.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>{textes.mesureTextures}</dt>
          <dd>{mesure.textures}</dd>
        </div>
        {/* Le nombre de pixels calculés varie comme le carré de cette
            valeur : c'est le premier chiffre à vérifier quand un poste rame
            sans raison apparente. */}
        <div>
          <dt>{textes.mesureResolution}</dt>
          <dd>×{mesure.dpr.toFixed(2)}</dd>
        </div>
      </dl>

      <p className="reglages__gpu" title={mesure.gpu}>
        <span>GPU WebGL</span>
        <strong>{mesure.gpu}</strong>
      </p>

      <div className="reglages__qualite">
        <div>
          <span className="reglages__libelle">
            {textes.qualite(textes.libellesQualite[niveauQualite])}
          </span>
          <p className="reglages__aide">{textes.aideIndicateurs}</p>
        </div>
        <div className="reglages__actions">
          <button
            type="button"
            className={`bouton bouton--bascule${sentinelleActive ? ' est-actif' : ''}`}
            aria-pressed={sentinelleActive}
            onClick={() => onChangerSentinelle(!sentinelleActive)}
          >
            {textes.degradationAuto(sentinelleActive)}
          </button>
          <button type="button" className="bouton" onClick={onReinitialiserQualite}>
            {textes.reinitialiserQualite}
          </button>
        </div>
      </div>
    </section>
  )
}
