/**
 * Dictionnaire NL/EN de toute chaîne visible à l'écran.
 *
 * Règle du produit : jamais de français dans l'interface (le français reste la
 * langue du code et des commentaires). Le néerlandais est la langue par
 * défaut — c'est celle du plateau.
 *
 * Les libellés qui vivaient dans les couches basses (LIBELLES_PERIODE de
 * `domain/types.ts`, libellé de la source dans `data/`) ne sont PAS traduits
 * là-bas : ces fichiers sont des copies conformes du dépôt 2D et ne doivent
 * pas dériver. L'affichage les remplace par les entrées de ce dictionnaire.
 */

import type { KpiEquipe, Periode } from '../domain/types'
import type { ModeEtiquettes } from '../scene/modeEtiquettes'
import type { NiveauQualite } from '../perf/SentinellePerformance'
import { NIVEAUX_QUALITE } from '../perf/SentinellePerformance'
import type { RaisonRepli } from '../components/EcranRepli'

export type Langue = 'nl' | 'en'
export const LANGUES: readonly Langue[] = ['nl', 'en'] as const

export interface Textes {
  // Entête
  slogan: string
  derniereMiseAJour: string
  sourceSimulee: string
  sourceReelle: string
  boutonSimulerMiseAJour: string
  boutonRafraichir: string
  choixLangue: string
  /** Bascule « vue simple » : caméra fixe, décor figé, karts qui roulent. */
  boutonVueSimple: string
  infoVueSimple: string
  /** Choix de la piste affichée (décor seulement : places et points inchangés). */
  /** Kart choisi dans la liste : la caméra le suit (vue normale). */
  suivreKart: (nom: string) => string
  suiviEnCours: string
  arreterSuivi: string

  // Onglets et boutique (« Winkel ») — vus par les agents : jamais « race ».
  ongletDoelen: string
  ongletWinkel: string
  connexionTitre: string
  connexionUitleg: string
  connexionChamp: string
  connexionBouton: string
  connexionInconnu: string
  deconnexion: string
  bonjour: (nom: string) => string
  portefeuilleTitre: string
  munten: (aantal: number) => string
  aujourdhuiTitre: string
  aujourdhuiDetail: (km: number, munten: number) => string
  regleMunten: (perKm: number, max: number) => string
  historiqueTitre: string
  historiqueVide: string
  gainLigne: (km: number) => string
  achatLigne: (vehicule: string) => string
  boutiqueTitre: string
  boutiqueVide: string
  garageTitre: string
  vehiculeEnUsage: string
  vehiculeChoisir: string
  acheterBouton: (prix: number) => string
  refusAchat: Record<'inconnu' | 'deja-possede' | 'niveau-requis' | 'solde-insuffisant', string>
  nomVehicule: (id: string) => string
  /** « Level 3 » : niveau d'un véhicule ou de l'agent (le mot du chef de projet). */
  niveau: (n: number) => string
  enPossession: string
  deverrouillerAvant: (niveau: number) => string
  encoreMunten: (n: number) => string

  // Application
  chargement: string
  ariaPiste: string
  afficherPanneau: string
  masquerPanneau: string
  bandeauPeriode: string
  bandeauObjectif: string
  bandeauEnTete: string
  bandeauObjectifAtteint: string
  pts: (valeur: string, brut: number) => string
  piedSimulation: string
  piedReel: string

  // Périodes
  periodes: Record<Periode, string>
  ariaSelecteurPeriode: string

  // Podium + classement
  podium: string
  classement: string
  ariaClassement: (periode: string) => string
  noteObjectif: (score: string) => string
  toursBoucles: (tours: number) => string
  ariaAvancement: (nom: string) => string
  doelBereikt: (fois: number) => string
  chacunSonDoel: string

  // Détail d'équipe (mode équipes)
  voirDetail: string
  masquerDetail: string
  unitesKpi: Record<KpiEquipe, string>
  /** La notation compacte de la feuille de Maya : « AP/H ». */
  unitesCourtes: Record<KpiEquipe, string>
  /** Les mêmes, quand l'objectif est JOURNALIER (0017). */
  unitesCourtesJour: Record<KpiEquipe, string>
  unitesKpiJour: Record<KpiEquipe, string>
  doelLabel: (valeur: string, unite: string) => string
  doelMoyenne30: string
  heuresLabel: string
  traitementMoyen: string
  agentsTitre: string
  aucunAgent: string
  penalitesTitre: string
  penaltyPoint: (delta: number) => string

