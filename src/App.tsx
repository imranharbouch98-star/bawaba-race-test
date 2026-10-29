/**
 * Race Pulse 3D — assemblage de la page unique.
 *
 * Phases 1 à 3 du plan : piste, stade (tribunes, foule, signalétique),
 * karts placeholder, branchés sur le vrai simulateur, filmés par le
 * réalisateur de caméra automatique (`camera/RealisateurCamera.ts`) — plus
 * d'orbite manuelle : c'est la mise en scène qui pilote la caméra, comme
 * prévu pour un écran de centre d'appels qui tourne sans intervention. Ce
 * composant ne contient aucune règle de calcul de score.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Realisateur } from './camera/RealisateurCamera'
import { Classement } from './components/Classement'
import { EcranRepli } from './components/EcranRepli'
import { Entete, type Onglet } from './components/Entete'
import { Winkel } from './components/Winkel'
import { Explications } from './components/Explications'
import { FilEvenements } from './components/FilEvenements'
import { PanneauCommandes } from './components/PanneauCommandes'
import { PanneauReglages } from './components/PanneauReglages'
import { Podium } from './components/Podium'
import { BandeauDernierTour } from './components/BandeauDernierTour'
import { SelecteurPeriode } from './components/SelecteurPeriode'
import { TourChrono } from './components/TourChrono'
import { Celebration, type CelebrationAffichee } from './components/Celebration'
import { creerSourceDonnees } from './data'
import { construireClassement, formaterScore } from './domain/classement'
import { comparer, photographier, type PhotoCourse } from './domain/chronique'
import { PERIODES, type EvenementCourse, type KpiEquipe, type Periode, type VueMur } from './domain/types'
import { useTextes } from './i18n/LangueContexte'
import { useAnimationReduite } from './hooks/useAnimationReduite'
import { useInstantane } from './hooks/useInstantane'
import { useCycleJour } from './hooks/useCycleJour'
import { useVariationsRang } from './hooks/useVariationsRang'
import { usePiloteInvite } from './hooks/usePiloteInvite'
import { usePortefeuille } from './hooks/usePortefeuille'
import { vehiculeChoisi } from './domain/portefeuille'
import { webgl2Disponible } from './perf/detectionWebGL2'
import { MoniteurPerformance3D } from './perf/MoniteurPerformance3D'
import { SurveillanceContexte } from './perf/SurveillanceContexte'
import {
  MESURE_PERFORMANCE_INITIALE,
  type MesurePerformance3D,
} from './perf/metriques3d'
import {
  NIVEAU_MAXIMAL,
  NIVEAUX_QUALITE,
  SentinellePerformance,
  type NiveauQualite,
} from './perf/SentinellePerformance'
import { soleilAHeure } from './scene/cycleJour'
import { Decor3D } from './scene/Decor3D'
import {
  MODE_ETIQUETTES_DEFAUT,
  type ModeEtiquettes,
} from './scene/modeEtiquettes'
import { Circuit3D, type EtatKart } from './scene/Circuit3D'
import { PISTE_PAR_DEFAUT, PISTES } from './domain/circuit3d'
import { PostTraitement } from './scene/PostTraitement'

/** Mêmes réglages de traînée de boost que la 2D (`race-pulse/src/App.tsx`). */
const SEUIL_BOOST = 14
const DUREE_TRAINEE = 2600
const AUCUN_BOOST: ReadonlySet<string> = new Set()

function lireEffectifInitial(): number {
  const valeur = Number(new URLSearchParams(window.location.search).get('agents'))
  return valeur === 10 || valeur === 20 || valeur === 30 ? valeur : 30
}

/**
 * Les panneaux de mise au point (faits de course, commandes du kart invité,
 * test de charge, explications) sont des outils de développement, pas de
 * l'affichage mural : en production ils n'apparaissent que si le poste porte
 * `localStorage.show = 'true'` — la trappe d'inspection d'un kiosque, posée
 * une fois dans la console du navigateur. En développement ils restent
 * toujours visibles.
 */
function lireComplementsVisibles(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return window.localStorage.getItem('show') === 'true'
  } catch {
    return false
  }
}

/**
 * « Vue simple » : caméra fixe en plan d'ensemble, foule/nuages figés, sans
 * post-traitement ni flammes — mais les karts continuent de ROULER vers les
 * données (contrairement à `prefers-reduced-motion`, qui les place d'un
 * coup). Un choix de poste, mémorisé comme la langue.
 */
