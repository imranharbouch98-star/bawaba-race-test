#!/usr/bin/env node
/**
 * Véhicules par niveau de la boutique — modèles générés par IA (Tripo),
 * livrés par le chef de projet (27/10). Chaque source brute fait ~1,9
 * million de triangles et 55 Mo, orientée et dimensionnée à sa façon :
 * inutilisable telle quelle (30 véhicules à l'écran = ~57 M de triangles).
 *
 *   node scripts/preparer-vehicules.mjs preparer
 *     → assets-source/vehicules/niveaux/<id>.glb : tourné (avant = +X, la
 *       convention du kart), mis à l'échelle, posé au sol, simplifié à
 *       ~10 000 triangles ; + src/scene/modelesVehicules.ts (dimensions).
 *   npm run assets:optimiser
 *     → public/modeles/vehicules/niveaux/<id>.glb (WebP 1024, Meshopt).
 *   node scripts/preparer-vehicules.mjs vignettes
 *     → public/modeles/vehicules/vignettes/<id>.webp : l'image de la
 *       boutique, rendue depuis le modèle FINAL.
 *
 * Sources : `assets-source/vehicules/bruts/` (non commité, ~400 Mo). Le
 * niveau 3 arrive en FBX : le convertir d'abord avec FBX2glTF (voir
 * `public/modeles/LICENCES.md`). Le niveau 6 (Hello Kitty, un personnage et
 * non un véhicule) devient le DERNIER level de la boutique — personnage
 * protégé (Sanrio) : licence à confirmer.
 */

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { extraireRoues } from './roues.mjs'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)))
const BRUTS = join(RACINE, 'assets-source', 'vehicules', 'bruts')
const PREPARES = join(RACINE, 'assets-source', 'vehicules', 'niveaux')
const FINAUX = join(RACINE, 'public', 'modeles', 'vehicules', 'niveaux')
const VIGNETTES = join(RACINE, 'public', 'modeles', 'vehicules', 'vignettes')
const SORTIE_DIMENSIONS = join(RACINE, 'src', 'scene', 'modelesVehicules.ts')

/**
 * Le catalogue des modèles. `avant` : côté de l'AVANT dans la source,
 * relevé à l'œil (phares et calandre face aux feux arrière et à la plaque —
 * voir les vues de face/arrière de la préparation). `longueur` en mètres :
 * le kart fait 2,1 m ; berlines 2,8 m, limousines 3,4 m — tous ~1,2 m de
 * large, ce qui tient dans une voie de 2,4–2,6 m. `roues` : axes et rayons
 * mesurés sur le profil quadrillé (voir `extraireRoues`) ; absent ou `false`
 * = roues fixes (pas de roues nettes : brouette, Hello Kitty, gaufre).
 */
const VEHICULES = [
  { id: 'kruiwagen', source: 'kruiwahen3d.glb', avant: '-X', longueur: 1.8, roues: false },
  { id: 'sedan-klassiek', source: 'level23D.glb', avant: '+Z', longueur: 2.8, roues: { arriere: [-0.74, 0.2], avant: [0.94, 0.2] } },
  { id: 'bolle-wagen', source: 'level33D.glb', avant: '+Z', longueur: 2.8, roues: { arriere: [-0.8, 0.2], avant: [0.85, 0.2] } },
  { id: 'limousine', source: 'level43D.glb', avant: '+Z', longueur: 3.4, roues: { arriere: [-1.04, 0.2], avant: [1.24, 0.2] } },
  { id: 'sedan-roze', source: 'level53D.glb', avant: '+Z', longueur: 2.8, roues: { arriere: [-0.74, 0.23], avant: [0.87, 0.23] } },
  { id: 'cabrio', source: 'level83D.glb', avant: '+Z', longueur: 2.8, roues: { arriere: [-0.67, 0.13], avant: [0.96, 0.17] } },
  { id: 'lowrider', source: 'level93D.glb', avant: '+Z', longueur: 2.8, roues: { arriere: [-0.67, 0.19], avant: [0.89, 0.21] } },
  { id: 'stretch-limo', source: 'level103D.glb', avant: '+X', longueur: 3.4, roues: { arriere: [-1.22, 0.15], avant: [1.39, 0.17] } },
  { id: 'hello-kitty', source: 'level63D.glb', avant: '+Z', longueur: 2.0, roues: false },
  // Véhicules « bonbons » (dossier « candy cars », 29/10) — les premiers levels.
  // Trapus (roues très écartées) : longueur réduite pour rester sous 1,9 m de
  // large, la largeur avec laquelle le tracé vérifie le décor.
  { id: 'appeltaart', source: 'appeltaart.glb', avant: '-X', longueur: 2.4, roues: { arriere: [-0.63, 0.365], avant: [0.76, 0.26] } },
  { id: 'dessert-taart', source: 'dessert-taart.glb', avant: '-X', longueur: 2.2, roues: { arriere: [-0.72, 0.27], avant: [0.8, 0.33] } },
  { id: 'dessert-auto', source: 'dessert-auto.glb', avant: '+Z', longueur: 2.8, roues: { arriere: [-1.02, 0.415], avant: [0.37, 0.3] } },
  { id: 'gevulde-chariot', source: 'gevulde-chariot.glb', avant: '+Z', longueur: 2.7, roues: { arriere: [-0.67, 0.33], avant: [0.72, 0.23] } },
  // Roues de la gaufre noyées dans la pile : pas de roues mobiles.
  { id: 'wafelauto', source: 'wafelauto.glb', avant: '-X', longueur: 2, roues: false },
]

