#!/usr/bin/env node
/**
 * Pipeline d'assets — §4 du plan.
 *
 * Optimise chaque modèle glTF de `assets-source/` (bruts, tels que
 * téléchargés ou exportés de Blender) vers `public/modeles/` (commités,
 * chargés par l'application) : encodage Meshopt, textures en WebP,
 * dédoublonnage de matériaux, purge des nœuds inutiles.
 *
 * Pipeline vérifié de bout en bout (dedup, instance, palette, meshopt,
 * conversion WebP) sur un asset jetable avant la première utilisation réelle
 * — voir le registre `public/modeles/LICENCES.md` pour la traçabilité des
 * sources CC0.
 *
 * Usage : npm run assets:optimiser [-- <préfixe de chemin>…]
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { extraireRoues } from './roues.mjs'

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)))
const SOURCE = join(RACINE, 'assets-source')
const DESTINATION = join(RACINE, 'public', 'modeles')

const EXTENSIONS = ['.glb', '.gltf']

/**
 * Assets dont les matériaux nommés doivent survivre à l'optimisation : la
 * fusion palette (qui remplace tous les matériaux par une texture unique)
 * est désactivée pour eux. Le kart en dépend — sa `Carrosserie` est teintée
 * par agent au chargement (voir `src/scene/KartRacePulse.tsx`).
 */
const SANS_PALETTE = new Set(['vehicules/kart-race-pulse.glb'])

/**
 * Véhicules de la boutique : leurs roues sont des nœuds à part (`Roue_<n>`,
 * pivot sur l'axe — `preparer-vehicules.mjs`). Par défaut, `optimize`
 * fusionne les maillages (join) et aplatit la hiérarchie (flatten) : les
 * roues seraient recollées à la caisse et ne tourneraient plus.
 */
const HIERARCHIE_GARDEE = ['vehicules/niveaux/', 'vehicules/kart-race-pulse.glb']

/**
 * Roues du kart de départ, découpées à la préparation (même découpe que les
 * véhicules, `scripts/roues.mjs`) : axes et rayons des pneus, en mètres.
 */
const ROUES = new Map([['vehicules/kart-race-pulse.glb', { arriere: [-0.55, 0.165], avant: [0.575, 0.145] }]])

/**
 * Assets dont les matériaux doivent être forcés en face avant seule.
 *
 * Blender exporte `doubleSided: true` par défaut, ce qui désactive le
 * back-face culling — en passe couleur ET en passe d'ombre (three.js déduit
 * `shadowSide` de `side`). Pour un volume fermé, c'est le double du raster
 * et du fragment shading pour un résultat strictement identique : les faces
 * arrière sont de toute façon masquées par les faces avant.
 *
 * ⚠️ À n'appliquer qu'à des maillages FERMÉS. Sur une surface ouverte
 * (feuillage en carte plate, drapeau, tissu), le culling ouvrirait des
 * trous visibles selon l'angle. Le kart a été vérifié : ses huit parties
 * ont zéro arête de bord.
 */
const FACE_AVANT_SEULE = new Set(['vehicules/kart-race-pulse.glb'])

/**
 * Assets de grande étendue (une piste à l'échelle : 1 à 2 km). Deux réglages
 * par défaut de `optimize` y sont destructeurs, car leur tolérance est une
 * FRACTION de l'étendue du maillage :
 *  - la simplification déplace le relief de plusieurs mètres ;
 *  - la quantification Meshopt à 14 bits arrondit les positions à ~11 cm —
 *    le terrain, qui affleure la route, la perçait par plaques brunes.
 * On optimise donc sans simplifier ni compresser la géométrie, puis on la
 * compresse à part en Meshopt à 16 bits (~3 cm). Constat visuel, 19/10.
 */
//
// Le circuit « snoep » (29/10) : ~108 000 triangles et des textures
// natives de 1024 — ni simplification, ni réduction de texture : la carte
// reste aussi nette que la source (consigne). Seule la géométrie passe en
// Meshopt 16 bits (le modèle mis à l'échelle couvre ~1,6 km, ciel compris).
const GRANDE_ETENDUE = new Map([
  ['circuit/snoep-circuit.glb', { simplification: ['--simplify', 'false'], tailleTexture: '1024' }],
])

/**
 * Sources brutes consommées par un script de préparation, jamais optimisées
 * telles quelles (elles ne sont pas encore à l'échelle ni recentrées).
 */
const IGNORES = new Set([
  'circuit/candy-source.glb',
  // Anciennes pistes (forêt Fab, désert), retirées de l'application le 29/10 :
  // leurs sources peuvent encore traîner dans un `assets-source/` local.
  'circuit/drift-track.glb',
  'circuit/desert-circuit.glb',
  'circuit/desert race circuit 3d model.glb',
])
/** Idem, par dossier : les véhicules bruts (~55 Mo chacun, `preparer-vehicules.mjs`). */
const DOSSIERS_IGNORES = ['vehicules/bruts/']

/** `npx` est un script `.cmd` sous Windows : il faut passer par un shell. */
function npx(arguments_) {
  execFileSync('npx', arguments_, { stdio: 'inherit', shell: process.platform === 'win32' })
}