const CLE_VUE_SIMPLE = 'race-pulse:vue-simple'

function lireVueSimple(): boolean {
  try {
    return window.localStorage.getItem(CLE_VUE_SIMPLE) === 'true'
  } catch {
    return false
  }
}

/**
 * Résolution de rendu, figée à 1 par défaut.
 *
 * L'ancien `dpr={[1, 1.75]}` suivait le `devicePixelRatio` du poste : une
 * mise à l'échelle Windows à 150 % ou un zoom navigateur à 125 % faisaient
 * calculer 2,25 fois plus de pixels, et jusqu'à 3 fois au plafond. Sur un
 * kiosque dont on ne maîtrise pas les réglages d'affichage, c'est le
 * paramètre le plus asymétrique du projet : le même code passe de fluide à
 * injouable selon une case cochée dans les préférences système, et comme la
 * sentinelle ne fait que dégrader, le poste finit sur l'écran de repli sans
 * que personne ne comprenne pourquoi.
 *
 * `?dpr=` permet de remonter la finesse sur un poste qu'on sait costaud
 * (écran 4K avec GPU dédié, captures de présentation).
 */
function lireResolutionInitiale(): number {
  const valeur = Number(new URLSearchParams(window.location.search).get('dpr'))
  return Number.isFinite(valeur) && valeur > 0 ? Math.min(2, Math.max(0.5, valeur)) : 1
}

/**
 * Facteur de résolution par palier de qualité : le nombre de pixels calculés
 * varie comme le carré de cette valeur, c'est la première économie à faire
 * sur un GPU intégré — avant même de retirer des objets de la scène.
 */
const FACTEURS_DPR = [1, 0.9, 0.85, 0.75, 0.7] as const

/**
 * Remontage périodique de la scène 3D (demande du 29/10 : sur l'écran mural,
 * l'affichage finissait par se bloquer). Toutes les 5 minutes, le `<Canvas>`
 * est reconstruit — contexte WebGL, piste, karts, caméra — alors que tout ce
 * qui compte vit AU-DESSUS de lui dans App : données, positions affichées des
 * karts (`positionsKarts`), palier de qualité, boutique. Les karts
 * réapparaissent donc exactement là où ils étaient.
 *
 * `?remontage=<secondes>` change l'intervalle (diagnostic, tests).
 */
function lireIntervalleRemontage(): number {
  const secondes = Number(new URLSearchParams(window.location.search).get('remontage'))
  return (Number.isFinite(secondes) && secondes >= 5 ? secondes : 5 * 60) * 1000
}

/**
 * Une perte du contexte GPU déclenche le même remontage, plutôt que l'écran
 * de repli — au plus PERTES_MAX fois entre deux remontages périodiques ; au-delà,
 * la machine ne tient vraiment pas la 3D et l'écran de repli s'affiche.
 */
const PERTES_MAX = 3

/** Durée maximale du suivi d'un kart choisi dans la liste. */
const DUREE_SUIVI_MS = 60_000

/** L'heure solaire de chaque ambiance de page (le cycle existant fait le reste). */
const HEURES_AMBIANCE = { ochtend: 9.5, zonsondergang: 20.75, nacht: 23.5 } as const

