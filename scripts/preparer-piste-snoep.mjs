#!/usr/bin/env node
/**
 * Circuit « snoep » (bonbons) — modèle Sketchfab fourni par l'équipe (29/10),
 * seule piste de l'application depuis cette date.
 *
 *   node scripts/preparer-piste-snoep.mjs preparer [source.glb]
 *     → assets-source/circuit/snoep-circuit.glb : maillages invisibles et
 *       mini-carte retirés, mis à l'échelle (×ECHELLE), recentré.
 *   npm run assets:optimiser
 *     → public/modeles/circuit/snoep-circuit.glb (textures 1024 = natives,
 *       aucune simplification, Meshopt 16 bits — voir GRANDE_ETENDUE).
 *   node scripts/preparer-piste-snoep.mjs tracer [apercu.png]
 *     → src/domain/tracePisteSnoep.ts : ligne médiane, pentes latérales,
 *       relèvements des karts — et vérification que AUCUN kart (le plus gros
 *       véhicule de la boutique) ne touche le décor. Refuse d'écrire sinon.
 *
 * Le modèle vient d'un jeu : il contient sa surface de roulage INVISIBLE
 * (`raod_tgsd_001__1`, matériau alpha 0). Elle donne la hauteur exacte de
 * la route et le chemin praticable entre les bandes de route visibles. Les
 * bandes visibles (`ROUTES`) donnent, elles, le centre de la chaussée.
 *
 * Le tracé est le plus court chemin entre des POINTS_DE_PASSAGE posés à la
 * main sur la vue de dessus, avec un coût qui pousse au CENTRE des bandes
 * (Dijkstra sur la carte des distances au bord), puis lissé et re-centré.
 * Les SAUTS (vide ou marche dans la surface) deviennent des zones : ligne
 * droite décollage → atterrissage + hauteur d'arc, animée au rendu
 * (`scene/figuresKart.ts`). Enfin, des passes d'ajustement écartent le tracé
 * des murs touchés d'un côté et resserrent les voies là où les deux côtés
 * touchent, jusqu'à zéro contact.
 *
 * Diagnostics (variables d'environnement) : DIAG=1 (détail des contacts),
 * PROFIL=i,j (coupes transversales), LONGI=i,j (profils en long et dévers),
 * RELIEF=1 (vides et fortes pentes), HORS=i,j (roues hors de la route visible),
 * FORCER=1 (écrit malgré les contacts).
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)))
const SOURCE = join(RACINE, 'assets-source', 'circuit', 'candy-source.glb')
const MODELE_PREPARE = join(RACINE, 'assets-source', 'circuit', 'snoep-circuit.glb')
const SORTIE_TRACE = join(RACINE, 'src', 'domain', 'tracePisteSnoep.ts')

/**
 * Mètres par unité du modèle. Les bandes de route font ~0,2 unité : ×50
 * donne une chaussée de ~10 m, où tiennent 4 voies de 2,4 m.
 */
const ECHELLE = 50

/**
 * Centre (x, z), dans la source, sur lequel le circuit est recentré — UNE
 * constante partagée par le modèle affiché (`preparer`) et le tracé
 * (`tracer`). Il était autrefois calculé sur la boîte des bandes de route :
 * ajouter une bande à ROUTES décalait alors tout le tracé de plusieurs mètres
 * par rapport au modèle déjà publié (karts dans le décor, 29/10).
 * Le changer impose de relancer « preparer », l'optimiseur ET « tracer ».
 */
const CENTRE_SOURCE = [0.465, -0.246]

/** Bandes de route visibles (nom de nœud, préfixe) — leur centre est le tracé. */
const ROUTES = [
  'road_tgsd_08_3_',
  'road_tgsd_08_2_',
  'road_tgsd_01_01_',
  'road_tgsd_05_01_',
  'road_tgsd_08_1_',
  'road_tgsd_12_01_',
  // Rampe rose du damier vers la route orange, et le damier lui-même.
  'tgsd_03_03_',
  'tgsd_11_01_',
]
/** La surface de roulage invisible du jeu. */
const SURFACE = 'raod_tgsd_001__1'
/** Retirés du modèle affiché : invisibles (alpha 0) ou hors scène (mini-carte). */
const A_RETIRER = /^(raod_tgsd_001__1|mini_map_road|tgsd_zhuanpan2?_01__0)/
/**
 * Hors vérification : le ciel (sphère de 33 unités), la mer plate sous tout le
 * décor, et les plans d'effet translucides (matériau « tgsd_02 », en BLEND :
 * reflets et halos de 16 unités de large — ce ne sont pas des obstacles).
 */
const HORS_COLLISION = /^(sky_tgsd|tgsd_12_01_|tgsd_02_)/

/** Résolution des cartes d'analyse, en mètres par pixel. */
const RESOLUTION = 0.25

/**
 * Points de passage, en pixels de la vue de dessus de référence (1600 ×
 * 1384 px pour x ∈ [-3,2 ; 4,2], z ∈ [-3 ; 3,4] unités du modèle source),
 * dans le sens de course. Départ : la bande à damier de la route jaune ; le
 * sens est celui des chevrons du pad d'accélération (arc-en-ciel → damier).
 */
const VUE = { x0: -3.2, x1: 4.2, z0: -3, z1: 3.4, largeur: 1600, hauteur: 1384 }
const POINTS_DE_PASSAGE = [
  [280, 560], [360, 470], [370, 400], [400, 330], [480, 280], [600, 250], [720, 250], [775, 290],
  [800, 330], [880, 300], [970, 265], [1040, 300], [1030, 380], [960, 460], [905, 540], [940, 590],
  [1050, 560], [1150, 520], [1215, 495], [1310, 470], [1390, 530], [1400, 610], [1350, 670], [1285, 690],
  [1245, 700], [1150, 760], [1030, 820], [950, 860], [870, 900], [800, 925], [775, 950], [690, 925], [600, 895],
  [500, 880], [445, 830], [425, 760], [360, 705], [260, 690], [195, 670], [220, 615],
]

/** Lissage du tracé (fenêtre ± en mètres) et pas du fichier généré. */
const LISSAGE = 8
const PAS_TRACE = 2
/**
 * Sauts : marche (entre deux points) qui fait un saut, élan avant le bord
 * (en points), hauteur d'arc minimale et marge au-dessus du décor.
 */
const MARCHE = 1.5
const ELAN = 2
const SAUT_MIN = 4
const DEGAGEMENT_SAUT = 2.6
/** Pad d'accélération (chevrons) et nappe de glace — maillages repérés à la vue de dessus. */
const BOOST = /^road_tgsd_11_01_/
/**
 * Zones définies entre deux POINTS_DE_PASSAGE (indices) : le canal de glace
 * bleu n'est pas un maillage à part, c'est un tronçon de la bande jaune/bleue.
 */