/**
 * Écrit une copie de `source` avec tous les matériaux en face avant seule,
 * et renvoie le chemin de cette copie (à passer à l'optimiseur à la place
 * de l'original).
 *
 * On agit AVANT `gltf-transform optimize`, pas après : réécrire le .glb
 * déjà optimisé le fait regrossir d'environ 9 % (le ré-encodage Meshopt de
 * NodeIO est moins serré que celui du CLI). En intervenant en amont, c'est
 * le CLI qui garde le dernier mot sur la compression.
 */
async function preparerFaceAvant(source, dossierTravail, roues) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    })

  const document = await io.read(source)
  let modifies = 0
  for (const materiau of document.getRoot().listMaterials()) {
    if (!materiau.getDoubleSided()) continue
    materiau.setDoubleSided(false)
    modifies += 1
  }

  // Roues mobiles : pièces à part, pivot sur l'axe.
  if (roues) extraireRoues(document, roues)

  const intermediaire = join(dossierTravail, 'face-avant.glb')
  await io.write(intermediaire, document)
  return { chemin: intermediaire, modifies }
}

function trouverModeles(dossier) {
  if (!existsSync(dossier)) return []
  const resultats = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) {
      resultats.push(...trouverModeles(chemin))
    } else if (EXTENSIONS.includes(chemin.slice(chemin.lastIndexOf('.')))) {
      resultats.push(chemin)
    }
  }
  return resultats
}

// `npm run assets:optimiser -- circuit/` : seulement les chemins qui
// commencent ainsi (sans quoi TOUT est ré-encodé, kart compris).
const filtres = process.argv.slice(2)
const modeles = trouverModeles(SOURCE).filter(
  (chemin) => filtres.length === 0 || filtres.some((f) => relative(SOURCE, chemin).split(sep).join('/').startsWith(f)),
)

if (modeles.length === 0) {
  console.log(
    `Aucun modèle trouvé dans ${relative(RACINE, SOURCE)}/. ` +
      `Placez-y les .glb/.gltf bruts (voir public/modeles/LICENCES.md) puis relancez ce script.`,
  )
  process.exit(0)
}

for (const chemin of modeles) {
  // Toujours des « / » : sous Windows, `relative` renvoie des « \ » et
  // AUCUNE des règles par asset (`SANS_PALETTE`…) ne correspondait — le
  // kart perdait le nom de sa `Carrosserie`, indispensable à la teinte par
  // agent (voir `SANS_PALETTE` plus haut).
  const relatif = relative(SOURCE, chemin).split(sep).join('/')
  if (IGNORES.has(relatif) || DOSSIERS_IGNORES.some((dossier) => relatif.startsWith(dossier))) {
    console.log(`→ ${relatif} : source brute, ignorée (voir IGNORES)`)
    continue
  }
  const cible = join(DESTINATION, relatif.replace(/\.gltf$/, '.glb'))
  mkdirSync(dirname(cible), { recursive: true })

  console.log(`→ ${relatif}`)

  let entree = chemin
  let dossierTravail = null
  if (FACE_AVANT_SEULE.has(relatif)) {
    dossierTravail = mkdtempSync(join(tmpdir(), 'race-pulse-assets-'))
    const { chemin: prepare, modifies } = await preparerFaceAvant(chemin, dossierTravail, ROUES.get(relatif))
    entree = prepare
    console.log(`  face avant seule : ${modifies} matériau(x) repassé(s) en single-sided`)
  }

  const arguments_ = [
    'gltf-transform',
    'optimize',
    entree,
    cible,
    '--texture-compress',
    'webp',
    '--texture-size',
    '1024',
  ]
  if (SANS_PALETTE.has(relatif)) arguments_.push('--palette', 'false')
  if (HIERARCHIE_GARDEE.some((dossier) => relatif.startsWith(dossier))) arguments_.push('--join', 'false', '--flatten', 'false')

  try {
    const etendue = GRANDE_ETENDUE.get(relatif)
    if (etendue) {
      dossierTravail ??= mkdtempSync(join(tmpdir(), 'race-pulse-assets-'))
      const intermediaire = join(dossierTravail, 'sans-compression.glb')
      arguments_[3] = intermediaire
      arguments_[arguments_.indexOf('--texture-size') + 1] = etendue.tailleTexture
      npx([...arguments_, ...etendue.simplification, '--compress', 'false'])
      npx(['gltf-transform', 'meshopt', intermediaire, cible, '--quantize-position', '16'])
      if (etendue.ensuite) {
        const [commande, ...argumentsEnsuite] = etendue.ensuite
        console.log(`  puis : ${etendue.ensuite.join(' ')}`)
        execFileSync(commande, argumentsEnsuite, { stdio: 'inherit', cwd: RACINE })
      }
    } else {
      npx(arguments_)
    }
  } finally {
    if (dossierTravail) rmSync(dossierTravail, { recursive: true, force: true })
  }
}

console.log(`\n${modeles.length} modèle(s) optimisé(s) vers ${relative(RACINE, DESTINATION)}/.`)
console.log("Pensez à consigner chaque nouvel asset dans public/modeles/LICENCES.md.")