  // Tour de chronométrage — la progression de chacun vers SON objectif.
  // Aucun écart au meneur : décision produit (motivation positive, Maya 24/08).
  versLeDoel: string
  tempoTitre: string
  pagePrecedente: string
  pageSuivante: string

  // Chronique (faits dérivés des données) + célébrations plein écran
  chronDepassement: (nom: string, places: number) => string
  chronObjectif: (nom: string) => string
  chronRecord: (nom: string) => string
  chronBoost: (nom: string) => string
  celebrationDoel: string
  celebrationPlus: (n: number, unite: string) => string
  ariaTeteDeCourse: string
  meneur: string
  pourcentDoel: (valeur: string) => string
  ariaPlacesGagnees: (places: number) => string
  ariaPlacesPerdues: (places: number) => string

  // Dernier tour
  dernierTour: string
  moinsUneMinute: string
  minutesRestantes: (minutes: number) => string

  // Fil des événements
  faitsDeCourse: string
  misAJourA: (heure: string) => string
  filVide: string

  // Commandes du kart invité
  commandesTitre: string
  ariaCommandes: string
  mettreKartInvite: string
  retirerKartInvite: string
  regleCommandes: string
  voieInterieure: string
  boost: string
  voieExterieure: string
  nomsVoie: readonly [string, string, string]
  aideClavierAvant: string
  aideClavierEntre: string
  toucheEspace: string
  aideClavierApres: string
  voieActuelle: string

  // Panneau de réglages
  reglagesTitre: string
  ariaReglages: string
  fluidite: { mesure: string; fluide: string; correct: string; tension: string; critique: string }
  nomsDesKarts: string
  ariaNomsDesKarts: string
  modesEtiquettes: Record<ModeEtiquettes, string>
  aideSurvol: string
  effectifSimule: string
  ariaEffectifSimule: string
  nbAgents: (n: number) => string
  ariaMesures: string
  mesureImageMoyenne: string
  mesurePireImage: string
  mesureTriangles: string
  mesureTextures: string
  mesureResolution: string
  qualite: (libelle: string) => string
  libellesQualite: Record<NiveauQualite, string>
  aideIndicateurs: string
  degradationAuto: (active: boolean) => string
  reinitialiserQualite: string

  // Explications
  explicationsTitre: string
  ariaExplications: string
  expliquePositionTitre: string
  expliquePosition: string
  expliqueReculTitre: string
  expliqueRecul: string
  expliqueVoiesTitre: string
  expliqueVoies: string
  expliqueDonneesSimuleesTitre: string
  expliqueDonneesSimulees: string
  expliqueDonneesReellesTitre: string
  expliqueDonneesReelles: string
  expliqueBranchementTitre: string
  expliqueBranchementAvant: string
  expliqueBranchementMilieu: string
  expliqueBranchementApres: string
  explique3DTitre: string
  explique3D: string

  // Écran de repli (WebGL2 absent / contexte perdu uniquement)
  messagesRepli: Record<RaisonRepli, string>

  // Écran d'attente : l'API répond mais aucune équipe n'est composée.
  attenteTitre: string
  attenteMessage: string
}