/** Triangles visés par véhicule — le niveau 3 livré en « low poly » en a 9 700. */
const TRIANGLES_CIBLE = 10000


/** Rotation autour de Y amenant l'avant de la source sur +X. */
const ANGLE_AVANT = { '+X': 0, '-X': Math.PI, '+Z': Math.PI / 2, '-Z': -Math.PI / 2 }

const io = () =>
  new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const [, , commande, ...seuls] = process.argv
if (commande === 'preparer') await preparer()
else if (commande === 'vignettes') await vignettes()
else {
  console.error('Usage : node scripts/preparer-vehicules.mjs preparer | vignettes')
  process.exit(1)
}

// --- Préparation ---------------------------------------------------------------

async function preparer() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready])
  mkdirSync(PREPARES, { recursive: true })
  // `preparer <id>…` : seulement ces véhicules ; les dimensions des autres
  // sont reprises du fichier déjà généré.
  const dimensions = seuls.length ? lireDimensions() : {}

  for (const vehicule of VEHICULES.filter((v) => seuls.length === 0 || seuls.includes(v.id))) {
    const document = await io().read(join(BRUTS, vehicule.source))
    const racine = document.getRoot()
    for (const extension of racine.listExtensionsUsed()) {
      if (extension.extensionName === 'KHR_materials_volume') extension.dispose()
    }

    const avant = compterTriangles(racine)
    await document.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TRIANGLES_CIBLE / avant), error: 0.02 }),
      prune(),
    )
    const apres = compterTriangles(racine)

    // Rotation (avant → +X), puis échelle et position calculées sur la boîte
    // englobante TOURNÉE : centré en X/Z, posé au sol (y = 0).
    const angle = ANGLE_AVANT[vehicule.avant]
    const boite = boiteTournee(racine, angle)
    const echelle = vehicule.longueur / (boite.max[0] - boite.min[0])
    const scene = racine.listScenes()[0]
    const pivot = document
      .createNode(`Vehicule_${vehicule.id}`)
      .setRotation([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)])
      .setScale([echelle, echelle, echelle])
    // Translation appliquée APRÈS rotation et échelle (TRS de glTF).
    pivot.setTranslation([
      (-(boite.min[0] + boite.max[0]) / 2) * echelle,
      -boite.min[1] * echelle,
      (-(boite.min[2] + boite.max[2]) / 2) * echelle,
    ])
    for (const enfant of scene.listChildren()) {
      scene.removeChild(enfant)
      pivot.addChild(enfant)
    }
    scene.addChild(pivot)

    // Roues séparées (axe + rayon) pour qu'elles tournent sur la piste.
    const roues = vehicule.roues ? extraireRoues(document, vehicule.roues) : []
    console.log(`  ${vehicule.id} : ${roues.length ? roues.map((r) => `roue r=${r.rayon.toFixed(2)} m`).join(', ') : 'aucune roue détectée (roues fixes)'}`)

    await io().write(join(PREPARES, `${vehicule.id}.glb`), document)
    dimensions[vehicule.id] = {
      longueur: Number(vehicule.longueur.toFixed(2)),
      largeur: Number(((boite.max[2] - boite.min[2]) * echelle).toFixed(2)),
      hauteur: Number(((boite.max[1] - boite.min[1]) * echelle).toFixed(2)),
    }
    console.log(
      `${vehicule.id.padEnd(15)} ${String(avant).padStart(8)} → ${String(apres).padStart(6)} triangles, ` +
        `${dimensions[vehicule.id].longueur} × ${dimensions[vehicule.id].largeur} × ${dimensions[vehicule.id].hauteur} m`,
    )
  }

  const lignes = Object.entries(dimensions)
    .map(([id, d]) => `  '${id}': { longueur: ${d.longueur}, largeur: ${d.largeur}, hauteur: ${d.hauteur} },`)
    .join('\n')
  writeFileSync(
    SORTIE_DIMENSIONS,
    `/**
 * Dimensions des véhicules par niveau, en mètres (avant = +X, posés au sol)
 * — FICHIER GÉNÉRÉ par \`scripts/preparer-vehicules.mjs preparer\`, ne pas
 * éditer à la main. Modèles : \`public/modeles/vehicules/niveaux/<id>.glb\`.
 */

export interface DimensionsVehicule {
  longueur: number
  largeur: number
  hauteur: number
}

// prettier-ignore
export const DIMENSIONS_VEHICULES: Record<string, DimensionsVehicule> = {
${lignes}
}
`,
  )
  console.log(`→ ${PREPARES}\n→ ${SORTIE_DIMENSIONS}\nÉtape suivante : npm run assets:optimiser, puis « vignettes ».`)
}