const ZONES_PAR_PASSAGES = [{ type: 'glace', de: 3, a: 7 }]
/**
 * Passes d'ajustement après la vérification : décalage latéral (pas et
 * maximum, en mètres), resserrement des voies (pas et minimum), étalement
 * sur les voisins (en points).
 */
const ITERATIONS_MAX = 50
const PAS_DECALAGE = 0.3
const DECALAGE_MAX = 4
const PAS_ECART = 0.08
// Jusqu'à la file indienne (0,15) dans un passage très étroit (canal de glace).
const ECART_MIN = 0.15
const ETALEMENT = 4
/** Demi-voie des roues d'une voiture (m) : elles doivent rester sur la route visible. */
const DEMI_VOIE_ROUES = 0.6
/** Joints entre bandes de route comblés (pixels). */
const JOINT = 4
/** Raccords sans bande peinte : portée (en points) où la surface de roulage compte comme route. */
const TRANSITION = 4
/** Hauteur max d'une surface plate « roulée dessus » au-dessus du plancher du kart. */
const AFFLEUREMENT = 0.5
/** Déplacement latéral maximal d'un re-centrage, en mètres. */
const RECENTRAGE_MAX = 3

const NOMBRE_VOIES = 4
/** Doit rester égal à la largeur de voie de `circuit3d.ts`. */
const LARGEUR_VOIE = 2.2
/** Dévers latéral maximal retenu, relèvement maximal d'un kart. */
const PENTE_MAX = 0.35
const RELEVE_MAX = 1

/**
 * Le plus gros véhicule de la boutique, en boîte : longueur de la stretch
 * limo, largeur de Hello Kitty, hauteur de Hello Kitty — pour qu'aucun
 * véhicule acheté ne traverse le décor.
 */
const KART = { demiLongueur: 1.75, demiLargeur: 0.95, hauteur: 2.3 }
/** Garde au sol ignorée par le test (bordures, joints de la route). */
const GARDE = 0.35
/** Surfaces du décor « roulables » : quasi horizontales, au plus à PLAT_MAX au-dessus de la route. */
const PLAT_NORMALE = 0.85
const PLAT_MAX = 1

const io = () =>
  new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const [, , commande, argument] = process.argv
if (commande === 'preparer') await preparer(argument ?? SOURCE)
else if (commande === 'tracer') await tracer(argument)
else {
  console.error('Usage : node scripts/preparer-piste-snoep.mjs preparer [source.glb] | tracer [apercu.png]')
  process.exit(1)
}

// --- Repère commun ----------------------------------------------------------------

/** Triangles (repère monde de la source, ou mis à l'échelle si `echelle`) des nœuds retenus. */
function* trianglesDe(document, garder, echelle = true, centre = [0, 0]) {
  for (const noeud of document.getRoot().listNodes()) {
    const maillage = noeud.getMesh()
    if (!maillage || !garder(noeud.getName())) continue
    const m = noeud.getWorldMatrix()
    for (const primitive of maillage.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION')
      const indices = primitive.getIndices()
      const v = []
      const P = []
      for (let k = 0; k < positions.getCount(); k++) {
        positions.getElement(k, v)
        const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]
        const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]
        const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
        P.push(echelle ? [(x - centre[0]) * ECHELLE, y * ECHELLE, (z - centre[1]) * ECHELLE] : [x, y, z])
      }
      const n = indices ? indices.getCount() : positions.getCount()
      for (let t = 0; t < n; t += 3) {
        const [a, b, c] = indices ? [indices.getScalar(t), indices.getScalar(t + 1), indices.getScalar(t + 2)] : [t, t + 1, t + 2]
        yield { nom: noeud.getName(), p: [P[a], P[b], P[c]] }
      }
    }
  }
}

// --- Préparation du modèle affiché -----------------------------------------------------

async function preparer(entree) {
  await MeshoptDecoder.ready
  if (!existsSync(entree)) throw new Error(`Source introuvable : ${entree}`)
  const document = await io().read(entree)
  const racine = document.getRoot()
  const centre = CENTRE_SOURCE

  let retires = 0
  for (const noeud of racine.listNodes()) {
    if (noeud.getMesh() && A_RETIRER.test(noeud.getName())) {
      noeud.dispose()
      retires += 1
    }
  }
  await document.transform(prune())

  // Un pivot unique : échelle puis recentrage (TRS de glTF : T après S).
  const scene = racine.listScenes()[0]
  const pivot = document
    .createNode('Circuit_snoep')
    .setScale([ECHELLE, ECHELLE, ECHELLE])
    .setTranslation([-centre[0] * ECHELLE, 0, -centre[1] * ECHELLE])
  for (const enfant of scene.listChildren()) {
    scene.removeChild(enfant)
    pivot.addChild(enfant)
  }
  scene.addChild(pivot)

  mkdirSync(dirname(MODELE_PREPARE), { recursive: true })
  await io().write(MODELE_PREPARE, document)
  console.log(`${retires} maillage(s) invisible(s) retiré(s), ×${ECHELLE}, recentré de (${centre.map((v) => v.toFixed(3)).join(', ')})`)
  console.log(`→ ${MODELE_PREPARE}\nÉtape suivante : npm run assets:optimiser, puis « tracer ».`)
}

// --- Tracé ----------------------------------------------------------------------------

/**
 * Rastérise des triangles (vue de dessus) : masque + hauteur la plus HAUTE
 * par pixel — parmi celles qu'`accepter(i, hauteur)` retient, s'il est donné.
 */
function rasteriser(triangles, grille, accepter = null) {
  const { L, H, x0, z0 } = grille
  const masque = new Uint8Array(L * H)
  const hauteur = new Float32Array(L * H).fill(-Infinity)
  for (const { p } of triangles) {
    const s = p.map((v) => [(v[0] - x0) / RESOLUTION, (v[2] - z0) / RESOLUTION, v[1]])
    const aire = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1])
    if (Math.abs(aire) < 1e-9) continue
    const yMin = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])))
    const yMax = Math.min(H - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])))
    const xMin = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])))
    const xMax = Math.min(L - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])))
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((s[1][0] - px) * (s[2][1] - py) - (s[2][0] - px) * (s[1][1] - py)) / aire
        const w1 = ((s[2][0] - px) * (s[0][1] - py) - (s[0][0] - px) * (s[2][1] - py)) / aire
        const w2 = 1 - w0 - w1
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue
        const i = y * L + x
        const h = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2]
        if (accepter && !accepter(i, h)) continue
        masque[i] = 1
        hauteur[i] = Math.max(hauteur[i], h)
      }
    }
  }
  return { masque, hauteur }
}