const NL: Textes = {
  slogan: 'Prestaties op het circuit',
  derniereMiseAJour: 'Laatste update',
  sourceSimulee: 'Gesimuleerde gegevensbron',
  sourceReelle: 'Live gegevens',
  boutonSimulerMiseAJour: 'Simuleer een update',
  boutonRafraichir: 'Vernieuwen',
  choixLangue: 'Taal',
  boutonVueSimple: 'Eenvoudige weergave',
  infoVueSimple: 'Vaste camera en een rustig decor — lichter voor de computer. De karts blijven rijden.',
  suivreKart: (nom) => `${nom} volgen`,
  suiviEnCours: 'Volgt',
  arreterSuivi: 'Stoppen met volgen (Esc)',

  ongletDoelen: 'Doelen',
  ongletWinkel: 'Winkel',
  connexionTitre: 'Inloggen',
  connexionUitleg: 'Vul je volledige naam in om je munten, de winkel en je garage te zien.',
  connexionChamp: 'Je volledige naam',
  connexionBouton: 'Inloggen',
  connexionInconnu: 'Deze naam kennen we niet. Gebruik je volledige naam, zoals in het klassement.',
  deconnexion: 'Uitloggen',
  bonjour: (nom) => `Hallo ${nom}`,
  portefeuilleTitre: 'Portemonnee',
  munten: (aantal) => `${aantal} ${aantal === 1 ? 'munt' : 'munten'}`,
  aujourdhuiTitre: 'Vandaag tot nu toe',
  aujourdhuiDetail: (km, munten) => `${km.toLocaleString('nl-BE')} km gereden · goed voor ${munten} ${munten === 1 ? 'munt' : 'munten'}`,
  regleMunten: (perKm, max) =>
    `Per gereden km krijg je ${perKm} munten, met een maximum van ${max} per dag. Je munten komen erbij aan het einde van de dag.`,
  historiqueTitre: 'Laatste beloningen',
  historiqueVide: 'Nog geen munten verdiend. Aan het einde van de dag komen je eerste munten erbij.',
  gainLigne: (km) => `Dag afgerond · ${km.toLocaleString('nl-BE')} km`,
  achatLigne: (vehicule) => `Gekocht: ${vehicule}`,
  boutiqueTitre: 'Winkel',
  boutiqueVide: 'Binnenkort vind je hier nieuwe voertuigen om met je munten te kopen.',
  garageTitre: 'Garage',
  vehiculeEnUsage: 'In gebruik',
  vehiculeChoisir: 'Kiezen',
  acheterBouton: (prix) => `Kopen · ${prix}`,
  refusAchat: {
    inconnu: 'Dit voertuig bestaat niet (meer).',
    'deja-possede': 'Dit voertuig heb je al.',
    'niveau-requis': 'Koop eerst het vorige level.',
    'solde-insuffisant': 'Je hebt nog niet genoeg munten.',
  },
  nomVehicule: (id) =>
    ({
      'kart-standaard': 'Standaard kart',
      appeltaart: 'Appeltaartkart',
      'dessert-taart': 'Taartbolide',
      wafelauto: 'Wafelwagen',
      'gevulde-chariot': 'Chocoracer',
      'dessert-auto': 'Koekjesbolide',
      kruiwagen: 'Kruiwagen',
      'sedan-klassiek': 'Klassieke sedan',
      'bolle-wagen': 'Bolle wagen',
      limousine: 'Limousine',
      'sedan-roze': 'Roze sedan',
      cabrio: 'Cabrio',
      lowrider: 'Lowrider',
      'stretch-limo': 'Stretchlimo',
      'hello-kitty': 'Hello Kitty',
    })[id] ?? id,
  niveau: (n) => `Level ${n}`,
  enPossession: 'In bezit',
  deverrouillerAvant: (niveau) => `Eerst level ${niveau}`,
  encoreMunten: (n) => `Nog ${n} ${n === 1 ? 'munt' : 'munten'}`,

  chargement: 'De startgrid wordt klaargezet…',
  ariaPiste: 'Lopende race (3D)',
  afficherPanneau: 'Zijpaneel tonen',
  masquerPanneau: 'Zijpaneel verbergen',
  bandeauPeriode: 'Periode',
  bandeauObjectif: 'Doel',
  bandeauEnTete: 'Aan de leiding',
  bandeauObjectifAtteint: 'Doel bereikt',
  pts: (valeur) => `${valeur} ptn`,
  piedSimulation:
    'Bawaba Race — demonstratieprototype. Fictieve gegevens, geen echte persoonsgegevens.',
  piedReel: 'Bawaba Race — live gegevens.',

  periodes: { jour: 'Vandaag', semaine: 'Deze week', mois: 'Deze maand' },
  ariaSelecteurPeriode: 'Periode van het klassement',

  podium: 'Podium',
  classement: 'Klassement',
  ariaClassement: (periode) => `Klassement — ${periode}`,
  noteObjectif: (score) => `Doel: ${score} ptn`,
  toursBoucles: (tours) => `${tours} ronde${tours > 1 ? 's' : ''} voltooid`,
  ariaAvancement: (nom) => `Voortgang van ${nom} in de huidige ronde`,
  doelBereikt: (fois) => `Doel ${fois}× bereikt`,
  chacunSonDoel: 'Elk team zijn eigen doel',

  voirDetail: 'Details tonen',
  masquerDetail: 'Details verbergen',
  unitesKpi: {
    ss_per_hour: 'afspraken/u',
    ingepl_per_hour: 'INGEPL/u',
    calls_per_hour: 'gesprekken/u',
    cases_per_day: 'dossiers/dag',
  },
  unitesCourtes: {
    ss_per_hour: 'AP/u',
    ingepl_per_hour: 'INGEPL/u',
    calls_per_hour: 'gespr/u',
    cases_per_day: 'doss/dag',
  },
  unitesCourtesJour: {
    ss_per_hour: 'AP',
    ingepl_per_hour: 'INGEPL',
    calls_per_hour: 'gespr',
    cases_per_day: 'doss',
  },
  unitesKpiJour: {
    ss_per_hour: 'afspraken/dag',
    ingepl_per_hour: 'INGEPL/dag',
    calls_per_hour: 'gesprekken/dag',
    cases_per_day: 'dossiers/dag',
  },
  doelLabel: (valeur, unite) => `Doel: ${valeur} ${unite}`,
  doelMoyenne30: '30-dagen gemiddelde',
  heuresLabel: 'Uren',
  traitementMoyen: 'Gem. afhandeltijd',
  agentsTitre: 'Agenten',
  aucunAgent: 'Nog geen activiteit in deze periode.',
  penalitesTitre: 'Strafpunten',
  penaltyPoint: (delta) => `Penalty point ${delta > 0 ? `+${delta}` : delta}`,

  versLeDoel: 'Op weg naar het doel',
  tempoTitre: 'Tempo',
  pagePrecedente: 'Vorige pagina',
  pageSuivante: 'Volgende pagina',

  chronDepassement: (nom, places) => `${nom} wint ${places} plaats${places > 1 ? 'en' : ''}`,
  chronObjectif: (nom) => `${nom} haalt het doel`,
  chronRecord: (nom) => `${nom} pakt de leiding`,
  chronBoost: (nom) => `${nom} versnelt`,
  celebrationDoel: 'Doel bereikt!',
  celebrationPlus: (n, unite) => `+${n} ${unite}`,
  ariaTeteDeCourse: 'Kop van de race',
  meneur: 'Leider',
  pourcentDoel: (valeur) => `${valeur} %`,
  ariaPlacesGagnees: (places) => `${places} plaats${places > 1 ? 'en' : ''} gewonnen`,
  ariaPlacesPerdues: (places) => `${places} plaats${places > 1 ? 'en' : ''} verloren`,

  dernierTour: 'Laatste ronde',
  moinsUneMinute: 'minder dan een minuut',
  minutesRestantes: (minutes) => `${minutes} minuten`,

  faitsDeCourse: 'Racefeiten',
  misAJourA: (heure) => `Bijgewerkt om ${heure}`,
  filVide: 'Nog geen racefeiten.',

  commandesTitre: 'Bediening (optioneel)',
  ariaCommandes: 'Bediening van de gastkart',
  mettreKartInvite: 'Zet een gastkart op de baan',
  retirerKartInvite: 'Haal de gastkart van de baan',
  regleCommandes: 'De bediening wijzigt het klassement niet',
  voieInterieure: 'Binnenbaan',
  boost: 'Boost',
  voieExterieure: 'Buitenbaan',
  nomsVoie: ['Binnenbaan', 'Middenbaan', 'Buitenbaan'],
  aideClavierAvant: 'Met het toetsenbord:',
  aideClavierEntre: 'om van baan te wisselen,',
  toucheEspace: 'Spatie',
  aideClavierApres: 'voor een visuele boost.',
  voieActuelle: 'Huidige baan:',

  reglagesTitre: '3D-belastingstest',
  ariaReglages: 'Instellingen',
  fluidite: {
    mesure: 'Meten…',
    fluide: 'Vloeiend',
    correct: 'Correct',
    tension: 'Onder druk',
    critique: 'Kritiek',
  },
  nomsDesKarts: 'Namen van de karts',
  ariaNomsDesKarts: 'Weergave van de kartnamen',
  modesEtiquettes: { toujours: 'Altijd', survol: 'Bij aanwijzen', jamais: 'Verborgen' },
  aideSurvol:
    '‘Bij aanwijzen’ heeft alleen zin op een computer met muis: op een muurscherm wijst ' +
    'niemand, de naamplaatjes zouden onzichtbaar blijven.',
  effectifSimule: 'Gesimuleerde bezetting',
  ariaEffectifSimule: 'Aantal gesimuleerde agenten',
  nbAgents: (n) => `${n} agenten`,
  ariaMesures: 'WebGL-prestatiemetingen',
  mesureImageMoyenne: 'Gemiddeld frame',
  mesurePireImage: 'Slechtste frame',
  mesureTriangles: 'Driehoeken',
  mesureTextures: 'Texturen',
  mesureResolution: 'Resolutie',
  qualite: (libelle) => `Kwaliteit: ${libelle}`,
  libellesQualite: {
    [NIVEAUX_QUALITE.complet]: 'Volledig',
    [NIVEAUX_QUALITE.sansPostTraitement]: 'Zonder nabewerking',
    [NIVEAUX_QUALITE.fouleReduite]: 'Beperkt publiek',
    [NIVEAUX_QUALITE.sansOmbres]: 'Zonder schaduwen',
    [NIVEAUX_QUALITE.minimal]: 'Minimale 3D',
  },
  aideIndicateurs:
    'De browser geeft geen betrouwbaar GPU-percentage. FPS, frametijd, driehoeken en ' +
    'draw calls dienen hier als belastingsindicatoren.',
  degradationAuto: (active) => `Automatische degradatie ${active ? 'aan' : 'uit'}`,
  reinitialiserQualite: 'Kwaliteit terugzetten',

  explicationsTitre: 'Hoe dit prototype werkt',
  ariaExplications: 'Werking van het prototype',
  expliquePositionTitre: 'De positie volgt de score',
  expliquePosition:
    'De voortgang van een kart tussen de start- en de finishlijn is de verhouding tussen ' +
    'de score van de agent en het doel van de periode. Niets anders telt mee.',
  expliqueReculTitre: 'Een kart rijdt nooit achteruit',
  expliqueRecul:
    'Scores zijn cumulatief. Een prestatiedaling vertraagt de kart, ze draait hem niet terug.',
  expliqueVoiesTitre: 'De rijstroken dienen de leesbaarheid',
  expliqueVoies:
    'Agenten die nek aan nek rijden worden over de drie banen verdeeld om zichtbaar te ' +
    'blijven. Bij gelijke voortgang blijven twee karts naast elkaar, welke baan ook.',
  expliqueDonneesSimuleesTitre: 'Gesimuleerde gegevens',
  expliqueDonneesSimulees:
    'Elke 8 à 15 seconden wordt automatisch een update gegenereerd; de knop ' +
    '‘Simuleer een update’ doet dat meteen. Er worden geen echte gegevens gebruikt.',
  expliqueDonneesReellesTitre: 'Live gegevens',
  expliqueDonneesReelles:
    'De scores komen van de API en worden doorlopend opgevraagd.',
  expliqueBranchementTitre: 'Echte gegevens aansluiten',
  expliqueBranchementAvant: 'De simulator en de API implementeren dezelfde interface',
  expliqueBranchementMilieu: '. Het volstaat',
  expliqueBranchementApres:
    'in te stellen om op echte gegevens over te schakelen: geen enkel interfacecomponent ' +
    'hoeft te wijzigen.',
  explique3DTitre: '3D-versie',
  explique3D:
    'Deze 3D-scène deelt exact dezelfde scoremotor als de 2D-versie van Bawaba Race — ' +
    'alleen de baangeometrie en de weergave verschillen.',

  messagesRepli: {
    'webgl2-indisponible':
      'De 3D-weergave van Bawaba Race vereist WebGL2, dat op dit toestel niet beschikbaar is.',
    'performance-insuffisante':
      'Dit toestel heeft niet genoeg grafische kracht voor een vloeiende 3D-weergave.',
    'contexte-perdu':
      'De 3D-weergave werd onderbroken door het grafische stuurprogramma van dit toestel. ' +
      'De pagina herladen zou moeten volstaan.',
  },

  attenteTitre: 'De startgrid is klaar',
  attenteMessage:
    'De race start zodra de teams zijn samengesteld in het dashboard ' +
    '(Game-beheer). Dit scherm vernieuwt zichzelf.',
}