/** Dimensions déjà générées (`modelesVehicules.ts`), par id. */
function lireDimensions() {
  if (!existsSync(SORTIE_DIMENSIONS)) return {}
  const dimensions = {}
  const motif = /'([^']+)': \{ longueur: ([\d.]+), largeur: ([\d.]+), hauteur: ([\d.]+) \}/g
  for (const [, id, longueur, largeur, hauteur] of readFileSync(SORTIE_DIMENSIONS, 'utf8').matchAll(motif)) {
    dimensions[id] = { longueur: Number(longueur), largeur: Number(largeur), hauteur: Number(hauteur) }
  }
  return dimensions
}

function compterTriangles(racine) {
  let total = 0
  for (const maillage of racine.listMeshes()) {
    for (const primitive of maillage.listPrimitives()) {
      total += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3
    }
  }
  return total
}

/** Boîte englobante des sommets (repère monde de la source) tournés de `angle` autour de Y. */
function boiteTournee(racine, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const noeud of racine.listNodes()) {
    const maillage = noeud.getMesh()
    if (!maillage) continue
    const m = noeud.getWorldMatrix()
    for (const primitive of maillage.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION')
      const v = []
      for (let k = 0; k < positions.getCount(); k++) {
        positions.getElement(k, v)
        const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]
        const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]
        const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
        // Rotation autour de Y (même sens que le quaternion du pivot).
        const p = [c * x + s * z, y, -s * x + c * z]
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], p[i])
          max[i] = Math.max(max[i], p[i])
        }
      }
    }
  }
  return { min, max }
}

// --- Vignettes de la boutique --------------------------------------------------

/**
 * Rendu 3/4 avant de chaque modèle FINAL : projection orthographique, tampon
 * de profondeur, éclairage lambertien, fond transparent. Pas de navigateur :
 * l'image vient du même fichier que celui affiché sur la piste.
 */
