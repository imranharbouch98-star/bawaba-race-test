// Vérification du layout responsive sur des tailles de viewport tablette.
import { chromium } from 'playwright'
const DOSSIER = process.argv[2]
const navigateur = await chromium.launch()

const tailles = [
  { nom: 'tablette-portrait', width: 768, height: 1024 },
  { nom: 'tablette-paysage', width: 1024, height: 768 },
  { nom: 'tablette-large-paysage', width: 1180, height: 820 },
]

for (const { nom, width, height } of tailles) {
  const page = await navigateur.newPage({ viewport: { width, height } })
  page.on('pageerror', (e) => console.log('[pageerror]', nom, e.message))
  await page.goto('http://localhost:5199/?sans-sentinelle', { waitUntil: 'load' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${DOSSIER}/${nom}.png`, fullPage: true })
  console.log(nom, 'ok')
  await page.close()
}
await navigateur.close()