const EN: Textes = {
  slogan: 'Performance hits the track',
  derniereMiseAJour: 'Last update',
  sourceSimulee: 'Simulated data source',
  sourceReelle: 'Live data',
  boutonSimulerMiseAJour: 'Simulate an update',
  boutonRafraichir: 'Refresh',
  choixLangue: 'Language',
  boutonVueSimple: 'Simple view',
  infoVueSimple: 'Fixed camera and a still backdrop — lighter on the computer. The karts keep driving.',
  suivreKart: (nom) => `Follow ${nom}`,
  suiviEnCours: 'Following',
  arreterSuivi: 'Stop following (Esc)',

  ongletDoelen: 'Goals',
  ongletWinkel: 'Shop',
  connexionTitre: 'Log in',
  connexionUitleg: 'Enter your full name to see your coins, the shop and your garage.',
  connexionChamp: 'Your full name',
  connexionBouton: 'Log in',
  connexionInconnu: "We don't know this name. Use your full name, as shown in the ranking.",
  deconnexion: 'Log out',
  bonjour: (nom) => `Hi ${nom}`,
  portefeuilleTitre: 'Wallet',
  munten: (aantal) => `${aantal} ${aantal === 1 ? 'coin' : 'coins'}`,
  aujourdhuiTitre: 'Today so far',
  aujourdhuiDetail: (km, munten) => `${km.toLocaleString('en-GB')} km driven · worth ${munten} ${munten === 1 ? 'coin' : 'coins'}`,
  regleMunten: (perKm, max) =>
    `You get ${perKm} coins per km driven, up to ${max} per day. Your coins are added at the end of the day.`,
  historiqueTitre: 'Recent rewards',
  historiqueVide: 'No coins earned yet. Your first coins are added at the end of the day.',
  gainLigne: (km) => `Day completed · ${km.toLocaleString('en-GB')} km`,
  achatLigne: (vehicule) => `Bought: ${vehicule}`,
  boutiqueTitre: 'Shop',
  boutiqueVide: 'Soon you will find new vehicles here to buy with your coins.',
  garageTitre: 'Garage',
  vehiculeEnUsage: 'In use',
  vehiculeChoisir: 'Select',
  acheterBouton: (prix) => `Buy · ${prix}`,
  refusAchat: {
    inconnu: 'This vehicle no longer exists.',
    'deja-possede': 'You already own this vehicle.',
    'niveau-requis': 'Buy the previous level first.',
    'solde-insuffisant': "You don't have enough coins yet.",
  },
  nomVehicule: (id) =>
    ({
      'kart-standaard': 'Standard kart',
      appeltaart: 'Apple pie kart',
      'dessert-taart': 'Cake racer',
      wafelauto: 'Waffle car',
      'gevulde-chariot': 'Choco racer',
      'dessert-auto': 'Cookie cruiser',
      kruiwagen: 'Wheelbarrow',
      'sedan-klassiek': 'Classic saloon',
      'bolle-wagen': 'Bubble car',
      limousine: 'Limousine',
      'sedan-roze': 'Pink saloon',
      cabrio: 'Convertible',
      lowrider: 'Lowrider',
      'stretch-limo': 'Stretch limo',
      'hello-kitty': 'Hello Kitty',
    })[id] ?? id,
  niveau: (n) => `Level ${n}`,
  enPossession: 'Owned',
  deverrouillerAvant: (niveau) => `Level ${niveau} first`,
  encoreMunten: (n) => `${n} ${n === 1 ? 'coin' : 'coins'} to go`,

  chargement: 'Preparing the starting grid…',
  ariaPiste: 'Race in progress (3D)',
  afficherPanneau: 'Show the side panel',
  masquerPanneau: 'Hide the side panel',
  bandeauPeriode: 'Period',
  bandeauObjectif: 'Target',
  bandeauEnTete: 'In the lead',
  bandeauObjectifAtteint: 'Target reached',
  pts: (valeur) => `${valeur} pts`,
  piedSimulation:
    'Bawaba Race — demonstration prototype. Fictional data, no real personal data.',
  piedReel: 'Bawaba Race — live data.',

  periodes: { jour: 'Today', semaine: 'This week', mois: 'This month' },
  ariaSelecteurPeriode: 'Leaderboard period',

  podium: 'Podium',
  classement: 'Leaderboard',
  ariaClassement: (periode) => `Leaderboard — ${periode}`,
  noteObjectif: (score) => `Target: ${score} pts`,
  toursBoucles: (tours) => `${tours} lap${tours > 1 ? 's' : ''} completed`,
  ariaAvancement: (nom) => `${nom}'s progress in the current lap`,
  doelBereikt: (fois) => `Goal reached ${fois}×`,
  chacunSonDoel: 'Each team its own goal',

  voirDetail: 'Show details',
  masquerDetail: 'Hide details',
  unitesKpi: {
    ss_per_hour: 'appointments/h',
    ingepl_per_hour: 'INGEPL/h',
    calls_per_hour: 'calls/h',
    cases_per_day: 'cases/day',
  },
  unitesCourtes: {
    ss_per_hour: 'AP/h',
    ingepl_per_hour: 'INGEPL/h',
    calls_per_hour: 'calls/h',
    cases_per_day: 'cases/day',
  },
  unitesCourtesJour: {
    ss_per_hour: 'AP',
    ingepl_per_hour: 'INGEPL',
    calls_per_hour: 'calls',
    cases_per_day: 'cases',
  },
  unitesKpiJour: {
    ss_per_hour: 'appointments/day',
    ingepl_per_hour: 'INGEPL/day',
    calls_per_hour: 'calls/day',
    cases_per_day: 'cases/day',
  },
  doelLabel: (valeur, unite) => `Goal: ${valeur} ${unite}`,
  doelMoyenne30: '30-day average',
  heuresLabel: 'Hours',
  traitementMoyen: 'Avg. handling time',
  agentsTitre: 'Agents',
  aucunAgent: 'No activity in this period yet.',
  penalitesTitre: 'Penalty points',
  penaltyPoint: (delta) => `Penalty point ${delta > 0 ? `+${delta}` : delta}`,

  versLeDoel: 'On the way to the goal',
  tempoTitre: 'Pace',
  pagePrecedente: 'Previous page',
  pageSuivante: 'Next page',

  chronDepassement: (nom, places) => `${nom} gains ${places} place${places > 1 ? 's' : ''}`,
  chronObjectif: (nom) => `${nom} reaches the goal`,
  chronRecord: (nom) => `${nom} takes the lead`,
  chronBoost: (nom) => `${nom} speeds up`,
  celebrationDoel: 'Goal reached!',
  celebrationPlus: (n, unite) => `+${n} ${unite}`,
  ariaTeteDeCourse: 'Front of the race',
  meneur: 'Leader',
  pourcentDoel: (valeur) => `${valeur} %`,
  ariaPlacesGagnees: (places) => `${places} place${places > 1 ? 's' : ''} gained`,
  ariaPlacesPerdues: (places) => `${places} place${places > 1 ? 's' : ''} lost`,

  dernierTour: 'Final lap',
  moinsUneMinute: 'under a minute',
  minutesRestantes: (minutes) => `${minutes} minutes`,

  faitsDeCourse: 'Race facts',
  misAJourA: (heure) => `Updated at ${heure}`,
  filVide: 'No race facts yet.',

  commandesTitre: 'Controls (optional)',
  ariaCommandes: 'Guest kart controls',
  mettreKartInvite: 'Put a guest kart on track',
  retirerKartInvite: 'Remove the guest kart',
  regleCommandes: 'Controls never change the leaderboard',
  voieInterieure: 'Inside lane',
  boost: 'Boost',
  voieExterieure: 'Outside lane',
  nomsVoie: ['Inside', 'Middle', 'Outside'],
  aideClavierAvant: 'Keyboard:',
  aideClavierEntre: 'to change lane,',
  toucheEspace: 'Space',
  aideClavierApres: 'for a visual boost.',
  voieActuelle: 'Current lane:',

  reglagesTitre: '3D load test',
  ariaReglages: 'Settings',
  fluidite: {
    mesure: 'Measuring…',
    fluide: 'Smooth',
    correct: 'Fair',
    tension: 'Under strain',
    critique: 'Critical',
  },
  nomsDesKarts: 'Kart names',
  ariaNomsDesKarts: 'Kart name display',
  modesEtiquettes: { toujours: 'Always', survol: 'On hover', jamais: 'Hidden' },
  aideSurvol:
    '“On hover” only makes sense on a desk with a mouse: on a wall display nobody points, ' +
    'the name plates would stay invisible.',
  effectifSimule: 'Simulated headcount',
  ariaEffectifSimule: 'Number of simulated agents',
  nbAgents: (n) => `${n} agents`,
  ariaMesures: 'WebGL performance metrics',
  mesureImageMoyenne: 'Average frame',
  mesurePireImage: 'Worst frame',
  mesureTriangles: 'Triangles',
  mesureTextures: 'Textures',
  mesureResolution: 'Resolution',
  qualite: (libelle) => `Quality: ${libelle}`,
  libellesQualite: {
    [NIVEAUX_QUALITE.complet]: 'Full',
    [NIVEAUX_QUALITE.sansPostTraitement]: 'No post-processing',
    [NIVEAUX_QUALITE.fouleReduite]: 'Reduced crowd',
    [NIVEAUX_QUALITE.sansOmbres]: 'No shadows',
    [NIVEAUX_QUALITE.minimal]: 'Minimal 3D',
  },
  aideIndicateurs:
    'The browser provides no reliable GPU percentage. FPS, frame time, triangles and ' +
    'draw calls stand in as load indicators.',
  degradationAuto: (active) => `Auto degradation ${active ? 'on' : 'off'}`,
  reinitialiserQualite: 'Reset quality',

  explicationsTitre: 'How this prototype works',
  ariaExplications: 'How the prototype works',
  expliquePositionTitre: 'Position follows the score',
  expliquePosition:
    "A kart's progress between the start and the finish line is the ratio between the " +
    "agent's score and the period's target. Nothing else enters the calculation.",
  expliqueReculTitre: 'A kart never goes backwards',
  expliqueRecul:
    'Scores are cumulative. A dip in performance slows the kart down; it never moves it ' +
    'backwards.',
  expliqueVoiesTitre: 'Lanes exist for legibility',
  expliqueVoies:
    'Agents neck and neck are spread across the three lanes to stay distinct. At equal ' +
    'progress two karts stay side by side, whatever their lane.',
  expliqueDonneesSimuleesTitre: 'Simulated data',
  expliqueDonneesSimulees:
    'An update is generated automatically every 8–15 seconds, and the “Simulate an ' +
    'update” button triggers one immediately. No real data is used.',
  expliqueDonneesReellesTitre: 'Live data',
  expliqueDonneesReelles: 'Scores come from the API, polled continuously.',
  expliqueBranchementTitre: 'Wiring real data',
  expliqueBranchementAvant: 'The simulator and the API implement the same interface',
  expliqueBranchementMilieu: '. Setting',
  expliqueBranchementApres:
    'is enough to switch to real data: no interface component needs to change.',
  explique3DTitre: '3D version',
  explique3D:
    'This 3D scene shares the exact same scoring engine as the 2D Bawaba Race — only the ' +
    'track geometry and the rendering differ.',

  messagesRepli: {
    'webgl2-indisponible':
      "Bawaba Race's 3D display requires WebGL2, which is unavailable on this machine.",
    'performance-insuffisante':
      'This machine lacks the graphics power for a smooth 3D display.',
    'contexte-perdu':
      "The 3D display was interrupted by the machine's graphics driver. Reloading the " +
      'page should be enough to restart it.',
  },

  attenteTitre: 'The starting grid is ready',
  attenteMessage:
    'The race begins as soon as the teams are set up in the dashboard ' +
    '(Game admin). This screen refreshes itself.',
}

export const TEXTES: Record<Langue, Textes> = { nl: NL, en: EN }
