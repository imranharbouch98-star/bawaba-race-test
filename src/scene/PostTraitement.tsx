/**
 * Post-traitement — §4 et §8 du plan : deux passes légères seulement
 * (bloom + vignette), pas d'empilement SSAO/DOF/flou de mouvement, pour
 * tenir le budget GPU intégré.
 *
 * Le bloom ne « voit » que les pixels dont la luminance dépasse 1 : seuls
 * les karts en boost (matériau émissif poussé au-delà de 1, voir
 * `KartRacePulse`) déclenchent un halo — le reste de la scène est inerte.
 */

import { memo } from 'react'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

interface ProprietesPostTraitement {
  /** Coupé par la sentinelle de performance (premier palier de dégradation). */
  actif: boolean
  /** `prefers-reduced-motion` : vignette conservée, halo de boost coupé. */
  animationReduite: boolean
}

/**
 * `memo` NON décoratif — il corrige une fuite mémoire, pas un rendu superflu.
 *
 * Sans lui, chaque rendu de `App` (une fois par seconde, déclenché par
 * `MoniteurPerformance3D`) recrée les éléments React `<Bloom>` et
 * `<Vignette>`. L'`EffectComposer` de @react-three/postprocessing a un
 * `useLayoutEffect` dont `children` fait partie des dépendances : il détruit
 * alors son `EffectPass` et en reconstruit un. Or `removePass()` n'appelle
 * PAS `dispose()`, et le constructeur d'`EffectPass` s'abonne à l'événement
 * `"change"` des effets — qui, eux, sont durables. L'ancienne passe reste
 * donc référencée à vie, avec son `EffectMaterial`, son mesh plein écran, sa
 * scène et sa caméra.
 *
 * Sur une journée de kiosque (8 h) : ~28 800 passes retenues. S'y ajoute le
 * coût immédiat de la reconstruction — `initialize()` régénère la source du
 * fragment shader et invalide le cache de programme — soit un hoquet
 * périodique une fois par seconde.
 *
 * `actif` et `animationReduite` sont deux booléens : `memo` bloque donc
 * effectivement tous les rendus intermédiaires.
 */
export const PostTraitement = memo(function PostTraitement({
  actif,
  animationReduite,
}: ProprietesPostTraitement) {
  if (!actif) return null

  // Deux retours distincts plutôt qu'une condition dans les enfants :
  // l'EffectComposer fusionne ses enfants en une seule passe et un fragment
  // vide au milieu casse silencieusement le rendu (ciel noir constaté).
  // `multisampling={0}` : le MSAA du composer rendait la scène en ×4 échan-
  // tillons DANS une cible intermédiaire, en plus de l'anticrénelage natif du
  // canvas — le poste le plus cher du post pour un gain invisible sur un
  // écran mural. Les deux passes (bloom seuillé + vignette) restent.
  if (animationReduite) {
    return (
      <EffectComposer multisampling={0}>
        <Vignette offset={0.3} darkness={0.5} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={0}>
      {/* `levels={4}` plutôt que le défaut 8 : le flou mipmap fait un
          downsample puis un upsample par niveau, soit 16 changements de
          render target par frame contre 8 ici. Sur GPU intégré, un
          changement de cible coûte plus cher que le fill lui-même. Le halo
          perd un peu de sa traîne la plus large — invisible sur un effet
          qui ne se déclenche que sur les karts en boost. */}
      <Bloom
        luminanceThreshold={1}
        luminanceSmoothing={0.05}
        intensity={0.9}
        mipmapBlur
        levels={4}
      />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  )
})
