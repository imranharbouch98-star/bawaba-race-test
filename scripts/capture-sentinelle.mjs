// Vérification de la sentinelle : CPU bridé → paliers de dégradation
// successifs jusqu'à l'écran de repli.
import { chromium } from 'playwright'
const DOSSIER = process.argv[2]
const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5199/', { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })

const cdp = await page.context().newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 })
console.log('CPU bridé ×20')

for (let index = 0; index < 12; index += 1) {
  await page.waitForTimeout(6000)
  const repli = await page.locator('.repli').count()
  if (repli > 0) {
    await page.screenshot({ path: `${DOSSIER}/sentinelle-repli.png` })
    console.log(`Écran de repli atteint après ~${(index + 1) * 6} s`)
    break
  }
  await page.locator('canvas').screenshot({ path: `${DOSSIER}/sentinelle-${String(index).padStart(2, '0')}.png` })
  console.log(`sentinelle-${index} (canvas encore présent)`)
}
await navigateur.close()
