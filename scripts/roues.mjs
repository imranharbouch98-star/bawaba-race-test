/**
 * Roues mobiles des véhicules — partagé par `preparer-vehicules.mjs` (véhicules
 * de la boutique) et `optimiser-assets.mjs` (kart de départ).
 */

import { clearNodeTransform } from '@gltf-transform/functions'

/** Part du rayon mesuré découpée en roue mobile (le bord reste sur la caisse). */
const COUPE_ROUE = 0.97

// --- Roues ----------------------------------------------------------------------

/**
 * Sépare les roues du modèle pour qu'elles tournent (29/10). Les modèles IA
 * sont un SEUL maillage : les roues n'y sont pas des pièces, il faut les
 * découper. La détection entièrement automatique (cercles votés sur le
 * profil) s'est révélée trop fragile — passages de roue pris pour des pneus,
 * roues cachées par la caisse. Les axes et rayons sont donc MESURÉS sur une
 * vue de profil quadrillée (`roues` de VEHICULES, repère final : avant +X,
 * haut +Y, posé au sol) ; le script en déduit, par la géométrie :
 *  - le bas de chaque roue (le point le plus bas sous l'axe, de son côté —
 *    un essieu peut flotter de quelques centimètres) ;
 *  - sa bande latérale (Z), d'après les sommets au ras de ce bas, élargie
 *    vers l'extérieur (flasques, enjoliveurs) ;
 *  - les triangles DANS ce cylindre, qui deviennent un nœud `Roue_<n>` dont
 *    l'origine est l'axe ; `extras.rayon` donne le rayon au rendu
 *    (`Circuit3D` : rotation = distance parcourue ÷ rayon).
 */
export function extraireRoues(document, mesures) {
  const racine = document.getRoot()
  const scene = racine.listScenes()[0]
  // Tout ramener dans le repère de la scène : sommets « monde », nœuds à l'identité.
  const aplatir = (noeud) => {
    clearNodeTransform(noeud)
    for (const enfant of noeud.listChildren()) aplatir(enfant)
  }
  for (const noeud of scene.listChildren()) aplatir(noeud)

  const primitives = []
  for (const noeud of racine.listNodes()) {
    const maillage = noeud.getMesh()
    if (maillage) for (const primitive of maillage.listPrimitives()) primitives.push(primitive)
  }
  const sommets = []
  for (const primitive of primitives) {
    const positions = primitive.getAttribute('POSITION')
    for (let i = 0; i < positions.getCount(); i++) sommets.push(positions.getElement(i, []))
  }

  const roues = []
  for (const [x, rayon] of [mesures.arriere, mesures.avant]) {
    for (const cote of [1, -1]) {
      const sous = sommets.filter((v) => Math.sign(v[2]) === cote && Math.abs(v[0] - x) < rayon * 0.5)
      if (sous.length === 0) continue
      const bas = Math.min(...sous.map((v) => v[1]))
      const appuis = sous.filter((v) => v[1] < bas + rayon * 0.15)
      const zs = appuis.map((v) => Math.abs(v[2]))
      const interieur = Math.min(...zs)
      const exterieur = Math.max(...zs)
      const largeur = Math.max(0.04, exterieur - interieur)
      // |z| de la bande : un peu vers l'intérieur, franchement vers l'extérieur.
      const de = interieur - largeur * 0.2
      const a = exterieur + Math.max(0.08, largeur * 0.5)
      const [zMin, zMax] = cote > 0 ? [de, a] : [-a, -de]
      roues.push({ x, y: bas + rayon, z: (zMin + zMax) / 2, zMin, zMax, rayon })
    }
  }

  // Découpe : chaque triangle dont le centre tombe dans un cylindre de roue.
  const dans = (roue, c) =>
    c[2] >= roue.zMin && c[2] <= roue.zMax && Math.hypot(c[0] - roue.x, c[1] - roue.y) < roue.rayon * COUPE_ROUE
  for (const [n, roue] of roues.entries()) {
    const pivot = document.createNode(`Roue_${n}`).setTranslation([roue.x, roue.y, roue.z]).setExtras({ rayon: roue.rayon })
    const maillage = document.createMesh(`Roue_${n}`)
    for (const primitive of primitives) {
      const indices = primitive.getIndices()
      const positions = primitive.getAttribute('POSITION')
      const gardes = []
      const prises = []
      for (let t = 0; t < indices.getCount(); t += 3) {
        const tri = [indices.getScalar(t), indices.getScalar(t + 1), indices.getScalar(t + 2)]
        const c = [0, 0, 0]
        for (const i of tri) positions.getElement(i, []).forEach((q, k) => (c[k] += q / 3))
        ;(dans(roue, c) ? prises : gardes).push(...tri)
      }
      if (prises.length === 0) continue
      // Nouvelle primitive : sommets utilisés, recopiés, positions relatives à l'axe.
      const correspondance = new Map()
      for (const i of prises) if (!correspondance.has(i)) correspondance.set(i, correspondance.size)
      const roueP = document.createPrimitive().setMaterial(primitive.getMaterial())
      for (const semantique of primitive.listSemantics()) {
        if (semantique === 'TANGENT') continue
        const source = primitive.getAttribute(semantique)
        const taille = source.getElementSize()
        const tableau = new (source.getArray().constructor)(correspondance.size * taille)
        for (const [ancien, nouveau] of correspondance) {
          const e = source.getElement(ancien, [])
          if (semantique === 'POSITION') {
            e[0] -= roue.x
            e[1] -= roue.y
            e[2] -= roue.z
          }
          tableau.set(e, nouveau * taille)
        }
        roueP.setAttribute(
          semantique,
          document
            .createAccessor()
            .setType(source.getType())
            .setArray(tableau)
            .setNormalized(source.getNormalized())
            .setBuffer(source.getBuffer()),
        )
      }
      roueP.setIndices(
        document
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Uint32Array(prises.map((i) => correspondance.get(i))))
          .setBuffer(indices.getBuffer()),
      )
      maillage.addPrimitive(roueP)
      indices.setArray(new Uint32Array(gardes))
    }
    // Pivot (axe) → enfant porteur du maillage : l'optimiseur peut retoucher
    // le nœud du maillage (quantification), le pivot reste sur l'axe.
    pivot.addChild(document.createNode(`Roue_${n}_maillage`).setMesh(maillage))
    scene.addChild(pivot)
  }
  return roues
}
