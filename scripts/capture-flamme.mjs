// Vérification de la couleur/forme de la flamme de boost — kart invité,
// captures rapprochées et rapides pour maximiser les chances d'un plan
// caméra proche (le réalisateur ne suit pas le pilote invité).
import { chromium } from 'playwright'
const DOSSIER = process.argv[2]
const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5199/?sans-sentinelle', { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(5000)
const cliquer = (texte) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t))
    if (b) b.click()
  }, texte)
await cliquer('Mettre un kart invité en piste')
const entretien = setInterval(() => cliquer('Boost'), 500)
for (let index = 0; index < 6; index += 1) {
  await page.waitForTimeout(4000)
  await page.locator('canvas').screenshot({ path: `${DOSSIER}/flamme-${index}.png` })
}
clearInterval(entretien)
await navigateur.close()
console.log('fini')
