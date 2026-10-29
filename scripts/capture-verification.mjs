// Capture de vérification : karts glTF sur la piste (vue réalisateur normale).
import { chromium } from 'playwright'

const URL = 'http://localhost:5199/?sans-sentinelle'
const SORTIE = process.argv[2] ?? 'capture-karts.png'
const ATTENTE_MS = Number(process.argv[3] ?? 9000)

const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) console.log(`[console:${message.type()}]`, message.text())
})
page.on('pageerror', (erreur) => console.log('[pageerror]', erreur.message))

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })
// Laisse le simulateur avancer et le réalisateur cadrer.
await page.waitForTimeout(ATTENTE_MS)
await page.locator('canvas').screenshot({ path: SORTIE })
console.log('Capture écrite :', SORTIE)
await navigateur.close()