async function vignettes() {
  await MeshoptDecoder.ready
  mkdirSync(VIGNETTES, { recursive: true })
  const L = 360
  const H = 240
  // `vignettes <id>…` : ne refait que ces véhicules.
  for (const vehicule of VEHICULES.filter((v) => seuls.length === 0 || seuls.includes(v.id))) {
    const document = await io().read(join(FINAUX, `${vehicule.id}.glb`))
    const racine = document.getRoot()
    const sommets = []
    const triangles = []
    for (const noeud of racine.listNodes()) {
      const maillage = noeud.getMesh()
      if (!maillage) continue
      const m = noeud.getWorldMatrix()
      for (const primitive of maillage.listPrimitives()) {
        const image = primitive.getMaterial()?.getBaseColorTexture()?.getImage()
        const { data: texture, info } = image
          ? await sharp(Buffer.from(image)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
          : { data: null, info: null }
        const positions = primitive.getAttribute('POSITION')
        const uvs = primitive.getAttribute('TEXCOORD_0')
        const base = sommets.length
        const v = []
        for (let k = 0; k < positions.getCount(); k++) {
          positions.getElement(k, v)
          sommets.push({
            p: [
              m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
              m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
              m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
            ],
            uv: uvs ? uvs.getElement(k, []) : [0, 0],
            texture,
            info,
          })
        }
        const indices = primitive.getIndices()
        for (let t = 0; t < indices.getCount(); t += 3) {
          triangles.push([base + indices.getScalar(t), base + indices.getScalar(t + 1), base + indices.getScalar(t + 2)])
        }
      }
    }

    // Vue 3/4 AVANT : l'avant (+X) vers le spectateur (sin > 0) et vers la
    // gauche de l'image (cos < 0).
    const lacet = ((process.env.LACET ? Number(process.env.LACET) : 145) * Math.PI) / 180
    const tangage = (18 * Math.PI) / 180
    const [cl, sl, ct, st] = [Math.cos(lacet), Math.sin(lacet), Math.cos(tangage), Math.sin(tangage)]
    const projetes = sommets.map(({ p }) => {
      const x1 = p[0] * cl - p[2] * sl
      const z1 = p[0] * sl + p[2] * cl
      return [x1, p[1] * ct - z1 * st, p[1] * st + z1 * ct]
    })
    const cx = (Math.min(...projetes.map((p) => p[0])) + Math.max(...projetes.map((p) => p[0]))) / 2
    const cy = (Math.min(...projetes.map((p) => p[1])) + Math.max(...projetes.map((p) => p[1]))) / 2
    const etendue = Math.max(...projetes.map((p) => Math.max(Math.abs(p[0] - cx) / L, Math.abs(p[1] - cy) / H)))
    const echelle = 0.46 / etendue
    const profondeur = new Float32Array(L * H).fill(-Infinity)
    const rgba = new Uint8Array(L * H * 4)
    const lumiere = [0.45, 0.8, -0.4]
    const nl = Math.hypot(...lumiere)

    for (const [ia, ib, ic] of triangles) {
      const [a, b, c] = [projetes[ia], projetes[ib], projetes[ic]].map((p) => [
        L / 2 + (p[0] - cx) * echelle,
        H / 2 - (p[1] - cy) * echelle,
        p[2],
      ])
      const aire = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
      if (Math.abs(aire) < 1e-9) continue
      const [pa, pb, pc] = [sommets[ia].p, sommets[ib].p, sommets[ic].p]
      const e1 = pb.map((v, i) => v - pa[i])
      const e2 = pc.map((v, i) => v - pa[i])
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      const eclairage = 0.5 + 0.5 * Math.abs((n[0] * lumiere[0] + n[1] * lumiere[1] + n[2] * lumiere[2]) / ((Math.hypot(...n) || 1) * nl))
      const { texture, info } = sommets[ia]
      for (let y = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))); y <= Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1]))); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))); x <= Math.min(L - 1, Math.ceil(Math.max(a[0], b[0], c[0]))); x++) {
          const w0 = ((b[0] - x) * (c[1] - y) - (c[0] - x) * (b[1] - y)) / aire
          const w1 = ((c[0] - x) * (a[1] - y) - (a[0] - x) * (c[1] - y)) / aire
          const w2 = 1 - w0 - w1
          if (w0 < 0 || w1 < 0 || w2 < 0) continue
          const z = w0 * a[2] + w1 * b[2] + w2 * c[2]
          const i = y * L + x
          if (z <= profondeur[i]) continue
          profondeur[i] = z
          let couleur = [190, 190, 190]
          if (texture) {
            const u = w0 * sommets[ia].uv[0] + w1 * sommets[ib].uv[0] + w2 * sommets[ic].uv[0]
            const v = w0 * sommets[ia].uv[1] + w1 * sommets[ib].uv[1] + w2 * sommets[ic].uv[1]
            const tx = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width)))
            const ty = Math.min(info.height - 1, Math.max(0, Math.floor(v * info.height)))
            const q = (ty * info.width + tx) * 3
            couleur = [texture[q], texture[q + 1], texture[q + 2]]
          }
          rgba[i * 4] = Math.min(255, couleur[0] * eclairage)
          rgba[i * 4 + 1] = Math.min(255, couleur[1] * eclairage)
          rgba[i * 4 + 2] = Math.min(255, couleur[2] * eclairage)
          rgba[i * 4 + 3] = 255
        }
      }
    }
    const sortie = process.env.LACET ? join(process.env.SORTIE_VUES ?? VIGNETTES, `${vehicule.id}-${process.env.LACET}.png`) : join(VIGNETTES, `${vehicule.id}.webp`)
    const image = sharp(Buffer.from(rgba), { raw: { width: L, height: H, channels: 4 } })
    await (process.env.LACET ? image.png() : image.webp({ quality: 82 })).toFile(sortie)
    console.log(`→ ${sortie}`)
  }
}
