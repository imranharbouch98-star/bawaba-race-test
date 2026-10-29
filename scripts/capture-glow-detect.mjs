// Chasse au gros plan de boost : détecte automatiquement les frames où un
// halo cyan lumineux est visible (scan des pixels via un canvas 2D en page).
import { chromium } from 'playwright'
const DOSSIER = process.argv[2]
const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 } })
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

const scores = []
for (let index = 0; index < 40; index += 1) {
  await page.waitForTimeout(1000)
  const tampon = await page.locator('canvas').screenshot()
  const score = await page.evaluate(async (base64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const toile = document.createElement('canvas')
    toile.width = image.width / 2
    toile.height = image.height / 2
    const ctx = toile.getContext('2d')
    ctx.drawImage(image, 0, 0, toile.width, toile.height)
    const { data } = ctx.getImageData(0, 0, toile.width, toile.height)
    let compte = 0
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      // Cyan saturé et lumineux (halo de boost), pas le cyan mat des gradins.
      if (b > 225 && g > 200 && r < 160 && b + g - 2 * r > 140) compte += 1
    }
    return compte
  }, tampon.toString('base64'))
  scores.push({ index, score })
  if (score > 40) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(`${DOSSIER}/halo-${String(index).padStart(2, '0')}-s${score}.png`, tampon)
    console.log(`frame ${index} : score ${score} → sauvée`)
  }
}
clearInterval(entretien)
console.log('top5:', scores.sort((a, b) => b.score - a.score).slice(0, 5).map((s) => `#${s.index}:${s.score}`).join(' '))
await navigateur.close()
