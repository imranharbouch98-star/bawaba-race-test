import { chromium } from 'playwright'
const DOSSIER = process.argv[2]
const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1600, height: 1400 } })
await page.goto('http://localhost:5199/?sans-sentinelle', { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(3000)
const carte = page.locator('.reglages')
await carte.scrollIntoViewIfNeeded()
await carte.screenshot({ path: `${DOSSIER}/reglages.png` })
await navigateur.close()
console.log('ok')