/** Distance au bord (en pixels) à l'intérieur du masque — chanfrein 3-4. */
function chanfrein(masque, L, H) {
  const d = new Float32Array(L * H)
  for (let i = 0; i < L * H; i++) d[i] = masque[i] ? 1e9 : 0
  const passe = (ordre) => {
    for (const y of ordre(H)) {
      for (const x of ordre(L)) {
        const i = y * L + x
        if (!d[i]) continue
        for (const [dx, dy, c] of [[-1, 0, 3], [1, 0, 3], [0, -1, 3], [0, 1, 3], [-1, -1, 4], [1, -1, 4], [-1, 1, 4], [1, 1, 4]]) {
          const nx = x + dx
          const ny = y + dy
          const v = nx < 0 || ny < 0 || nx >= L || ny >= H ? 0 : d[ny * L + nx]
          if (v + c < d[i]) d[i] = v + c
        }
      }
    }
  }
  const avant = (n) => Array.from({ length: n }, (_, k) => k)
  const arriere = (n) => Array.from({ length: n }, (_, k) => n - 1 - k)
  passe(avant)
  passe(arriere)
  passe(avant)
  passe(arriere)
  for (let i = 0; i < L * H; i++) d[i] /= 3
  return d
}

/** Plus court chemin (Dijkstra 8-voisins) de `a` à `b`, indices de pixels. */
function cheminCentre(cout, L, H, a, b) {
  const dist = new Float64Array(L * H).fill(Infinity)
  const pred = new Int32Array(L * H).fill(-1)
  const tas = [[0, a]]
  dist[a] = 0
  const pousser = (e) => {
    tas.push(e)
    let i = tas.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (tas[p][0] <= tas[i][0]) break
      ;[tas[p], tas[i]] = [tas[i], tas[p]]
      i = p
    }
  }
  const extraire = () => {
    const haut = tas[0]
    const dernier = tas.pop()
    if (tas.length) {
      tas[0] = dernier
      let i = 0
      for (;;) {
        const g = 2 * i + 1
        const d = g + 1
        let m = i
        if (g < tas.length && tas[g][0] < tas[m][0]) m = g
        if (d < tas.length && tas[d][0] < tas[m][0]) m = d
        if (m === i) break
        ;[tas[m], tas[i]] = [tas[i], tas[m]]
        i = m
      }
    }
    return haut
  }
  while (tas.length) {
    const [c, i] = extraire()
    if (i === b) break
    if (c > dist[i]) continue
    const x = i % L
    const y = (i - x) / L
    for (const [dx, dy, l] of [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= L || ny >= H) continue
      const j = ny * L + nx
      const nc = c + l * (cout[i] + cout[j]) / 2
      if (nc < dist[j]) {
        dist[j] = nc
        pred[j] = i
        pousser([nc, j])
      }
    }
  }
  const chemin = []
  for (let i = b; i !== -1; i = pred[i]) chemin.push(i)
  return chemin.reverse()
}

/** Rééchantillonne une boucle fermée de points 2D à pas constant. */
function reechantillonner(points, pas) {
  const boucle = [...points, points[0]]
  const cumul = [0]
  for (let i = 1; i < boucle.length; i++) cumul.push(cumul[i - 1] + Math.hypot(boucle[i][0] - boucle[i - 1][0], boucle[i][1] - boucle[i - 1][1]))
  const total = cumul[cumul.length - 1]
  const n = Math.round(total / pas)
  const sortie = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const s = (k * total) / n
    while (cumul[j + 1] < s) j++
    const u = (s - cumul[j]) / (cumul[j + 1] - cumul[j] || 1)
    sortie.push([boucle[j][0] + (boucle[j + 1][0] - boucle[j][0]) * u, boucle[j][1] + (boucle[j + 1][1] - boucle[j][1]) * u])
  }
  return sortie
}

/** Moyenne glissante circulaire sur ±k échantillons. */
function lisser(valeurs, k) {
  const n = valeurs.length
  return valeurs.map((_, i) => {
    let somme = 0
    for (let d = -k; d <= k; d++) somme += valeurs[(i + d + n) % n]
    return somme / (2 * k + 1)
  })
}

/** Médiane glissante circulaire sur ±k échantillons. */
function mediane(valeurs, k) {
  const n = valeurs.length
  return valeurs.map((_, i) => {
    const fenetre = []
    for (let d = -k; d <= k; d++) fenetre.push(valeurs[(i + d + n) % n])
    fenetre.sort((a, b) => a - b)
    return fenetre[k]
  })
}

/**
 * `reglages` : ajustements accumulés par les passes précédentes — décalage
 * latéral du tracé et resserrement des voies, par point (voir la fin).
 */