export default function App() {
  const textes = useTextes()

  // Vérifié une seule fois : la disponibilité de WebGL2 ne change pas en
  // cours de session (voir §5 du plan, palier 0 de repli).
  const [webgl2] = useState(webgl2Disponible)
  const [complementsVisibles] = useState(lireComplementsVisibles)
  const [vueSimple, setVueSimple] = useState(lireVueSimple)
  const basculerVueSimple = useCallback(() => {
    setVueSimple((actuelle) => {
      try {
        window.localStorage.setItem(CLE_VUE_SIMPLE, String(!actuelle))
      } catch {
        // Stockage indisponible (navigation privée) : le choix vaut pour la session.
      }
      return !actuelle
    })
  }, [])
  // Une seule piste depuis le 29/10 (le circuit de bonbons).
  const piste = PISTES[PISTE_PAR_DEFAUT]

  const [nombreAgents, setNombreAgents] = useState(lireEffectifInitial)
  const [resolution] = useState(lireResolutionInitiale)
  const [contextePerdu, setContextePerdu] = useState(false)
  const [panneauReduit, setPanneauReduit] = useState(false)
  const [modeEtiquettes, setModeEtiquettes] = useState<ModeEtiquettes>(MODE_ETIQUETTES_DEFAUT)
  const [generationScene, setGenerationScene] = useState(0)
  const pertesContexte = useRef(0)
  useEffect(() => {
    const minuterie = window.setInterval(() => {
      pertesContexte.current = 0
      setGenerationScene((generation) => generation + 1)
    }, lireIntervalleRemontage())
    return () => window.clearInterval(minuterie)
  }, [])
  const signalerContextePerdu = useCallback(() => {
    pertesContexte.current += 1
    if (pertesContexte.current > PERTES_MAX) setContextePerdu(true)
    else setGenerationScene((generation) => generation + 1)
  }, [])
  const source = useMemo(() => creerSourceDonnees(nombreAgents), [nombreAgents])
  const instantane = useInstantane(source)
  // Pièces des agents : créditées à chaque fin de journée, que la boutique
  // soit ouverte ou non — d'où un hook au niveau de l'application.
  const portefeuille = usePortefeuille(instantane)
  const [onglet, setOnglet] = useState<Onglet>('doelen')
  const animationReduite = useAnimationReduite()
  // Le décor et la caméra se figent aussi en vue simple ; les KARTS, eux,
  // ne suivent que `animationReduite` — en vue simple ils roulent toujours.
  const decorFige = animationReduite || vueSimple
  const pilote = usePiloteInvite()
  // Positions AFFICHÉES des karts (ils roulent vers les données) : écrites
  // par `Circuit3D` à chaque image, lues par la caméra pour les filmer là où
  // ils sont réellement dessinés.
  const positionsKarts = useRef(new Map<string, EtatKart>())

  const [periode, setPeriode] = useState<Periode>('jour')
  const [boosts, setBoosts] = useState<ReadonlySet<string>>(AUCUN_BOOST)

  // Le carrousel du mur (0016) : les pages actives défilent, chacune avec sa
  // course, sa fenêtre et son ambiance. Sans page : l'écran historique.
  const [vueIndex, setVueIndex] = useState(0)
  const vues = instantane?.vues
  const vueActive: VueMur | null = vues && vues.length > 0 ? vues[vueIndex % vues.length] : null
  const affiche = vueActive?.instantane ?? instantane
  const periodeEffective: Periode = vueActive ? 'jour' : periode

  useEffect(() => {
    if (!vues || vues.length < 2) return
    const duree = Math.max(5, vues[vueIndex % vues.length].dwellSec) * 1000
    const minuteur = setTimeout(() => setVueIndex((i) => (i + 1) % vues.length), duree)
    return () => clearTimeout(minuteur)
  }, [vues, vueIndex])

  useEffect(() => {
    if (!vues || vues.length < 2) return
    const gerer = (evenement: KeyboardEvent) => {
      if (pilote.actif) return // les flèches pilotent alors le kart invité
      if (evenement.key === 'ArrowRight') setVueIndex((i) => (i + 1) % vues.length)
      if (evenement.key === 'ArrowLeft') setVueIndex((i) => (i - 1 + vues.length) % vues.length)
    }
    window.addEventListener('keydown', gerer)
    return () => window.removeEventListener('keydown', gerer)
  }, [vues, pilote.actif])

  // Palier de qualité courant, piloté par la sentinelle de performance :
  // ne fait que monter, jamais redescendre — un poste qui a ramé une fois
  // ramera de nouveau au même niveau de détail. L'échelle se termine en
  // « 3D minimale » (piste + karts, stade coupé), JAMAIS sur un écran
  // bloquant : l'écran de repli ne subsiste que pour WebGL2 absent ou
  // contexte GPU perdu. `?sans-sentinelle` neutralise la surveillance
  // (diagnostic kiosque, captures de test sur rendu logiciel).
  const [sentinelleActive, setSentinelleActive] = useState(
    () => !new URLSearchParams(window.location.search).has('sans-sentinelle'),
  )
  const [niveauQualite, setNiveauQualite] = useState<NiveauQualite>(NIVEAUX_QUALITE.complet)
  const [mesurePerformance, setMesurePerformance] = useState<MesurePerformance3D>(
    MESURE_PERFORMANCE_INITIALE,
  )
  // Palier « 3D minimale » : la piste Fab (~220 000 triangles) cède la place
  // au ruban procédural le long du même tracé.
  const pisteDetaillee = niveauQualite < NIVEAUX_QUALITE.minimal
  const degraderQualite = () =>
    setNiveauQualite((niveau) => Math.min(niveau + 1, NIVEAU_MAXIMAL) as NiveauQualite)

  const changerNombreAgents = useCallback((effectif: number) => {
    setNombreAgents(effectif)
    setNiveauQualite(NIVEAUX_QUALITE.complet)
    const url = new URL(window.location.href)
    url.searchParams.set('agents', String(effectif))
    window.history.replaceState(null, '', url)
  }, [])

  const lignes = useMemo(
    () => (affiche ? construireClassement(affiche, periodeEffective) : []),
    [affiche, periodeEffective],
  )

  const variationsRang = useVariationsRang(lignes, periodeEffective)

  // Le véhicule que chaque agent a choisi au garage roule sur la piste.
  const vehiculesAgents = useMemo(
    () => new Map(lignes.map((ligne) => [ligne.agent.id, vehiculeChoisi(portefeuille.etat, ligne.agent.id)])),
    [lignes, portefeuille.etat],
  )

  // Kart choisi d'un clic dans la liste : la caméra le suit en vue normale ;
  // en vue simple (caméra fixe), sa plaque ressort. Un second clic, Esc ou
  // ✕ le relâchent — et au bout d'une minute il se relâche tout seul, pour
  // qu'un écran mural ne reste jamais coincé sur un seul kart.
  const [agentChoisi, setAgentChoisi] = useState<string | null>(null)
  const choisirAgent = useCallback(
    (agentId: string) => setAgentChoisi((actuel) => (actuel === agentId ? null : agentId)),
    [],
  )
  useEffect(() => {
    if (!agentChoisi) return
    const minuteur = setTimeout(() => setAgentChoisi(null), DUREE_SUIVI_MS)
    return () => clearTimeout(minuteur)
  }, [agentChoisi])
  useEffect(() => {
    if (!agentChoisi) return
    const gerer = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') setAgentChoisi(null)
    }
    window.addEventListener('keydown', gerer)
    return () => window.removeEventListener('keydown', gerer)
  }, [agentChoisi])
  // Un kart qui n'est plus en piste (changement de page du carrousel,
  // d'effectif) ne peut plus être suivi.
  const selection = agentChoisi && lignes.some((ligne) => ligne.agent.id === agentChoisi) ? agentChoisi : null
  const cycleJour = useCycleJour()

  // Le chroniqueur : les données réelles n'apportent aucun événement — on
  // les FABRIQUE en comparant deux photos successives du classement (par
  // page du carrousel), et le réalisateur retrouve ses plans spot/podium.
  const contexteId = vueActive?.id ?? 'base'
  const photosRef = useRef(new Map<string, PhotoCourse>())
  const [evenementsDerives, setEvenementsDerives] = useState<EvenementCourse[]>([])
  const [boostsDerives, setBoostsDerives] = useState<ReadonlySet<string>>(AUCUN_BOOST)
  const fileFetesRef = useRef<CelebrationAffichee[]>([])
  const [fete, setFete] = useState<CelebrationAffichee | null>(null)

  useEffect(() => {
    if (!affiche || affiche.source !== 'api' || lignes.length === 0) return

    // La production brute et l'unité de chaque kart (quand on les connaît).
    const bruts = new Map<string, number>()
    const kpis = new Map<string, KpiEquipe>()
    const unitesJour = new Map<string, boolean>()
    for (const equipe of affiche.equipes ?? []) {
      const mesure = equipe.periodes[periodeEffective]
      if (affiche.modeKart === 'agent' || vueActive) {
        for (const a of mesure.agents) {
          const id = vueActive ? a.id : `${equipe.id}:${a.id}`
          bruts.set(id, a.brut)
          kpis.set(id, equipe.kpi)
          if (equipe.goalUnit === 'per_day') unitesJour.set(id, true)
        }
      } else {
        bruts.set(equipe.id, mesure.brut)
        kpis.set(equipe.id, equipe.kpi)
        if (equipe.goalUnit === 'per_day') unitesJour.set(equipe.id, true)
      }
    }

    const photo = photographier(lignes, bruts)
    const avant = photosRef.current.get(contexteId)
    photosRef.current.set(contexteId, photo)
    if (!avant) return
    const faits = comparer(avant, photo)
    if (faits.length === 0) return

    const maintenant = Date.now()
    const message = (f: (typeof faits)[number]): string =>
      f.type === 'depassement' ? textes.chronDepassement(f.nom, f.valeur)
      : f.type === 'objectif' ? textes.chronObjectif(f.nom)
      : f.type === 'record' ? textes.chronRecord(f.nom)
      : textes.chronBoost(f.nom)
    setEvenementsDerives((anciens) => [
      ...faits.map((f, index) => ({
        id: `${f.type}-${f.agentId}-${maintenant}-${index}`,
        horodatage: maintenant,
        type: f.type,
        message: message(f),
        agentId: f.agentId,
      })),
      ...anciens,
    ].slice(0, 20))

    const enBoost = faits.filter((f) => f.type === 'boost').map((f) => f.agentId)
    if (enBoost.length > 0) {
      setBoostsDerives(new Set(enBoost))
      setTimeout(() => setBoostsDerives(AUCUN_BOOST), DUREE_TRAINEE)
    }

    // Les célébrations : l'objectif toujours, la production qui grimpe
    // seulement quand elle se COMPTE (jamais les appels bruts).
    const couleurDe = new Map(affiche.agents.map((a) => [a.id, a.couleur]))
    for (const f of faits) {
      if (f.type === 'objectif') {
        fileFetesRef.current.push({ genre: 'objectif', titre: f.nom, sousTitre: textes.celebrationDoel, couleur: couleurDe.get(f.agentId) ?? '#ffc93c' })
      } else if (f.type === 'boost' && f.valeur >= 1 && kpis.get(f.agentId) !== 'calls_per_hour') {
        fileFetesRef.current.push({
          genre: 'scorePlus', titre: f.nom,
          sousTitre: textes.celebrationPlus(f.valeur, (unitesJour.get(f.agentId) ? textes.unitesCourtesJour : textes.unitesCourtes)[kpis.get(f.agentId) ?? 'ss_per_hour']),
          couleur: couleurDe.get(f.agentId) ?? '#ffc93c',
        })
      }
    }
    fileFetesRef.current = fileFetesRef.current.slice(-6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, contexteId])

  // Une fête à la fois ; la suivante attend la fin de la précédente.
  useEffect(() => {
    if (fete || fileFetesRef.current.length === 0) return
    setFete(fileFetesRef.current.shift() ?? null)
  }, [fete, evenementsDerives])
  useEffect(() => {
    if (!fete) return
    const minuteur = setTimeout(() => setFete(null), fete.genre === 'objectif' ? 4000 : 2600)
    return () => clearTimeout(minuteur)
  }, [fete])

  // (L'avancement COLLECTIF qui remplissait les gradins a disparu avec le
  // stade — voir le rendu plus bas. À reprendre si les tribunes reviennent.)

  // Traînées de boost : allumées le temps d'une mise à jour pour les agents
  // qui accélèrent nettement — même logique décorative que la 2D. En 3D
  // elles pilotent l'émissif des karts, capté par le bloom.
  useEffect(() => {
    if (!instantane || animationReduite) {
      setBoosts(AUCUN_BOOST)
      return
    }

    const accelerent = (vueActive?.instantane ?? instantane).performances
      .filter((performance) => performance.tendances[periode] > SEUIL_BOOST)
      .map((performance) => performance.agentId)

    if (accelerent.length === 0) {
      setBoosts(AUCUN_BOOST)
      return
    }

    setBoosts(new Set(accelerent))
    const minuteur = setTimeout(() => setBoosts(AUCUN_BOOST), DUREE_TRAINEE)
    return () => clearTimeout(minuteur)
  }, [instantane, periode, animationReduite])

  if (!webgl2) {
    return <EcranRepli raison="webgl2-indisponible" />
  }

  if (contextePerdu) {
    return <EcranRepli raison="contexte-perdu" />
  }

  if (!instantane) {
    return (
      <div className="chargement" role="status">
        <span className="chargement__pouls" aria-hidden="true" />
        {textes.chargement}
      </div>
    )
  }

  // L'API répond mais rien ne court encore (aucune équipe active composée
  // dans /admin/game) : on l'explique au lieu de montrer une piste déserte —
  // le sondage continue, l'écran démarre tout seul dès la première équipe.
  if (instantane.source === 'api' && instantane.agents.length === 0) {
    return (
      <div className="repli" role="status">
        <span className="repli__logo" aria-hidden="true">
          <span className="repli__logo-pouls" />
        </span>
        <h1 className="repli__titre">{textes.attenteTitre}</h1>
        <p className="repli__message">{textes.attenteMessage}</p>
      </div>
    )
  }

  const objectif = (vueActive?.instantane ?? instantane).objectifs[periodeEffective]
  const estEquipes = (vueActive?.instantane ?? instantane).equipes !== undefined
  const courant = vueActive?.instantane ?? instantane
  const leader = lignes[0]

  // Le libellé de période d'une page : le préréglage dans la langue, ou les
  // dates elles-mêmes pour une fenêtre libre.
  const libelleVue = (v: VueMur): string =>
    v.periode === 'vandaag' ? textes.periodes.jour
    : v.periode === 'deze_week' ? textes.periodes.semaine
    : v.periode === 'deze_maand' ? textes.periodes.mois
    : `${v.du} → ${v.au}`

  // Le chiffre affiché sur chaque ligne : le TAUX dans l'unité du KPI
  // (« 2.1 AP/u » — la notation de la feuille de Maya, 26/08). La position
  // du kart reste pilotée par le ratio vers l'objectif ; seul l'affichage
  // parle en points.
  const valeurs = (() => {
    if (!courant.equipes) return undefined
    const carte = new Map<string, string>()
    for (const equipe of courant.equipes) {
      // Objectif journalier : le chiffre est un COMPTE (« 23 AP »), pas un
      // rendement horaire — la notation de l'ancien salesdash de Maya.
      const parJour = equipe.goalUnit === 'per_day'
      const libelle = (kpi: KpiEquipe, taux: number) =>
        parJour ? `${Math.round(taux * 10) / 10} ${textes.unitesCourtesJour[kpi]}` : `${taux.toFixed(1)} ${textes.unitesCourtes[kpi]}`
      if (courant.modeKart === 'agent') {
        for (const p of PERIODES) {
          for (const a of equipe.periodes[p].agents) {
            // Dans une vue, l'id du kart est l'id BRUT de l'agent (pas
            // préfixé par l'équipe) — les deux formes sont couvertes.
            for (const id of vueActive ? [a.id] : [`${equipe.id}:${a.id}`]) {
              if (p === periodeEffective || !carte.has(id)) {
                carte.set(id, libelle(equipe.kpi, p === periodeEffective ? a.taux : 0))
              }
            }
          }
        }
      } else {
        carte.set(equipe.id, libelle(equipe.kpi, equipe.periodes[periodeEffective].taux))
      }
    }
    return carte
  })()
  // Plus de notion d'« arrivée » depuis le passage aux tours : on compte les
  // agents qui ont bouclé au moins un tour, c'est-à-dire atteint l'objectif.
  const objectifAtteint = lignes.filter((ligne) => ligne.tours >= 1).length

  return (
    <div className="application">
      {/* L'écran mural : en-tête + piste + panneau tiennent pile dans la hauteur
          de la fenêtre (voir `.ecran` dans index.css) ; les compléments de
          développement et le pied restent en dessous, hors de l'écran. */}
      <div className="ecran">
        <Entete
          miseAJour={instantane.miseAJour}
          simulation={instantane.source === 'simulation'}
          onRafraichir={() => source.rafraichir()}
          vueSimple={vueSimple}
          onBasculerVueSimple={basculerVueSimple}
          onglet={onglet}
          onChangerOnglet={setOnglet}
        />

        {onglet === 'winkel' && <Winkel portefeuille={portefeuille} />}

        {/* La scène reste MONTÉE pendant la boutique (pas de rechargement des
            modèles au retour) mais cachée et sans boucle de rendu : la
            boutique ne coûte rien au GPU. */}
        <main
          className={`scene${panneauReduit ? ' scene--plein' : ''}${onglet === 'winkel' ? ' scene--masquee' : ''}`}
        >
          <section className="scene__piste" aria-label={textes.ariaPiste}>
            <div className="scene__vue">
              <Canvas
                // Nouvelle génération = scène reconstruite (voir `lireIntervalleRemontage`).
                key={generationScene}
                frameloop={onglet === 'winkel' ? 'never' : 'always'}
                shadows="basic"
                // Pas de tone mapping ACES : avec le post-traitement, la scène
                // est rendue dans une cible intermédiaire où three.js ne
                // l'applique de toute façon pas. Sans lui (vue simple, paliers
                // dégradés), ACES s'appliquait — image ~35 % plus sombre et
                // terne que la vue normale (mesuré, 19/10). `flat` aligne les
                // deux rendus sur celui que l'on voit en vue normale.
                flat
                // Piste Fab de ~1,6 km : le plan aérien recule jusqu'à ~500 m
                // (l'ancien `far` de 600 coupait le bout du circuit).
                camera={{ position: [0, 200, 400], fov: 48, near: 0.5, far: 3000 }}
                dpr={resolution * FACTEURS_DPR[niveauQualite]}
              >
                <Decor3D
                  animationReduite={decorFige}
                  ombresActives={niveauQualite < NIVEAUX_QUALITE.sansOmbres}
                  soleil={vueActive ? soleilAHeure(HEURES_AMBIANCE[vueActive.ambiance]) : cycleJour.soleil}
                  solProcedural={!pisteDetaillee}
                />
                {/* Plus de stade (tribunes, foule, signalétique) : conçu le
                    long de l'ancien ovale, il se superposerait à la piste Fab
                    — qui apporte ses propres rails, grillages et arbres. Le
                    code reste dans `scene/stade/` pour un futur replacement. */}
                {/* Le kart et la piste glTF suspendent au premier chargement
                    (useGLTF) ; le ciel s'affiche sans attendre. */}
                <Suspense fallback={null}>
                  <Circuit3D
                    lignes={lignes}
                    animationReduite={animationReduite}
                    boosts={boostsDerives.size > 0 ? new Set([...boosts, ...boostsDerives]) : boosts}
                    flammesActives={!vueSimple && niveauQualite < NIVEAUX_QUALITE.sansPostTraitement}
                    modeEtiquettes={modeEtiquettes}
                    piloteActif={pilote.actif}
                    piloteBoost={pilote.boostActif}
                    commandePilote={pilote.commande}
                    positionsKarts={positionsKarts}
                    selection={selection}
                    pisteDetaillee={pisteDetaillee}
                    piste={piste}
                    vehicules={vehiculesAgents}
                  />
                </Suspense>
                <PostTraitement
                  actif={!vueSimple && niveauQualite < NIVEAUX_QUALITE.sansPostTraitement}
                  animationReduite={decorFige}
                />
                <SurveillanceContexte onPerte={signalerContextePerdu} />
                <MoniteurPerformance3D onMesure={setMesurePerformance} />
                {sentinelleActive && (
                  <SentinellePerformance niveau={niveauQualite} onDegrader={degraderQualite} />
                )}
                <Realisateur
                  lignes={lignes}
                  evenements={courant.source === 'api' ? evenementsDerives : courant.evenements}
                  periode={periodeEffective}
                  animationReduite={decorFige}
                  positionsKarts={positionsKarts}
                  agentSuivi={decorFige ? null : selection}
                  piste={piste}
                />
              </Canvas>

              <TourChrono
                lignes={lignes}
                variations={variationsRang}
                valeurs={valeurs}
                selection={selection}
                onChoisir={choisirAgent}
              />

              {/* Vue normale : la caméra suit le kart choisi — on le dit, et
                  on montre comment revenir aux plans du réalisateur. */}
              {selection && !decorFige && (
                <div className="suivi-badge" role="status">
                  <span>
                    {textes.suiviEnCours}{' '}
                    <strong>{lignes.find((ligne) => ligne.agent.id === selection)?.agent.nom}</strong>
                  </span>
                  <button
                    type="button"
                    className="suivi-badge__fermer"
                    aria-label={textes.arreterSuivi}
                    title={textes.arreterSuivi}
                    onClick={() => setAgentChoisi(null)}
                  >
                    ✕
                  </button>
                </div>
              )}
              <Celebration fete={fete} />

              {/* Le titre de la page, aux couleurs de SA course : l'identité
                  de l'équipe saute aux yeux d'une page à l'autre. */}
              {vueActive && (
                <div className="vue-bandeau" style={{ borderColor: vueActive.instantane.equipes?.[0]?.couleur }}>
                  <p className="vue-bandeau__nom">
                    <span className="vue-bandeau__pastille" style={{ backgroundColor: vueActive.instantane.equipes?.[0]?.couleur }} aria-hidden />
                    {vueActive.nom}
                  </p>
                  <p className="vue-bandeau__periode">{libelleVue(vueActive)}</p>
                </div>
              )}
              {vues && vues.length > 1 && (
                <div className="vue-nav">
                  <button type="button" aria-label={textes.pagePrecedente}
                    onClick={() => setVueIndex((i) => (i - 1 + vues.length) % vues.length)}>‹</button>
                  <span className="vue-points" aria-hidden>
                    {vues.map((v, i) => (
                      <span key={v.id} className={i === vueIndex % vues.length ? 'est-active' : ''}
                        style={{ backgroundColor: v.instantane.equipes?.[0]?.couleur }} />
                    ))}
                  </span>
                  <button type="button" aria-label={textes.pageSuivante}
                    onClick={() => setVueIndex((i) => (i + 1) % vues.length)}>›</button>
                </div>
              )}
              <BandeauDernierTour journee={cycleJour.journee} />

              <button
                type="button"
                className={`bouton-vue${panneauReduit ? ' bouton-vue--replie' : ''}`}
                onClick={() => setPanneauReduit((reduit) => !reduit)}
                aria-pressed={panneauReduit}
                aria-label={panneauReduit ? textes.afficherPanneau : textes.masquerPanneau}
              >
                <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true">
                  <path
                    d="M6 3l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="bandeau">
              <div className="bandeau__bloc">
                <span className="bandeau__etiquette">{textes.bandeauPeriode}</span>
                <strong>{vueActive ? libelleVue(vueActive) : textes.periodes[periode]}</strong>
              </div>
              <div className="bandeau__bloc">
                <span className="bandeau__etiquette">{textes.bandeauObjectif}</span>
                {/* En mode équipes, chaque kart court vers SON objectif : un
                    chiffre unique ici serait un non-sens (et un classement
                    déguisé). On énonce la règle à la place. */}
                <strong>
                  {estEquipes ? textes.chacunSonDoel : textes.pts(formaterScore(objectif), objectif)}
                </strong>
              </div>
              <div className="bandeau__bloc">
                <span className="bandeau__etiquette">{textes.bandeauEnTete}</span>
                <strong style={{ color: leader?.agent.couleur }}>{leader?.agent.nom ?? '—'}</strong>
              </div>
              <div className="bandeau__bloc">
                <span className="bandeau__etiquette">{textes.bandeauObjectifAtteint}</span>
                <strong>
                  {objectifAtteint} / {lignes.length}
                </strong>
              </div>
            </div>
          </section>

          {!panneauReduit && (
            <aside className="scene__panneau">
              {!vueActive && <SelecteurPeriode periode={periode} onChanger={setPeriode} />}
              <Podium lignes={lignes} pourcentages={estEquipes} valeurs={valeurs} />
              <Classement
                lignes={lignes}
                periode={periodeEffective}
                objectif={objectif}
                pourcentages={estEquipes}
                equipes={courant.equipes}
                valeurs={valeurs}
                selection={selection}
                onChoisir={choisirAgent}
              />
            </aside>
          )}
        </main>
      </div>

      {complementsVisibles && (
        <section className="complements">
          <FilEvenements evenements={instantane.evenements} miseAJour={instantane.miseAJour} />
          <PanneauCommandes pilote={pilote} />
          <PanneauReglages
            nombreAgents={nombreAgents}
            onChangerNombreAgents={changerNombreAgents}
            mesure={mesurePerformance}
            sentinelleActive={sentinelleActive}
            onChangerSentinelle={setSentinelleActive}
            modeEtiquettes={modeEtiquettes}
            onChangerModeEtiquettes={setModeEtiquettes}
            niveauQualite={niveauQualite}
            onReinitialiserQualite={() => setNiveauQualite(NIVEAUX_QUALITE.complet)}
          />
          <Explications simulation={instantane.source === 'simulation'} />
        </section>
      )}

      <footer className="pied">
        {instantane.source === 'simulation' ? textes.piedSimulation : textes.piedReel}
      </footer>
    </div>
  )
}
