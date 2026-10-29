/**
 * Détection WebGL2 — condition d'entrée de la scène 3D.
 *
 * Appelée une seule fois avant de monter `<Canvas>` : sans WebGL2, on ne
 * tente même pas la 3D — voir §5 du plan (palier 0 de repli).
 */
export function webgl2Disponible(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') !== null
  } catch {
    return false
  }
}
