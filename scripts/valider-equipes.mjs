// Validation du mode ÉQUIPES (payload /api/jeu/classement du dashboard).
//
// Attendu : serveur de dev lancé sur http://localhost:5198 AVEC la variable
//   VITE_RACE_PULSE_API_URL=/api/course/equipes npm run dev -- --port 5198
//
// Vérifie :
//  - 6 karts d'équipe sur la piste (un par équipe de la démo) ;
//  - le tour de chrono affiche des % de doel, jamais « achter »/« behind » ;
//  - le classement se déplie en détail d'équipe (KPI, agents, Penalty point) ;
//  - aucun affichage d'écart au meneur nulle part.
import { chromium } from 'playwright'

const DOSSIER = process.argv[2]
const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1400, height: 900 } })

await page.goto('http://localhost:5198/', { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 15000 })
// Le sondage API + le premier classement.
await page.waitForSelector('.classement__ligne', { timeout: 15000 })
await page.waitForTimeout(2500)

const lignes = await page.locator('.classement__ligne').count()
console.log(`Karts d'équipe au classement : ${lignes} (attendu 6)`)

const chrono = await page.locator('.chrono').textContent()
const chronoPourcent = /(AP|INGEPL|gespr|doss)/.test(chrono ?? '') // points depuis le 26/08
console.log(`Tour de chrono en % de doel : ${chronoPourcent} (attendu true)`)

const corps = await page.locator('body').textContent()
const ecartVisible = /achter\b|behind\b|Achterstand|Gap to/i.test(corps ?? '')
console.log(`Écart au meneur visible quelque part : ${ecartVisible} (attendu false)`)

// Déplier le détail de la première équipe (evaluate : un click() Playwright
// ferait défiler la page — gotcha n°5 du CLAUDE.md).
await page.locator('.classement__ligne').first().evaluate((el) => el.click())
await page.waitForTimeout(400)
const detail = await page.locator('.classement__detail').count()
const detailTexte = detail > 0 ? await page.locator('.classement__detail').textContent() : ''
const kpiVisible = /\/u|\/h|\/dag|\/day/.test(detailTexte ?? '')
console.log(`Détail d'équipe déplié : ${detail > 0}, unité KPI visible : ${kpiVisible}`)

// La démo sert une pénalité pour FC Leads : selon le tri du moment elle peut
// être sur une autre ligne — on cherche sur toutes les équipes.
let penaltyVisible = /Penalty point/.test(detailTexte ?? '')
if (!penaltyVisible) {
  const total = await page.locator('.classement__ligne').count()
  for (let i = 1; i < total && !penaltyVisible; i += 1) {
    await page.locator('.classement__ligne').nth(i).evaluate((el) => el.click())
    await page.waitForTimeout(300)
    const texte = (await page.locator('.classement__detail').textContent().catch(() => '')) ?? ''
    penaltyVisible = /Penalty point −1|Penalty point -1/.test(texte)
  }
}
console.log(`« Penalty point −1 » + raison affichés : ${penaltyVisible} (attendu true)`)

// Badge de rang sur les étiquettes 3D : le texte vit dans le canvas (troika),
// on vérifie la donnée à la source via le bandeau (« Elk team … doel »).
const bandeauRegle = /eigen doel|own goal/.test(corps ?? '')
console.log(`Bandeau « chacun son doel » : ${bandeauRegle} (attendu true)`)

await page.screenshot({ path: `${DOSSIER}/equipes-vue.png`, fullPage: false })
await page.close()
await navigateur.close()
console.log('\nfini')
