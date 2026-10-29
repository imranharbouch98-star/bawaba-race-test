// Validation des paliers de repli et de l'échelle de qualité v2.
//
// Attendu : serveur de dev déjà lancé sur http://localhost:5199.
//
// Palier 0 — WebGL2 indisponible  → écran de repli (le seul cas légitime
//            avec le contexte perdu).
// Palier 1 — prefers-reduced-motion → 3D figée (caméra/foule immobiles).
// Palier 2 — vraie lenteur (CPU ×20, frames erratiques) → l'échelle descend
//            jusqu'à « Minimale 3D » SANS JAMAIS afficher d'écran bloquant.
// Palier 3 — machine BRIDÉE (30 Hz stable simulé) → la sentinelle détecte le
//            plateau et NE DÉGRADE PAS.
import { chromium } from 'playwright'

const DOSSIER = process.argv[2]
const navigateur = await chromium.launch()

// --- Palier 0 : WebGL2 indisponible -----------------------------------
{
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 800 } })
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === 'webgl2') return null
      return null
    }
  })
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  const repli = await page.locator('.repli').count()
  const message = repli > 0 ? await page.locator('.repli__message').textContent() : null
  console.log(`Palier 0 (WebGL2 indispo) : écran de repli affiché = ${repli > 0}, message = "${message}"`)
  await page.screenshot({ path: `${DOSSIER}/palier0-webgl2.png` })
  await page.close()
}

// --- Palier 1 : prefers-reduced-motion --------------------------------
{
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 800 } })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://localhost:5199/?sans-sentinelle', { waitUntil: 'load' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(4000)
  const avant = await page.locator('canvas').screenshot()
  await page.waitForTimeout(4000)
  const apres = await page.locator('canvas').screenshot()
  const identique = Buffer.compare(avant, apres) === 0
  console.log(`Palier 1 (reduced-motion) : deux captures à 4s d'écart identiques (caméra/foule figées) = ${identique}`)
  await page.screenshot({ path: `${DOSSIER}/palier1-reduit.png` })
  await page.close()
}

// Libellé de qualité affiché dans le panneau de réglages (dev).
async function lireQualite(page) {
  const libelle = await page.locator('.reglages__qualite .reglages__libelle').textContent()
  return libelle?.replace('Kwaliteit:', '').trim() ?? '?'
}

// --- Palier 2 : vraie lenteur → descente jusqu'à « Minimale 3D » -------
{
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 800 } })
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 })

  let qualite = await lireQualite(page)
  let repliVu = false
  for (let i = 0; i < 20 && qualite !== 'Minimale 3D'; i += 1) {
    await page.waitForTimeout(6000)
    repliVu = repliVu || (await page.locator('.repli').count()) > 0
    qualite = await lireQualite(page)
  }
  const canvasPresent = (await page.locator('canvas').count()) > 0
  console.log(
    `Palier 2 (vraie lenteur, CPU ×20) : qualité finale = "${qualite}" ` +
      `(attendu "Minimale 3D"), écran bloquant vu = ${repliVu} (attendu false), ` +
      `canvas toujours rendu = ${canvasPresent}`,
  )
  await page.screenshot({ path: `${DOSSIER}/palier2-minimale.png` })
  await page.close()
}

// --- Palier 3 : machine bridée (30 Hz stable) → AUCUNE dégradation -----
{
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 800 } })
  // Simulation déterministe d'un écran 30 Hz : requestAnimationFrame cadencé
  // par setTimeout et performance.now() quantifié à 33,34 ms exactement —
  // temps de frame sous le seuil des 30 fps mais d'une régularité parfaite,
  // la signature d'un poste bridé et non d'un poste en difficulté.
  await page.addInitScript(() => {
    let horloge = 0
    performance.now = () => horloge
    window.requestAnimationFrame = (rappel) =>
      setTimeout(() => {
        horloge += 33.34
        rappel(horloge)
      }, 20)
    window.cancelAnimationFrame = (id) => clearTimeout(id)
  })
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  // Chauffe (8 s simulées) + bien plus que confirmation (5 s) + marge.
  await page.waitForTimeout(30000)
  const qualite = await lireQualite(page)
  console.log(
    `Palier 3 (plateau 30 Hz stable) : qualité = "${qualite}" (attendu "Volledig" — ` +
      `une machine bridée n'est pas dégradée)`,
  )
  await page.screenshot({ path: `${DOSSIER}/palier3-plateau.png` })
  await page.close()
}

await navigateur.close()
console.log('\nfini')
