/**
 * Surveillance de la perte du contexte WebGL — quatrième cas de repli, en
 * complément de la détection WebGL2 (§5 du plan, palier 0) et de la
 * sentinelle de performance (palier 2).
 *
 * Sur un poste qui affiche la scène huit à dix heures d'affilée, le pilote
 * graphique peut redémarrer tout seul (fréquent sur les GPU intégrés Intel,
 * et déclenché aussi par une mise en veille de l'écran ou une mise à jour du
 * pilote). Le navigateur émet alors `webglcontextlost` et le canvas cesse
 * définitivement d'être dessiné.
 *
 * Ce cas échappait complètement aux paliers existants : WebGL2 était bien
 * disponible au démarrage, et la sentinelle continue de mesurer des `dt`
 * parfaitement normaux — la boucle d'animation tourne, seul le rendu ne
 * produit plus rien. Le kiosque restait donc sur une image noire, sans
 * qu'aucun mécanisme ne le détecte.
 */

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

interface ProprietesSurveillanceContexte {
  onPerte: () => void
}

export function SurveillanceContexte({ onPerte }: ProprietesSurveillanceContexte) {
  const gl = useThree((etat) => etat.gl)

  useEffect(() => {
    const canvas = gl.domElement

    // Volontairement SANS `preventDefault()`. C'est cet appel qui demande au
    // navigateur de restaurer le contexte (et de déclencher ensuite
    // `webglcontextrestored`) ; sans lui, la perte est définitive.
    //
    // On ne veut pas de la restauration ici : elle impose de reconstruire
    // toutes les ressources GPU (géométries, matériaux, shaders, cibles de
    // post-traitement), ce que ni three ni R3F ne garantissent de façon
    // fiable sur une scène de cette taille. Basculer sur l'écran de repli
    // est un comportement prévisible, là où une restauration partielle
    // donnerait un rendu corrompu, difficile à diagnostiquer à distance.
    const surPerte = () => onPerte()

    canvas.addEventListener('webglcontextlost', surPerte)
    return () => canvas.removeEventListener('webglcontextlost', surPerte)
  }, [gl, onPerte])

  return null
}