async function tracer(apercu, reglages = { decalages: null, ecarts: null, cotes: null, iteration: 0 }) {
  await MeshoptDecoder.ready
  const document = await io().read(SOURCE)
  const centre = CENTRE_SOURCE
  const estRoute = (nom) => ROUTES.some((r) => nom.startsWith(r))
  const routes = [...trianglesDe(document, estRoute, true, centre)]
  const surface = [...trianglesDe(document, (nom) => nom === SURFACE, true, centre)]
  const decor = [
    ...trianglesDe(document, (nom) => !estRoute(nom) && nom !== SURFACE && !A_RETIRER.test(nom) && !HORS_COLLISION.test(nom), true, centre),
  ]

  // Grille couvrant la surface de roulage, plus une marge.
  let x0 = Infinity
  let z0 = Infinity
  let x1 = -Infinity
  let z1 = -Infinity
  for (const { p } of [...routes, ...surface]) {
    for (const v of p) {
      x0 = Math.min(x0, v[0])
      z0 = Math.min(z0, v[2])
      x1 = Math.max(x1, v[0])
      z1 = Math.max(z1, v[2])
    }
  }
  x0 -= 10
  z0 -= 10
  const grille = { x0, z0, L: Math.ceil((x1 + 10 - x0) / RESOLUTION), H: Math.ceil((z1 + 10 - z0) / RESOLUTION) }
  const { L, H } = grille
  console.log(`grille ${L} × ${H} (${RESOLUTION} m/px)`)

  const R = rasteriser(routes, grille)
  const S = rasteriser(surface, grille)
  // Route PRATICABLE : visible ET sur la surface de roulage du jeu. L'anneau
  // vert, par exemple, est dessiné en entier mais ne se roule que d'un côté.
  const M = new Uint8Array(L * H)
  for (let i = 0; i < L * H; i++) M[i] = R.masque[i] && S.masque[i]
  const dM = chanfrein(M, L, H)
  const dS = chanfrein(S.masque, L, H)
  const dR = chanfrein(R.masque, L, H)
  // Route visible, joints comblés (fermeture de JOINT px) : c'est là que
  // doivent rester les roues de chaque voie.
  const horsR = new Uint8Array(L * H)
  for (let i = 0; i < L * H; i++) horsR[i] = R.masque[i] ? 0 : 1
  const versR = chanfrein(horsR, L, H)
  const dilate = new Uint8Array(L * H)
  for (let i = 0; i < L * H; i++) dilate[i] = R.masque[i] || versR[i] <= JOINT ? 1 : 0
  const dDilate = chanfrein(dilate, L, H)
  const routeVisible = new Uint8Array(L * H)
  for (let i = 0; i < L * H; i++) routeVisible[i] = dDilate[i] > JOINT ? 1 : 0

  // Coût : bas au centre de la route praticable, moyen sur la seule surface
  // de roulage (raccords, damier), élevé sur une bande visible hors surface,
  // prohibitif ailleurs.
  const cout = new Float32Array(L * H)
  for (let i = 0; i < L * H; i++) {
    if (M[i]) cout[i] = 1 + 60 / (1 + dM[i]) ** 2
    else if (S.masque[i]) cout[i] = 4 + 60 / (1 + dS[i]) ** 2
    else if (R.masque[i]) cout[i] = 12 + 60 / (1 + dR[i]) ** 2
    else cout[i] = 400
  }

  const versPixel = ([px, py]) => {
    const xs = VUE.x0 + (px / VUE.largeur) * (VUE.x1 - VUE.x0)
    const zs = VUE.z0 + (py / VUE.hauteur) * (VUE.z1 - VUE.z0)
    const gx = Math.round(((xs - centre[0]) * ECHELLE - x0) / RESOLUTION)
    const gy = Math.round(((zs - centre[1]) * ECHELLE - z0) / RESOLUTION)
    return gy * L + gx
  }
  const passages = POINTS_DE_PASSAGE.map(versPixel)
  for (const [k, i] of passages.entries()) {
    if (!R.masque[i] && !S.masque[i]) console.warn(`  ⚠ point de passage ${k} hors de la route`)
  }

  let chemin = []
  for (let k = 0; k < passages.length; k++) {
    const segment = cheminCentre(cout, L, H, passages[k], passages[(k + 1) % passages.length])
    chemin.push(...segment.slice(0, -1))
  }
  const pixelsHorsSurface = chemin.filter((i) => !R.masque[i] && !S.masque[i]).length
  console.log(`chemin brut : ${chemin.length} px, ${pixelsHorsSurface} hors surface`)

  // Pixels → mètres, lissage, pas constant.
  let xz = chemin.map((i) => [x0 + ((i % L) + 0.5) * RESOLUTION, z0 + (Math.floor(i / L) + 0.5) * RESOLUTION])
  xz = reechantillonner(xz, 0.5)
  const k = Math.round(LISSAGE / 0.5)
  const xs = lisser(lisser(xz.map((p) => p[0]), k), k)
  const zs = lisser(lisser(xz.map((p) => p[1]), k), k)
  xz = reechantillonner(xs.map((x, i) => [x, zs[i]]), PAS_TRACE)

  // Le lissage coupe les virages : on RE-CENTRE chaque point entre les bords
  // réels de la route praticable (à défaut, de la surface de roulage),
  // perpendiculairement au tracé, puis on relisse légèrement — 4 fois.
  const dans = (masque, x, z) => {
    const gx = Math.floor((x - x0) / RESOLUTION)
    const gy = Math.floor((z - z0) / RESOLUTION)
    return gx >= 0 && gy >= 0 && gx < L && gy < H && masque[gy * L + gx] === 1
  }
  for (let passe = 0; passe < 4; passe++) {
    const m = xz.length
    const recentres = xz.map(([x, z], i) => {
      const a = xz[(i - 1 + m) % m]
      const b = xz[(i + 1) % m]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const [dx, dz] = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]
      const masque = dans(M, x, z) ? M : S.masque
      const bord = (signe) => {
        for (let d = 0; d < 25; d += RESOLUTION / 2) if (!dans(masque, x + dx * d * signe, z + dz * d * signe)) return d
        return 25
      }
      const decale = (bord(1) - bord(-1)) / 2
      // Bornée : un bord manquant (raccord, damier) ne jette pas le tracé ailleurs.
      const borne = Math.max(-RECENTRAGE_MAX, Math.min(RECENTRAGE_MAX, decale))
      return [x + dx * borne, z + dz * borne]
    })
    const kx = lisser(recentres.map((p) => p[0]), 3)
    const kz = lisser(recentres.map((p) => p[1]), 3)
    xz = reechantillonner(kx.map((x, i) => [x, kz[i]]), PAS_TRACE)
  }
  const n = xz.length

  // Ajustements des passes précédentes : le tracé s'écarte d'un mur touché
  // d'un seul côté ; les voies se resserrent là où les deux côtés touchent.
  const ecarts = reglages.ecarts ?? new Array(n).fill(1)
  if (reglages.decalages) {
    const avant = xz
    xz = avant.map(([x, z], i) => {
      const a = avant[(i - 1 + n) % n]
      const b = avant[(i + 1) % n]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const [tx, tz] = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
      return [x - tz * reglages.decalages[i], z + tx * reglages.decalages[i]]
    })
  }

  // Hauteur de chaussée en (x, z) : la bande visible si elle est là, sinon
  // la surface de roulage — en évitant les ponts : la plus proche de `ref`.
  const echantillon = (x, z) => {
    const gx = Math.floor((x - x0) / RESOLUTION)
    const gy = Math.floor((z - z0) / RESOLUTION)
    if (gx < 0 || gy < 0 || gx >= L || gy >= H) return null
    const i = gy * L + gx
    if (R.masque[i]) return R.hauteur[i]
    if (S.masque[i]) return S.hauteur[i]
    return null
  }
  const brut = xz.map(([x, z]) => echantillon(x, z))
  // Trous (vide entre deux bandes) : interpolés depuis les voisins valides.
  const combles = brut.map((y, i) => {
    if (y !== null) return y
    for (let d = 1; d < n; d++) {
      const a = brut[(i - d + n) % n]
      const b = brut[(i + d) % n]
      if (a !== null && b !== null) return (a + b) / 2
      if (a !== null) return a
      if (b !== null) return b
    }
    return 0
  })

  // SAUTS : là où la surface manque (vide) ou décroche d'une marche entre
  // deux points. Décollage ELAN points avant le bord, atterrissage assez loin
  // après le pied de la falaise (2 m par mètre de chute, au moins 4 m).
  const rupture = (i) => {
    const a = brut[((i % n) + n) % n]
    const b = brut[(((i + 1) % n) + n) % n]
    return a === null || b === null || Math.abs(b - a) > MARCHE
  }
  const sauts = []
  for (let i = 0; i < n; i++) {
    if (!rupture(i) || rupture(i - 1)) continue
    let j = i
    while (rupture(j) && j < i + n) j++
    const chute = Math.abs(combles[j % n] - combles[i])
    const a = i - ELAN
    const b = j + Math.max(2, Math.ceil(chute / PAS_TRACE))
    const precedent = sauts[sauts.length - 1]
    if (precedent && a <= precedent.b) precedent.b = Math.max(precedent.b, b)
    else sauts.push({ a, b })
  }
  const dansSaut = (i) => sauts.find(({ a, b }) => i > a && i < b)
  const ligne = (saut, k) => {
    const u = (k - saut.a) / (saut.b - saut.a)
    const ya = combles[((saut.a % n) + n) % n]
    const yb = combles[saut.b % n]
    return { u, y: ya + (yb - ya) * u }
  }

  // Hauteurs : la ligne droite décollage → atterrissage dans les sauts (l'arc
  // s'y ajoute au rendu), ailleurs la surface lissée — sans descendre sous la
  // surface ni flotter à plus de 15 cm au-dessus (bords des falaises).
  const continues = combles.map((y, i) => {
    const saut = dansSaut(i)
    return saut ? ligne(saut, i).y : y
  })
  const lissees = lisser(mediane(continues, 3), 2)
  let ys = lissees.map((y, i) => (dansSaut(i) ? continues[i] : Math.min(Math.max(y, combles[i]), combles[i] + 0.15)))
  if (process.env.RELIEF) {
    for (let i = 0; i < n; i++) {
      const pente = brut[i] !== null && brut[(i + 1) % n] !== null ? (brut[(i + 1) % n] - brut[i]) / PAS_TRACE : null
      if (brut[i] === null || Math.abs(pente) > 0.15) console.log('relief #' + i + ' y ' + (brut[i]?.toFixed(2) ?? 'VIDE') + ' pente ' + (pente?.toFixed(2) ?? '-'))
    }
  }

  // Surfaces plates du décor à fleur de route (pad d'accélération, rebords,
  // plateformes) : les karts roulent DESSUS — elles comptent pour le
  // relèvement, et la boîte relevée passe alors au-dessus.
  // Pixel par pixel : un grand triangle en pente (la rampe du damier) ne
  // compte que là où il affleure la route.
  const plats = decor.filter(({ p }) => {
    const e1 = p[1].map((v, a) => v - p[0][a])
    const e2 = p[2].map((v, a) => v - p[0][a])
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    return Math.abs(n[1]) / (Math.hypot(...n) || 1) >= PLAT_NORMALE
  })
  const routeEn = (i) => (R.masque[i] ? R.hauteur[i] : S.masque[i] ? S.hauteur[i] : null)
  const P = rasteriser(plats, grille, (i, h) => {
    const route = routeEn(i)
    return route !== null && h - route > -0.2 && h - route <= PLAT_MAX
  })
  const sol = (x, z) => {
    const y = echantillon(x, z)
    if (y === null) return null
    const gx = Math.floor((x - x0) / RESOLUTION)
    const gy = Math.floor((z - z0) / RESOLUTION)
    const i = gy * L + gx
    return P.masque[i] && P.hauteur[i] > y && P.hauteur[i] - y <= PLAT_MAX ? P.hauteur[i] : y
  }

  // Repère local (tangente horizontale, droite), largeur et dévers.
  const tangentes = xz.map((_, i) => {
    const a = xz[(i - 1 + n) % n]
    const b = xz[(i + 1) % n]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
  })
  // Arc de chaque saut : assez haut pour passer AU-DESSUS du bord (sur
  // toutes les voies, avec une marge), et jamais moins que SAUT_MIN — un
  // petit saut est aussi spectaculaire qu'un grand.
  for (const saut of sauts) {
    const longueur = (saut.b - saut.a) * PAS_TRACE
    let besoin = SAUT_MIN + longueur * 0.08
    for (let k = saut.a + 1; k < saut.b; k++) {
      const i = ((k % n) + n) % n
      const { u, y } = ligne(saut, k)
      const [tx, tz] = tangentes[i]
      for (const d of [-4.5, -2.25, 0, 2.25, 4.5]) {
        const surface = sol(xz[i][0] - tz * d, xz[i][1] + tx * d)
        if (surface !== null) besoin = Math.max(besoin, (surface + DEGAGEMENT_SAUT - y) / Math.max(0.15, 4 * u * (1 - u)))
      }
    }
    saut.hauteur = besoin
    console.log('saut #' + saut.a + ' → #' + saut.b + ' : ' + longueur + ' m, chute ' + (ligne(saut, saut.a).y - ligne(saut, saut.b).y).toFixed(1) + ' m, arc ' + besoin.toFixed(1) + ' m')
  }

  const largeurs = []
  const pentes = []
  for (let i = 0; i < n; i++) {
    const [tx, tz] = tangentes[i]
    const [dx, dz] = [-tz, tx]
    const portee = (signe) => {
      for (let d = 0; d < 20; d += RESOLUTION / 2) {
        if (echantillon(xz[i][0] + dx * d * signe, xz[i][1] + dz * d * signe) === null) return d
      }
      return 20
    }
    largeurs.push(portee(1) + portee(-1))
    // Dévers : régression des hauteurs sur ± la demi-largeur des voies.
    const mesures = []
    for (let d = -4.8; d <= 4.8; d += 0.6) {
      const y = echantillon(xz[i][0] + dx * d, xz[i][1] + dz * d)
      if (y !== null && Math.abs(y - ys[i]) < 1.5) mesures.push([d, y])
    }
    pentes.push(mesures.length >= 4 ? Math.max(-PENTE_MAX, Math.min(PENTE_MAX, regression(mesures))) : 0)
  }
  const pentesLissees = lisser(mediane(pentes, 4), 3)

  // Relèvement : un kart rigide ne doit s'enfoncer nulle part sous sa caisse.
  // La caisse suit la pente de la route (tangage) ET son dévers (roulis, voir
  // `circuit3d.ts`) : chaque point de son plancher est comparé à la surface —
  // nez et arrière au pied des rampes, coins dans les virages relevés.
  // Différences d'un seul côté au bord d'un saut : la ligne de vol n'est pas une pente.
  const enVol = (i) => Boolean(dansSaut(i) ?? dansSaut(i + n))
  const pentesLongi = ys.map((_, i) => {
    const avant = (i + 1) % n
    const arriere = (i - 1 + n) % n
    if (enVol(avant) && !enVol(arriere)) return (ys[i] - ys[arriere]) / PAS_TRACE
    if (enVol(arriere) && !enVol(avant)) return (ys[avant] - ys[i]) / PAS_TRACE
    return (ys[avant] - ys[arriere]) / (2 * PAS_TRACE)
  })
  // Une voie qui devrait monter de plus de RELEVE_MAX s'enfoncerait : c'est un contact.
  const enfoncements = []
  const decalages = Array.from({ length: NOMBRE_VOIES }, (_, v) => (v - (NOMBRE_VOIES - 1) / 2) * LARGEUR_VOIE)
  const releves = []
  const plafonnes = []
  for (let i = 0; i < n; i++) {
    const [tx, tz] = tangentes[i]
    let max = 0
    for (const [voie, d0] of decalages.entries()) {
      let maxVoie = 0
      const d = d0 * ecarts[i]
      const base = ys[i] + pentesLissees[i] * d
      for (const l of [-1, -0.5, 0, 0.5, 1].map((u) => u * KART.demiLongueur)) {
        for (const w of [-1, -0.5, 0, 0.5, 1].map((u) => u * KART.demiLargeur)) {
          const y = sol(xz[i][0] + tx * l - tz * (d + w), xz[i][1] + tz * l + tx * (d + w))
          const plancher = base + pentesLongi[i] * l + pentesLissees[i] * w
          if (y !== null && y - plancher < 1) maxVoie = Math.max(maxVoie, y - plancher)
        }
      }
      max = Math.max(max, maxVoie)
      if (maxVoie > RELEVE_MAX && !enVol(i)) enfoncements.push({ point: i, voie, nom: '(sol)', x: xz[i][0], z: xz[i][1] })
    }
    if (max > RELEVE_MAX && !enVol(i)) plafonnes.push(i)
    releves.push(Math.min(RELEVE_MAX, max))
  }
  const relevesLisses = lisser(releves.map((_, i) => Math.max(...[-2, -1, 0, 1, 2].map((d) => releves[(i + d + n) % n]))), 2)
  // En vol : ni dévers, ni relèvement — et l'arc s'ajoute au sol pour la vérification.
  const arcs = new Array(n).fill(0)
  for (const saut of sauts) {
    for (let k = saut.a + 1; k < saut.b; k++) {
      const i = ((k % n) + n) % n
      pentesLissees[i] = 0
      relevesLisses[i] = 0
      const { u } = ligne(saut, k)
      arcs[i] = saut.hauteur * 4 * u * (1 - u)
    }
  }

  // Zones remarquables : pad d'accélération (les flammes s'allument) et
  // route de glace (le kart glisse). Repérées sous le CENTRE du tracé.
  const zonesDe = (motif) => {
    const masque = rasteriser([...routes, ...decor].filter((t) => motif.test(t.nom)), grille).masque
    const sur = xz.map(([x, z]) => dans(masque, x, z))
    const resultat = []
    for (let i = 0; i < n; i++) {
      if (!sur[i] || sur[(i - 1 + n) % n]) continue
      let j = i
      while (sur[(j + 1) % n] && j < i + n) j++
      resultat.push([i, j])
    }
    return resultat
  }
  // Point du tracé le plus proche d'un point de passage (en mètres).
  const passagesXZ = passages.map((i) => [x0 + ((i % L) + 0.5) * RESOLUTION, z0 + (Math.floor(i / L) + 0.5) * RESOLUTION])
  const plusProche = ([px, pz]) => xz.reduce((m, [x, z], i) => (Math.hypot(x - px, z - pz) < Math.hypot(xz[m][0] - px, xz[m][1] - pz) ? i : m), 0)
  const zones = [
    ...sauts.map(({ a, b, hauteur }) => ['saut', a, b, Number(hauteur.toFixed(1))]),
    ...zonesDe(BOOST).map(([a, b]) => ['boost', a, b, 0]),
    ...ZONES_PAR_PASSAGES.map(({ type, de, a }) => [type, plusProche(passagesXZ[de]), plusProche(passagesXZ[a]), 0]),
  ]
  for (const z of zones) if (z[0] !== 'saut') console.log('zone ' + z[0] + ' #' + z[1] + ' → #' + z[2])

  if (process.env.PROFIL) {
    // Coupe transversale d'un point : route (R/S), plats, et décor dans la tranche de hauteur des karts.
    const D = rasteriser(decor, grille, (i, h) => {
      const r = routeEn(i)
      return r !== null ? h - r > 0.3 && h - r < 2.6 : false
    })
    for (const i of process.env.PROFIL.split(',').map(Number)) {
      const [tx, tz] = tangentes[i]
      let ligne = ''
      for (let d = -8; d <= 8; d += 0.5) {
        const x = xz[i][0] - tz * d
        const z = xz[i][1] + tx * d
        const g = Math.floor((z - z0) / RESOLUTION) * L + Math.floor((x - x0) / RESOLUTION)
        ligne += D.masque[g] ? '#' : P.masque[g] ? 'p' : M[g] ? '=' : S.masque[g] ? 's' : R.masque[g] ? 'r' : '.'
      }
      console.log(`profil #${i} y=${ys[i].toFixed(2)} [-8 m … +8 m] ${ligne}`)
      const g0 = Math.floor((xz[i][1] - z0) / RESOLUTION) * L + Math.floor((xz[i][0] - x0) / RESOLUTION)
      const noms = new Set(decor.filter(({ p }) => Math.min(...p.map((v) => Math.hypot(v[0] - xz[i][0], v[2] - xz[i][1]))) < 3).map((t) => t.nom))
      console.log(`   R ${R.masque[g0] ? R.hauteur[g0].toFixed(2) : '-'} S ${S.masque[g0] ? S.hauteur[g0].toFixed(2) : '-'} P ${P.masque[g0] ? P.hauteur[g0].toFixed(2) : '-'} décor proche : ${[...noms].join(' ')}`)
    }
  }

  // Vérification : aucun véhicule (boîte du plus gros) ne touche le décor.
  // Près d'un raccord sans bande peinte (le tracé lui-même quitte la route
  // visible à ± TRANSITION points), la surface de roulage compte comme route.
  const centreHors = xz.map(([x, z]) => !dans(routeVisible, x, z))
  const routeOuSurface = new Uint8Array(L * H)
  for (let i = 0; i < L * H; i++) routeOuSurface[i] = routeVisible[i] || S.masque[i] ? 1 : 0
  const horsRoute = []
  for (let i = 0; i < n; i++) {
    if (enVol(i)) continue
    const [tx, tz] = tangentes[i]
    let transition = false
    for (let k = -TRANSITION; k <= TRANSITION; k++) transition ||= centreHors[(i + k + n) % n]
    const masque = transition ? routeOuSurface : routeVisible
    for (const [voie, d0] of decalages.entries()) {
      const d = d0 * ecarts[i]
      const dehors = [-0.8, 0, 0.8].some((l) =>
        [-DEMI_VOIE_ROUES, DEMI_VOIE_ROUES].some((w) => {
          const lx = l * KART.demiLongueur
          return !dans(masque, xz[i][0] + tx * lx - tz * (d + w), xz[i][1] + tz * lx + tx * (d + w))
        }),
      )
      if (dehors && process.env.HORS && process.env.HORS.split(',').map(Number).includes(i)) {
        const echecs = []
        for (const l of [-0.8, 0, 0.8]) for (const w of [-DEMI_VOIE_ROUES, DEMI_VOIE_ROUES]) {
          const lx = l * KART.demiLongueur
          const x = xz[i][0] + tx * lx - tz * (d + w)
          const z = xz[i][1] + tz * lx + tx * (d + w)
          if (!dans(masque, x, z)) echecs.push(`l${l} w${(d + w).toFixed(1)} R${dans(R.masque, x, z) ? 1 : 0} V${dans(routeVisible, x, z) ? 1 : 0} S${dans(S.masque, x, z) ? 1 : 0}`)
        }
        console.log(`hors #${i} voie ${voie} masque ${masque === routeVisible ? 'visible' : 'visible+surface'} : ${echecs.join(' | ')}`)
      }
      if (dehors) horsRoute.push({ point: i, voie, nom: '(hors route)', x: xz[i][0] - tz * d, z: xz[i][1] + tx * d })
    }
  }
  const collisions = horsRoute.concat(enfoncements).concat(verifierKarts(decor, {
    n,
    xz,
    ys: ys.map((y, i) => y + arcs[i]),
    tangentes,
    pentes: pentesLissees,
    releves: relevesLisses,
    decalages,
    ecarts,
  }))

  if (process.env.LONGI) for (const i of process.env.LONGI.split(',').map(Number)) {
    const [tx, tz] = tangentes[i]
    let t = ''
    for (let l = -4; l <= 4; l += 0.5) { const y = sol(xz[i][0] + tx * l, xz[i][1] + tz * l); t += (y === null ? '  -  ' : (y - ys[i]).toFixed(2)) + ' ' }
    console.log('longi #' + i + ' devers ' + pentesLissees[i].toFixed(2) + ' brut ' + pentes[i].toFixed(2) + ' pente ' + pentesLongi[i].toFixed(2) + ' : ' + t)
  }
  if (plafonnes.length) console.warn(`  ⚠ relèvement plafonné (${RELEVE_MAX} m) : #${plafonnes.join(', #')}`)
  const ordonnees = [...largeurs].sort((a, b) => a - b)
  const p5 = ordonnees[Math.floor(n * 0.05)]
  const longueur = xz.reduce((t, p, i) => t + Math.hypot(xz[(i + 1) % n][0] - p[0], ys[(i + 1) % n] - ys[i], xz[(i + 1) % n][1] - p[1]), 0)
  console.log(
    `tracé : ${n} points, ${longueur.toFixed(0)} m — largeur min ${ordonnees[0].toFixed(1)} m, p5 ${p5.toFixed(1)} m, médiane ${ordonnees[Math.floor(n / 2)].toFixed(1)} m`,
  )
  console.log(`hauteurs ${Math.min(...ys).toFixed(1)} → ${Math.max(...ys).toFixed(1)} m ; relèvement max ${Math.max(...relevesLisses).toFixed(2)} m`)

  if (apercu) await dessinerApercu(apercu, { R, S, L, H, x0, z0, xz, collisions })

  if (collisions.length > 0 && reglages.iteration < ITERATIONS_MAX) {
    // Passe suivante : chaque point touché d'un seul côté pousse le tracé de
    // l'autre côté ; touché des deux côtés, il resserre ses voies. L'effet
    // s'étale sur les voisins (± ETALEMENT points) pour rester fluide.
    const pousse = new Array(n).fill(0)
    const serre = new Array(n).fill(0)
    // Mémoire des côtés touchés au fil des passes : un point touché à gauche
    // PUIS à droite (le tracé y oscille) se resserre au lieu de rebondir.
    const memoire = reglages.cotes ?? new Array(n).fill(0)
    const cotes = new Map()
    for (const c of collisions) {
      if (!cotes.has(c.point)) cotes.set(c.point, new Set())
      const cote = c.voie < NOMBRE_VOIES / 2 ? 'gauche' : 'droite'
      cotes.get(c.point).add(cote)
      memoire[c.point] |= cote === 'gauche' ? 1 : 2
    }
    for (const [i, cote] of cotes) if (memoire[i] === 3) cote.add('gauche').add('droite')
    for (const [i, cote] of cotes) {
      for (let k = -ETALEMENT; k <= ETALEMENT; k++) {
        const j = (i + k + n) % n
        const poids = 1 - Math.abs(k) / (ETALEMENT + 1)
        // Des deux côtés, ou déjà poussé au maximum : on resserre les voies.
        const bloque = Math.abs((reglages.decalages ?? [])[j] ?? 0) >= DECALAGE_MAX - 1e-6
        if (cote.size === 2 || bloque) serre[j] = Math.max(serre[j], poids)
        else pousse[j] += (cote.has('gauche') ? 1 : -1) * poids / (2 * ETALEMENT + 1) * 3
      }
    }
    const decalagesAvant = reglages.decalages ?? new Array(n).fill(0)
    console.log(`  passe ${reglages.iteration + 1} : ${collisions.length} contact(s), ajustement…`)
    return tracer(apercu, {
      iteration: reglages.iteration + 1,
      decalages: decalagesAvant.map((d, i) =>
        Math.max(-DECALAGE_MAX, Math.min(DECALAGE_MAX, d + Math.sign(pousse[i]) * Math.min(1, Math.abs(pousse[i])) * PAS_DECALAGE)),
      ),
      ecarts: ecarts.map((e, i) => Math.max(ECART_MIN, e - serre[i] * PAS_ECART)),
      cotes: memoire,
    })
  }

  if (collisions.length > 0) {
    const parNom = new Map()
    for (const c of collisions) parNom.set(c.nom, (parNom.get(c.nom) ?? 0) + 1)
    console.error(`✗ ${collisions.length} contact(s) kart/décor :`, [...parNom].map(([a, b]) => `${a}×${b}`).join(', '))
    console.error(`  points : ${collisions.slice(0, process.env.DIAG ? 999 : 8).map((c) => `#${c.point} voie ${c.voie}`).join(', ')}`)
    // FORCER=1 : écrit quand même, pour inspecter la piste dans l'application.
    if (!process.env.FORCER) process.exit(2)
  }

  const arrondi = (v, d = 2) => Number(v.toFixed(d))
  const points = xz.flatMap(([x, z], i) => [arrondi(x), arrondi(ys[i]), arrondi(z)])
  writeFileSync(
    SORTIE_TRACE,
    `/**
 * Ligne médiane du circuit « snoep » — FICHIER GÉNÉRÉ par
 * \`scripts/preparer-piste-snoep.mjs tracer\`, ne pas éditer à la main.
 * ${n} points (x, y, z) tous les ~${PAS_TRACE} m, boucle fermée, sens de course ;
 * départ sur la bande à damier de la route jaune.
 */

/** Largeur de chaussée au plus étroit (5e centile), en mètres. */
export const LARGEUR_ASPHALTE_MIN = ${arrondi(p5, 1)}

// prettier-ignore
export const POINTS_PISTE: readonly number[] = [${points.join(',')}]

/** Dévers : hauteur d'un kart décalé de d = y + pente × d. */
// prettier-ignore
export const PENTES_PISTE: readonly number[] = [${pentesLissees.map((v) => arrondi(v, 3)).join(',')}]

/** Relèvement des karts (rampes, raccords de bandes), en mètres. */
// prettier-ignore
export const RELEVEMENTS_KARTS: readonly number[] = [${relevesLisses.map((v) => arrondi(v)).join(',')}]

/**
 * Zones remarquables : [type, premier point, dernier point, hauteur d'arc].
 * « saut » : entre les deux points, POINTS_PISTE suit la ligne droite
 * décollage → atterrissage ; l'arc (hauteur au milieu) s'y ajoute au rendu.
 */
// prettier-ignore
export const ZONES_PISTE: readonly (readonly ['saut' | 'boost' | 'glace', number, number, number])[] = ${JSON.stringify(zones)}

/** Resserrement des voies par point (1 = largeur normale) — passages étroits. */
// prettier-ignore
export const ECARTEMENTS_VOIES: readonly number[] = [${ecarts.map((v) => arrondi(v)).join(',')}]
`,
  )
  console.log(`${collisions.length ? '⚠ écrit malgré les contacts (FORCER)' : '✓ aucun contact kart/décor'} → ${SORTIE_TRACE}`)
}

