#!/usr/bin/env node
/**
 * Garage de la boutique (« Winkel ») — diorama de confiserie fourni par
 * l'équipe le 30/10 (modèle IA, ~1,8 million de triangles, texture 4096).
 * C'est le décor de la vitrine où l'agent voit ses véhicules.
 *
 *   node scripts/preparer-garage.mjs [source.glb]
 *     → assets-source/garage/candy-garage.glb : simplifié (~55 000
 *       triangles), mis à l'échelle (×ECHELLE, en mètres), sol à y = 0,
 *       centré sur le plancher libre du milieu (la place du véhicule).
 *   npm run assets:optimiser -- garage/
 *     → public/modeles/garage/candy-garage.glb (texture 2048, Meshopt).
 *
 * Mesures relevées sur la source (vue de dessus) : plancher à y ≈ 0,015 ;
 * étagères à bocaux au fond et sur les côtés (|x| > 0,33, jusqu'à 0,6 de
 * haut) ; comptoir bas devant (z > 0,36, 0,17 de haut) — la caméra de la
 * vitrine regarde par-dessus.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)))
const SOURCE = join(RACINE, 'assets-source', 'garage', 'garage-source.glb')
const SORTIE = join(RACINE, 'assets-source', 'garage', 'candy-garage.glb')

/** Mètres par unité : le plancher libre (~0,6 × 0,7) devient ~4,2 × 4,8 m. */
const ECHELLE = 7
/** Hauteur du plancher et centre du plancher libre, dans la source. */
const SOL = 0.015
const CENTRE = [0, 0.015]
/** Part des triangles gardés : décor vu à distance, la texture fait le détail. */
const RATIO = 0.03

const entree = process.argv[2] ?? SOURCE
if (!existsSync(entree)) {
  console.error(`Source introuvable : ${entree}`)
  process.exit(1)
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready])
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const document = await io.read(entree)
await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.002 }), prune())

const scene = document.getRoot().listScenes()[0]
const pivot = document
  .createNode('Garage')
  .setScale([ECHELLE, ECHELLE, ECHELLE])
  .setTranslation([-CENTRE[0] * ECHELLE, -SOL * ECHELLE, -CENTRE[1] * ECHELLE])
for (const enfant of scene.listChildren()) {
  scene.removeChild(enfant)
  pivot.addChild(enfant)
}
scene.addChild(pivot)

let triangles = 0
for (const maillage of document.getRoot().listMeshes()) {
  for (const primitive of maillage.listPrimitives()) triangles += primitive.getIndices().getCount() / 3
}
mkdirSync(dirname(SORTIE), { recursive: true })
await io.write(SORTIE, document)
console.log(`${triangles} triangles, ×${ECHELLE} → ${SORTIE}\nÉtape suivante : npm run assets:optimiser -- garage/`)
