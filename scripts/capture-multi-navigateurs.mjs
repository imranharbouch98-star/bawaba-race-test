// Phase 5 — vérification WebGL2 sur les trois moteurs de rendu Playwright.
// But : confirmer que la scène 3D démarre (pas de repli intempestif),
// s'affiche (canvas non vide) et ne lève aucune erreur console — pas une
// parité pixel-perfect entre moteurs.
import { chromium, firefox, webkit } from 'playwright'
import sharp from 'sharp'

const DOSSIER = process.argv[2]
const MOTEURS = [
  { nom: 'chromium', lanceur: chromium },
  { nom: 'firefox', lanceur: firefox },
  { nom: 'webkit', lanceur: webkit },
]

for (const { nom, lanceur } of MOTEURS) {
  console.log(`\n=== ${nom} ===`)
  let navigateur
  try {
    navigateur = await lanceur.launch()
  } catch (e) {
    console.log(`échec lancement : ${e.message}`)
    continue
  }
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } })
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(`console.error: ${m.text()}`)
  })

  try {
    await page.goto('http://localhost:5199/?sans-sentinelle', { waitUntil: 'load', timeout: 20000 })
    await page.waitForSelector('canvas', { timeout: 15000 })
    await page.waitForTimeout(4000)

    const repli = await page.locator('.repli').count()
    const chemin = `${DOSSIER}/${nom}.png`
    await page.locator('canvas').screenshot({ path: chemin })

    const { channels } = await sharp(chemin).stats()
    const canvasVide = channels.every((c) => c.max === c.min)

    console.log(`repli affiché : ${repli > 0 ? 'OUI (inattendu)' : 'non'}`)
    console.log(`canvas uniforme (probablement vide) : ${canvasVide ? 'OUI (suspect)' : 'non'}`)
    console.log(`erreurs console/page : ${erreurs.length}`)
    erreurs.slice(0, 5).forEach((e) => console.log('  -', e))
  } catch (e) {
    console.log(`échec : ${e.message}`)
  }
  await navigateur.close()
}