function regression(mesures) {
  const n = mesures.length
  const mx = mesures.reduce((s, [x]) => s + x, 0) / n
  const my = mesures.reduce((s, [, y]) => s + y, 0) / n
  let num = 0
  let den = 0
  for (const [x, y] of mesures) {
    num += (x - mx) * (y - my)
    den += (x - mx) ** 2
  }
  return den ? num / den : 0
}

/**
 * Boîte du plus gros véhicule, sur chaque voie, tous les 2 m : test
 * triangle/boîte (axes séparateurs) contre tout le décor, via une grille
 * spatiale. Renvoie les contacts (point, voie, maillage).
 */
function verifierKarts(decor, { n, xz, ys, tangentes, pentes, releves, decalages, ecarts }) {
  const CELLULE = 6
  const cle = (cx, cz) => `${cx},${cz}`
  const index = new Map()
  for (const t of decor) {
    const xs = t.p.map((v) => v[0])
    const zs = t.p.map((v) => v[2])
    for (let cx = Math.floor(Math.min(...xs) / CELLULE); cx <= Math.floor(Math.max(...xs) / CELLULE); cx++) {
      for (let cz = Math.floor(Math.min(...zs) / CELLULE); cz <= Math.floor(Math.max(...zs) / CELLULE); cz++) {
        const k = cle(cx, cz)
        if (!index.has(k)) index.set(k, [])
        index.get(k).push(t)
      }
    }
  }
  const demi = [KART.demiLongueur, (KART.hauteur - GARDE) / 2, KART.demiLargeur]
  const contacts = []
  for (let i = 0; i < n; i++) {
    const [tx, tz] = tangentes[i]
    const avant = [tx, 0, tz]
    const haut = [0, 1, 0]
    const droite = [-tz, 0, tx]
    for (const [voie, d0] of decalages.entries()) {
      const d = d0 * ecarts[i]
      const sol = ys[i] + pentes[i] * d + releves[i]
      const c = [xz[i][0] + droite[0] * d, sol + GARDE + demi[1], xz[i][1] + droite[2] * d]
      const vus = new Set()
      let touche = null
      for (const [cx, cz] of [[Math.floor(c[0] / CELLULE), Math.floor(c[2] / CELLULE)]].flatMap(([a, b]) =>
        [-1, 0, 1].flatMap((u) => [-1, 0, 1].map((w) => [a + u, b + w])),
      )) {
        for (const t of index.get(cle(cx, cz)) ?? []) {
          if (vus.has(t)) continue
          vus.add(t)
          // Triangle dans le repère de la boîte.
          const q = t.p.map((v) => {
            const r = [v[0] - c[0], v[1] - c[1], v[2] - c[2]]
            return [r[0] * avant[0] + r[2] * avant[2], r[1], r[0] * droite[0] + r[2] * droite[2]]
          })
          if (triangleBoite(q, demi) && !affleure(t, sol)) {
            touche = t.nom
            if (process.env.DIAG) {
              const e1 = t.p[1].map((v, a) => v - t.p[0][a])
              const e2 = t.p[2].map((v, a) => v - t.p[0][a])
              const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
              const ny = Math.abs(nrm[1]) / (Math.hypot(...nrm) || 1)
              console.log(`  #${i} v${voie} ${t.nom} y ${(Math.min(...t.p.map((v) => v[1])) - sol).toFixed(2)}…${(Math.max(...t.p.map((v) => v[1])) - sol).toFixed(2)} ny ${ny.toFixed(2)}`)
            }
            break
          }
        }
        if (touche) break
      }
      if (touche) contacts.push({ point: i, voie, nom: touche, x: c[0], z: c[2] })
    }
  }
  return contacts
}

