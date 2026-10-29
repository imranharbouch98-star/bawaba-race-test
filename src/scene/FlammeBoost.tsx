/**
 * Flamme de boost — un seul quad billboard (toujours face caméra, via
 * `<Billboard>` de drei), texture procédurale en shader (pas de flipbook
 * PNG à sourcer/licencier) : bruit de valeur 2D animé, dégradé de couleur
 * cœur blanc-jaune → orange → rouge, fondu additif.
 *
 * Coût GPU : un draw call, une passe de fragment shader sur un quad de
 * petite taille écran — pas de géométrie ni de texture supplémentaire.
 * Désactivée au même palier que le post-traitement (voir `App.tsx`,
 * `NIVEAUX_QUALITE.sansPostTraitement`) : le fondu additif sollicite le
 * fill-rate, le premier poste à souffrir sur un GPU intégré.
 *
 * Ancrée à la sortie du pot d'échappement modélisé dans Blender (voir
 * `assets-source/vehicules/kart-race-pulse.blend`, objets `Echappement` /
 * `EchappementSortie`, côté droit près du moteur) plutôt qu'à un point
 * générique à l'arrière du châssis.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import { AdditiveBlending, ShaderMaterial, type Group } from 'three'

/** Position locale de la sortie d'échappement (repère du kart, +X = avant). */
const POSITION_ECHAPPEMENT: [number, number, number] = [-1.08, 0.25, 0.38]

const LARGEUR_FLAMME = 0.55
const HAUTEUR_FLAMME = 0.9

const TAU_ENVELOPPE = 0.12

/**
 * En dessous de ce seuil d'enveloppe, la flamme est retirée de la liste de
 * rendu plutôt que dessinée à opacité quasi nulle — voir `useFrame`.
 */
const SEUIL_VISIBLE = 0.004

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform float uTemps;
  uniform float uOpacite;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float bruit(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    // uv.y = 0 à la base (sortie du pot), 1 à la pointe de la flamme.
    float hauteur = vUv.y;
    float lateral = abs(vUv.x - 0.5) * 2.0;

    vec2 flux = vec2(vUv.x * 3.0, hauteur * 4.0 - uTemps * 4.5);
    float flicker = bruit(flux) * 0.65 + bruit(flux * 2.1 + 17.0) * 0.35;

    // Silhouette : se resserre vers la pointe, bord perturbé par le bruit.
    float largeur = mix(0.85, 0.1, hauteur) + (flicker - 0.5) * 0.3;
    float masque = smoothstep(largeur, largeur - 0.18, lateral);
    masque *= smoothstep(1.0, 0.5, hauteur);

    float intensite = masque * (0.55 + 0.45 * flicker);
    if (intensite <= 0.01) discard;

    vec3 pointe = vec3(0.85, 0.12, 0.04);
    vec3 milieu = vec3(1.0, 0.5, 0.1);
    vec3 coeur = vec3(1.0, 0.92, 0.65);

    vec3 couleur = mix(pointe, milieu, smoothstep(0.0, 0.55, 1.0 - hauteur));
    couleur = mix(couleur, coeur, smoothstep(0.35, 0.0, hauteur) * (1.0 - lateral) * 0.85);

    gl_FragColor = vec4(couleur * intensite * 1.4, intensite * uOpacite);
  }
`

interface ProprietesFlammeBoost {
  actif: boolean
  /** Point d'échappement (repère du véhicule) — par défaut celui du kart. */
  position?: [number, number, number]
}

export function FlammeBoost({ actif, position = POSITION_ECHAPPEMENT }: ProprietesFlammeBoost) {
  const materiau = useRef<ShaderMaterial>(null)
  const ancrage = useRef<Group>(null)
  const enveloppe = useRef(0)

  const uniforms = useMemo(() => ({ uTemps: { value: 0 }, uOpacite: { value: 0 } }), [])

  useFrame((etat, dt) => {
    const cible = actif ? 1 : 0
    enveloppe.current += (cible - enveloppe.current) * Math.min(1, dt / TAU_ENVELOPPE)

    // Couper la VISIBILITÉ, pas seulement l'alpha. À opacité nulle le quad
    // restait rasterisé et son fragment shader (deux octaves de bruit de
    // valeur, soit huit `hash()` par fragment) s'exécutait intégralement
    // avant que le `discard` ne s'applique. Avec un kart par agent et
    // seulement zéro à trois boosts simultanés, on payait ~27 quads en
    // fondu additif pour rien — précisément le poste de fill-rate que
    // l'en-tête de ce fichier identifie comme critique sur GPU intégré.
    const visible = enveloppe.current > SEUIL_VISIBLE
    if (ancrage.current) ancrage.current.visible = visible
    if (!visible) return

    if (materiau.current) {
      materiau.current.uniforms.uTemps.value = etat.clock.elapsedTime
      materiau.current.uniforms.uOpacite.value = enveloppe.current
    }
  })

  return (
    // Ancré à la surface même du pot d'échappement : sans dépendance à
    // l'angle de caméra, la géométrie du kart (aileron, pare-chocs,
    // roue) occulterait la sprite au moindre test de profondeur — d'où
    // `depthTest={false}`, pratique standard pour un petit effet
    // décoratif de ce genre (particules, lueurs).
    <Billboard ref={ancrage} position={position} visible={false}>
      <mesh position={[0, HAUTEUR_FLAMME / 2, 0]} renderOrder={10}>
        <planeGeometry args={[LARGEUR_FLAMME, HAUTEUR_FLAMME]} />
        <shaderMaterial
          ref={materiau}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          uniforms={uniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </Billboard>
  )
}
