// Phase 5 — proxy accéléré pour la tenue en fonctionnement continu (§ du
// plan). On ne peut pas faire tourner une vraie session de plusieurs heures
// ici : à la place, on stresse en quelques minutes les chemins les plus
// susceptibles de fuir (montage/démontage du kart invité — matériaux
// clonés, voir KartRacePulse.tsx —, boosts répétés, changements de
// période) et on surveille le tas JS après un GC forcé (CDP) à chaque
// cycle. Une croissance qui ne se stabilise jamais indique une fuite.
import { chromium } from 'playwright'

const CYCLES = Number(process.argv[2] ?? 24)
const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto('http://localhost:5199/?sans-sentinelle', { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })
await page.waitForTimeout(3000)

const cdp = await page.context().newCDPSession(page)
await cdp.send('HeapProfiler.enable')

const cliquer = (texte) =>
  page.evaluate((t) => {
    const boutons = [...document.querySelectorAll('button')]
    const b = boutons.find((x) => x.textContent.includes(t))
    if (b) b.click()
  }, texte)

const periodes = ['jour', 'semaine', 'mois']

async function mesurerTas() {
  await cdp.send('HeapProfiler.collectGarbage')
  // `performance.memory.usedJSHeapSize` est quantifié par Chromium (mesures
  // identiques constatées d'un cycle à l'autre, y compris sous charge
  // réelle) — `Runtime.getHeapUsage` (CDP) donne une valeur non lissée.
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  return usedSize
}

const mesures = []
for (let i = 0; i < CYCLES; i += 1) {
  // Kart invité : monte/démonte à chaque cycle — exerce le clonage et la
  // dispose des matériaux par kart.
  await cliquer('Mettre un kart invité en piste')
  await cliquer('Boost')
  await page.waitForTimeout(300)
  await cliquer('Boost')
  await page.waitForTimeout(600)
  await cliquer('Retirer le kart invité')

  // Changement de période — recalcule `construireClassement`.
  const libelle = { jour: 'Aujourd', semaine: 'Semaine', mois: 'Mois' }[periodes[i % 3]]
  await page.evaluate((texte) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(texte))
    if (b) b.click()
  }, libelle)

  await page.waitForTimeout(1500)
  const tas = await mesurerTas()
  const delta = mesures.length > 0 ? tas - mesures[mesures.length - 1] : 0
  mesures.push(tas)
  const signe = delta >= 0 ? '+' : ''
  console.log(
    `cycle ${i}: tas JS = ${(tas / 1024 / 1024).toFixed(2)} Mo (${signe}${(delta / 1024 / 1024).toFixed(2)})`,
  )
}

await navigateur.close()

const premierTiers = mesures.slice(0, Math.ceil(mesures.length / 3))
const dernierTiers = mesures.slice(-Math.ceil(mesures.length / 3))
const moyenne = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
const debut = moyenne(premierTiers)
const fin = moyenne(dernierTiers)
const croissance = ((fin - debut) / debut) * 100

console.log(
  `\nMoyenne 1er tiers : ${(debut / 1024 / 1024).toFixed(2)} Mo | ` +
    `Moyenne dernier tiers : ${(fin / 1024 / 1024).toFixed(2)} Mo | ` +
    `Croissance : ${croissance.toFixed(1)} %`,
)
