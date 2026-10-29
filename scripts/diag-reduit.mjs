// Diagnostic : le palier prefers-reduced-motion fige-t-il vraiment le
// rendu, ou y a-t-il une dérive continue ? On corrèle l'écart pixel avec
// le classement affiché (une mise à jour de données légitime peut
// déplacer un kart même en régime figé — ce n'est pas un bug).
import { chromium } from 'playwright'
import sharp from 'sharp'

const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1200, height: 800 } })
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.goto('http://localhost:5199/?sans-sentinelle', { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })

async function etat() {
  const scores = await page.locator('.classement__score').allTextContents()
  const canvas = await page.locator('canvas').screenshot()
  return { scores: scores.join(','), canvas }
}

async function diffPixels(a, b) {
  const imgA = sharp(a).ensureAlpha()
  const imgB = sharp(b).ensureAlpha()
  const [bufA, bufB] = await Promise.all([imgA.raw().toBuffer(), imgB.raw().toBuffer()])
  let diffPixelsCount = 0
  for (let i = 0; i < bufA.length; i += 4) {
    if (
      Math.abs(bufA[i] - bufB[i]) > 4 ||
      Math.abs(bufA[i + 1] - bufB[i + 1]) > 4 ||
      Math.abs(bufA[i + 2] - bufB[i + 2]) > 4
    ) {
      diffPixelsCount += 1
    }
  }
  const total = bufA.length / 4
  return { diffPixelsCount, total, pct: (diffPixelsCount / total) * 100 }
}

const mesures = []
for (let i = 0; i < 5; i += 1) {
  await page.waitForTimeout(2500)
  mesures.push(await etat())
}

for (let i = 1; i < mesures.length; i += 1) {
  const { diffPixelsCount, pct } = await diffPixels(mesures[i - 1].canvas, mesures[i].canvas)
  const scoresChanges = mesures[i - 1].scores !== mesures[i].scores
  console.log(
    `t${i - 1}→t${i} : ${diffPixelsCount} px différents (${pct.toFixed(3)}%) | classement changé = ${scoresChanges}`,
  )
}

await navigateur.close()
