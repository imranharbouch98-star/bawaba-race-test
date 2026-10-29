// Série de captures pour attraper les différents plans du réalisateur.
import { chromium } from 'playwright'

const URL = 'http://localhost:5199/?sans-sentinelle'
const DOSSIER = process.argv[2]
const NOMBRE = 6
const INTERVALLE_MS = 7000

const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (erreur) => console.log('[pageerror]', erreur.message))
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(4000)
for (let index = 0; index < NOMBRE; index += 1) {
  await page.locator('canvas').screenshot({ path: `${DOSSIER}/plan-${index}.png` })
  console.log(`plan-${index}.png`)
  await page.waitForTimeout(INTERVALLE_MS)
}
await navigateur.close()