/**
 * Surface quasi horizontale à moins de AFFLEUREMENT au-dessus du plancher
 * (nappe de glace, pad, joints) : le kart roule dessus, ce n'est pas un choc.
 */
function affleure(t, sol) {
  const e1 = t.p[1].map((v, a) => v - t.p[0][a])
  const e2 = t.p[2].map((v, a) => v - t.p[0][a])
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
  return Math.abs(n[1]) / (Math.hypot(...n) || 1) >= PLAT_NORMALE && Math.max(...t.p.map((v) => v[1])) - sol <= AFFLEUREMENT
}

/** Test d'intersection triangle / boîte centrée à l'origine (Akenine-Möller). */
function triangleBoite([v0, v1, v2], h) {
  for (let a = 0; a < 3; a++) {
    if (Math.min(v0[a], v1[a], v2[a]) > h[a] || Math.max(v0[a], v1[a], v2[a]) < -h[a]) return false
  }
  const sous = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const aretes = [sous(v1, v0), sous(v2, v1), sous(v0, v2)]
  const normale = croix(aretes[0], aretes[1])
  const axes = [normale]
  for (const e of aretes) for (const u of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) axes.push(croix(u, e))
  for (const axe of axes) {
    if (Math.abs(axe[0]) + Math.abs(axe[1]) + Math.abs(axe[2]) < 1e-12) continue
    const p = [scal(v0, axe), scal(v1, axe), scal(v2, axe)]
    const r = h[0] * Math.abs(axe[0]) + h[1] * Math.abs(axe[1]) + h[2] * Math.abs(axe[2])
    if (Math.min(...p) > r || Math.max(...p) < -r) return false
  }
  return true
}

async function dessinerApercu(chemin, { R, S, L, H, x0, z0, xz, collisions }) {
  const rgb = new Uint8Array(L * H * 3)
  for (let i = 0; i < L * H; i++) {
    if (R.masque[i]) rgb.set([150, 150, 150], i * 3)
    else if (S.masque[i]) rgb.set([70, 70, 90], i * 3)
  }
  const pixel = (x, z, couleur, r = 1) => {
    const gx = Math.floor((x - x0) / RESOLUTION)
    const gy = Math.floor((z - z0) / RESOLUTION)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const X = gx + dx
        const Y = gy + dy
        if (X >= 0 && Y >= 0 && X < L && Y < H) rgb.set(couleur, (Y * L + X) * 3)
      }
    }
  }
  for (const [i, [x, z]] of xz.entries()) pixel(x, z, i === 0 ? [255, 0, 0] : [255, 220, 0], i === 0 ? 4 : 1)
  for (const c of collisions) pixel(c.x, c.z, [255, 0, 255], 2)
  await sharp(Buffer.from(rgb), { raw: { width: L, height: H, channels: 3 } }).png().toFile(chemin)
  console.log(`aperçu → ${chemin}`)
}
