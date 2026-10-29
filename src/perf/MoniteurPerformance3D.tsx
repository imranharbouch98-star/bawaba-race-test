/**
 * Télémétrie légère de la scène 3D. Les mesures sont agrégées sur une seconde
 * afin de ne provoquer qu'un seul rendu React par seconde, même si la scène
 * tourne à 60 images/s.
 */

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { MesurePerformance3D } from './metriques3d'

interface ProprietesMoniteurPerformance3D {
  onMesure: (mesure: MesurePerformance3D) => void
}

interface ExtensionInfosGpu {
  UNMASKED_RENDERER_WEBGL: number
}

export function MoniteurPerformance3D({ onMesure }: ProprietesMoniteurPerformance3D) {
  const gl = useThree((etat) => etat.gl)
  const gpuRef = useRef('Detecting…')
  const fenetreRef = useRef({
    duree: 0,
    images: 0,
    pireImage: 0,
    appelsRendu: 0,
    triangles: 0,
  })

  useEffect(() => {
    const contexte = gl.getContext()
    const extension = contexte.getExtension(
      'WEBGL_debug_renderer_info',
    ) as ExtensionInfosGpu | null
    const parametre = extension?.UNMASKED_RENDERER_WEBGL ?? contexte.RENDERER
    gpuRef.current = String(contexte.getParameter(parametre) ?? 'GPU not reported')
  }, [gl])

  // `renderer.info` se remet à zéro au DÉBUT de chaque `render()`. Or le
  // post-traitement en enchaîne une vingtaine par image (une par passe du
  // composer) : lu tel quel, le compteur ne portait que la dernière passe
  // plein écran, soit un ou deux appels au lieu de plusieurs centaines. Le
  // panneau mentait donc précisément dans la configuration la plus chargée.
  //
  // En coupant `autoReset`, les compteurs cumulent toutes les passes d'une
  // image (scène + ombres + post-traitement) ; c'est nous qui les remettons
  // à zéro, une fois par image.
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  // Priorité laissée à 0 volontairement. R3F fait
  // `internal.priority += (priority > 0 ? 1 : 0)` et coupe son rendu
  // automatique dès que ce compteur est positif : s'abonner en priorité 2
  // pour lire « après le composer » produirait un écran noir dès que la
  // sentinelle désactive le post-traitement (plus de composer pour rendre,
  // et R3F qui ne rend plus non plus).
  //
  // À priorité 0 on passe avant le composer (priorité 1), donc les
  // compteurs portent encore le total de l'image PRÉCÉDENTE : on les lit,
  // puis on les remet à zéro pour l'image qui commence. Une image de
  // décalage, sans importance sur une agrégation d'une seconde, et le
  // comportement est le même avec ou sans composer.
  useFrame(({ gl: moteur }, delta) => {
    const fenetre = fenetreRef.current

    fenetre.appelsRendu = moteur.info.render.calls
    fenetre.triangles = moteur.info.render.triangles
    moteur.info.reset()

    const deltaBorne = Math.min(0.25, Math.max(0, delta))
    fenetre.duree += deltaBorne
    fenetre.images += 1
    fenetre.pireImage = Math.max(fenetre.pireImage, deltaBorne)

    if (fenetre.duree < 1) return

    onMesure({
      fps: fenetre.images / fenetre.duree,
      tempsImageMs: (fenetre.duree / fenetre.images) * 1000,
      pireImageMs: fenetre.pireImage * 1000,
      appelsRendu: fenetre.appelsRendu,
      triangles: fenetre.triangles,
      geometries: moteur.info.memory.geometries,
      textures: moteur.info.memory.textures,
      dpr: moteur.getPixelRatio(),
      gpu: gpuRef.current,
    })

    fenetre.duree = 0
    fenetre.images = 0
    fenetre.pireImage = 0
  })

  return null
}
