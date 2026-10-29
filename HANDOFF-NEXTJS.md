# Race Pulse — Document de passation (intégration Next.js)

Ce document résume tout le travail effectué sur **Race Pulse** (2D et 3D) pour permettre à un autre agent (Codex) de reprendre le projet et de le brancher à une application Next.js existante, hébergée sur Vercel. Il est volontairement autonome : il ne suppose pas l'accès au plan d'implémentation d'origine (`~/.claude/plans/...`, propre à la machine de développement) ni à l'historique de conversation qui a produit ce code.

**Écrit le 2026-08-01.** Vérifié directement dans les deux dépôts au moment de la rédaction (pas de suppositions non vérifiées).

---

## 1. Emplacement des dépôts et contexte produit

Deux dépôts **séparés**, pas un monorepo, pas des branches d'un même dépôt — choix explicite du porteur de produit pour garder chaque version indépendamment déployable :

| Dépôt | Chemin | Rôle | Git |
| --- | --- | --- | --- |
| `race-pulse` | `/Users/sdw/Documents/dev/race-pulse/` | Version **2D** (SVG), stable, référence de comportement | **Pas de dépôt Git** (`.git` absent) |
| `race-pulse-3d` | `/Users/sdw/Documents/dev/race-pulse-3d/` | Version **3D** (Three.js / React Three Fiber), activement développée | 3 commits sur `main`, aucun remote configuré |

**Produit :** outil interne de gamification pour un centre d'appels — la performance d'agents (scores cumulatifs par jour/semaine/mois) est transformée en course de karts façon « Mario Kart sans compétition entre utilisateurs », affichée sur un écran mural. Environ 30 agents à terme. Aucune donnée personnelle réelle n'est utilisée dans l'état actuel (simulateur uniquement).

**Historique des commits `race-pulse-3d`** (le plus récent en premier) :
```
db797db Phase 5 — durcissement kiosque
cfc8e7a Ajoute une flamme de boost (shader procédural, ancrée à l'échappement)
3344813 Race Pulse 3D — Phases 0 à 4 (fondations, proto, stade, caméras, marque)
```
Les 5 phases du plan d'implémentation d'origine sont terminées et vérifiées par capture d'écran navigateur réelle (Playwright) à chaque étape. Le projet est **fonctionnellement complet** par rapport à son cahier des charges initial ; il n'a en revanche **jamais été déployé** (aucun `vercel.json`, aucun fichier `.env*` dans l'un ou l'autre dépôt — la configuration d'hébergement est entièrement à faire).

---

## 2. Ce que chaque version est concrètement

Les deux dépôts sont des **SPA Vite + React**, pas des applications Next.js. C'est le point le plus important à intégrer avant de commencer le portage :

- `npm run dev` → serveur Vite (port 5173 par défaut)
- `npm run build` → `tsc -b && vite build`, produit un `dist/` statique
- Point d'entrée unique : `index.html` → `src/main.tsx` → `createRoot(...).render(<App />)`
- Aucun routeur, aucune notion de page — un seul écran plein cadre.

### 2D (`race-pulse`)
- Rendu en **SVG** pur, animé via `requestAnimationFrame` + écriture directe d'attributs DOM (`setAttribute`), volontairement **hors du state React** pour tourner en continu sans reconciliation inutile.
- Dépendances : uniquement `react` + `react-dom` (aucune bibliothèque 3D, aucune dépendance graphique lourde).
- Structure : `src/domain/` (règles pures), `src/data/` (source de données), `src/hooks/`, `src/components/` (SVG).

### 3D (`race-pulse-3d`)
- Rendu en **WebGL2** via Three.js / React Three Fiber (R3F), caméra cinématique automatique, décor animé (stade, foule, ciel), post-traitement (bloom/vignette), kart de marque modélisé dans Blender.
- Nécessite WebGL2 côté client — voir §6 (repli).
- Structure : mêmes `domain/`/`data/`/`hooks/` que la 2D (copiés à la main, voir §3), plus `src/scene/` (rendu 3D), `src/camera/` (réalisateur de caméra), `src/perf/` (détection WebGL2, sentinelle de performance).

---

## 3. Pas de code partagé entre 2D et 3D — conséquence assumée

Décision produit explicite : **aucun package partagé** entre les deux dépôts. Les fichiers suivants sont **copiés à la main**, à l'identique, d'un dépôt vers l'autre (chaque fichier copié porte un en-tête de commentaire signalant sa provenance et rappelant de reporter tout correctif dans les deux dépôts) :

- `domain/types.ts`, `domain/classement.ts`
- `data/SourceDonnees.ts`, `data/SimulateurCourse.ts`, `data/SourceApi.ts`, `data/agents.ts`, `data/index.ts`
- `hooks/useInstantane.ts`, `hooks/useAnimationReduite.ts`, `hooks/usePiloteInvite.ts`

Seul `domain/circuit.ts` (2D) → `domain/circuit3d.ts` (3D) est **forké** (même topologie de course — longueur de tour, position de la ligne d'arrivée — mais géométrie de rendu différente : coordonnées SVG 2D vs repère 3D avec quaternion). Voir §5 pour le détail.

**Risque de dérive assumé** : si l'algorithme de classement change, il faut le répercuter manuellement dans les deux dépôts. Aucun mécanisme n'empêche aujourd'hui cette dérive — si le futur propriétaire du code veut la supprimer, la solution standard serait un package npm partagé (workspace) contenant `domain/` + `data/` + `hooks/`, consommé par les deux apps. Ce n'est **pas** fait aujourd'hui, par choix.

---

## 4. Comment l'algorithme fait avancer les karts

C'est le cœur du produit — identique en 2D et en 3D (même code, seule la couche de rendu diffère). Trois étages :

### 4.1 — Du score brut au classement (`domain/classement.ts`)

Entrée : un `Instantane` (voir §5.1 pour le contrat complet) contenant, pour chaque agent, un score par période (jour/semaine/mois) et une tendance (%).

```ts
export function progressionVersObjectif(score: number, objectif: number): number {
  if (objectif <= 0) return 0
  return Math.min(1, Math.max(0, score / objectif))
}
```

`construireClassement(instantane, periode)` :
1. Filtre/associe chaque `Performance` à son `Agent`.
2. Calcule `progression = clamp(score / objectif, 0, 1)` — **c'est l'unique donnée qui pilote la position sur la piste**. Rien d'autre n'entre dans ce calcul (pas de vitesse, pas d'accélération, pas de hasard).
3. Trie par score décroissant (départage alphabétique).
4. Assigne un rang (1, 2, 3…) et une **voie** d'affichage : `voie = rang % nombreVoies`. La voie est **purement cosmétique** (évite que deux karts au coude-à-coude se superposent visuellement) — elle n'influence jamais le classement ni le score.

### 4.2 — La règle non négociable : un kart ne recule jamais (`scene/lissageProgression.ts` en 3D, logique équivalente inline dans `components/Circuit.tsx` en 2D)

```ts
export function avancerVersCible(
  actuel: number, cible: number, dt: number, tau: number, jamaisReculer: boolean,
): number {
  const cibleEffective = jamaisReculer ? Math.max(cible, actuel) : cible
  const facteur = 1 - Math.exp(-dt / tau)
  return actuel + (cibleEffective - actuel) * facteur
}
```

- Si la nouvelle donnée indique une progression **inférieure** à la position actuelle du kart (score recalculé à la baisse, bruit de mesure...), la cible effective reste `max(cible, actuel)` : **le kart n'inverse jamais son sens de déplacement au sein d'une même période.** Une contre-performance ralentit sa progression, elle ne la fait pas reculer.
- Le déplacement lui-même est un lissage exponentiel classique (`1 - e^(-dt/tau)`), avec `tau = 0.85s` pour la progression et `tau = 0.55s` pour les changements de voie — appliqué **à chaque frame** (`requestAnimationFrame` en 2D, `useFrame` R3F en 3D), jamais via le state React (trop coûteux à 60 fps en continu).
- **Cas particulier — nouvelle période** : si la progression chute de plus de `SEUIL_NOUVELLE_PERIODE = 0.5` d'un coup (minuit, nouvelle semaine, reset du simulateur), ce n'est **pas** traité comme un recul à bloquer mais comme un vrai redémarrage : le kart est ramené instantanément à la nouvelle valeur (plus basse), puis reprend sa progression normalement depuis là.
- `prefers-reduced-motion` court-circuite le lissage (`appliquerInstantanement`) : la position saute directement à `max(cible, actuel)`, sans interpolation animée — la règle « jamais de recul » reste vraie, seule l'animation de transition disparaît.

### 4.3 — De la progression à une position dessinable (`domain/circuit.ts` / `domain/circuit3d.ts`)

Le circuit est un **ovale de stade** (deux lignes droites + deux demi-cercles), paramétré par `a` (demi-longueur de ligne droite) et `r` (rayon de la voie centrale). `pointSurPiste(s, decalage)` convertit une abscisse curviligne `s` (mesurée sur la voie centrale) en position + orientation, par une fonction analytique en 4 branches (pas de mesure DOM, pas d'approximation).

- **2D** : renvoie `{x, y, angle}` en coordonnées SVG (repère `cx=640, cy=470, a=320, r=162, largeurVoie=44, nombreVoies=3`, vue `1280×800`).
- **3D** : renvoie un repère complet `{position: {x,y,z}, avant, haut}` (vecteurs bruts, **aucun type Three.js dans le domaine** — c'est la couche de rendu qui construit un quaternion à partir de la base orthonormée). Unités en mètres : `a=55, r=28, largeurVoie=3.6, nombreVoies=6` (6 voies plutôt que 3, pour absorber la montée en charge annoncée à ~30 agents).

`positionKart(progression, voie)` = `pointSurPiste(progression × abscisseArrivée, decalageVoie(voie))`. Le départ est à l'abscisse 0, l'arrivée aux trois-quarts du tour (le quart restant est une zone de retour aux stands non utilisée pour l'affichage du classement).

### 4.4 — Le kart « invité » (hors classement)

Un kart pilotable au clavier (`hooks/usePiloteInvite.ts`, identique dans les deux dépôts) existe en plus des karts notés — **purement ludique, n'écrit jamais dans le modèle de score**, n'apparaît ni dans le classement ni sur le podium. Il circule librement sur tout le tour (pas borné à la progression 0..1) et peut « boost » temporairement (multiplicateur ×2.6 pendant 1200 ms).

---

## 5. Comment brancher les vraies données du centre d'appels

Le contrat est déjà écrit et **identique dans les deux dépôts** (`src/data/`). Aucune ligne de composant d'interface n'a besoin de changer pour brancher une vraie source.

### 5.1 — Le contrat (`data/SourceDonnees.ts`)

```ts
export interface SourceDonnees {
  readonly type: 'simulation' | 'api'
  readonly libelle: string
  /** Doit émettre un premier instantané immédiatement, puis à chaque mise à jour. */
  souscrire(ecouteur: (instantane: Instantane) => void): () => void
  /** Force une mise à jour immédiate. */
  rafraichir(): void
}
```

Un `Instantane` (`domain/types.ts`) est **la seule forme de données que l'app consomme** :
```ts
interface Instantane {
  agents: Agent[]                    // { id, nom, equipe, couleur, initiales }
  performances: Performance[]        // { agentId, scores: {jour,semaine,mois}, tendances: {jour,semaine,mois} }
  objectifs: ScoresParPeriode        // score à atteindre par période, pour la ligne d'arrivée
  evenements: EvenementCourse[]      // fil d'actualité (dépassement, boost, record...), du + récent au + ancien
  miseAJour: number                  // epoch ms
  source: 'simulation' | 'api'
}
```

### 5.2 — Deux implémentations déjà écrites

- `data/SimulateurCourse.ts` : générateur pseudo-aléatoire **déterministe** (graine fixe), scores strictement cumulatifs, événements plafonnés (`MAX_EVENEMENTS = 14`), tick automatique toutes les 8 à 15 s. C'est la source par défaut.
- `data/SourceApi.ts` : **déjà fonctionnelle**, il suffit de la brancher. Interroge une URL en `fetch` toutes les 10 s (`PERIODE_SONDAGE`), traduit la réponse JSON vers `Instantane` via `versInstantane()`. La forme JSON attendue par défaut (`ReponseApi`, adaptable si le vrai backend diffère) :
  ```ts
  interface ReponseApi {
    updated_at?: string
    goals?: { daily?: number; weekly?: number; monthly?: number }
    agents: Array<{ id: string; display_name: string; team?: string; color?: string;
      daily_score?: number; weekly_score?: number; monthly_score?: number;
      daily_trend?: number; weekly_trend?: number; monthly_trend?: number }>
    events?: Array<{ id: string; at?: string; kind?: string; message: string; agent_id?: string }>
  }
  ```
  En cas d'échec réseau, le dernier instantané valide est conservé (l'écran ne se vide jamais) ; l'erreur est journalisée en `console.error`.

### 5.3 — Le point de bascule (`data/index.ts`)

```ts
export function creerSourceDonnees(): SourceDonnees {
  const url = import.meta.env?.VITE_RACE_PULSE_API_URL
  return url ? new SourceApi(url) : new SimulateurCourse()
}
```

**Pour brancher les vraies données : définir `VITE_RACE_PULSE_API_URL`, rien d'autre à toucher.** C'est le premier point à adapter lors du portage vers Next.js — voir §8.3 (les variables `VITE_*` n'existent pas dans Next.js).

**⚠️ Recommandation forte pour l'intégration Next.js** : ne pas exposer l'URL/les identifiants du vrai backend du centre d'appels au client (ce que ferait `NEXT_PUBLIC_*`, visible dans le bundle JS envoyé au navigateur). Faire plutôt transiter l'appel par une **Route Handler Next.js** (`app/.../route.ts`) qui interroge le vrai backend côté serveur et renvoie la forme `ReponseApi` déjà attendue — `SourceApi` pointe alors simplement vers cette route interne (`/api/race-pulse`), sans rien connaître du vrai backend.

---

## 6. Bascule 2D ⇄ 3D — comment ça marche aujourd'hui, et ses limites

Décision assumée dès la conception (conséquence directe de l'absence de code partagé, §3) : **il n'y a pas de bascule transparente** entre les deux rendus au sein d'une même page. La 3D ne sait faire qu'une chose en cas de problème : **rediriger vers une URL externe** où la 2D est déployée séparément.

### 6.1 — Trois paliers de repli, tous implémentés côté 3D uniquement

1. **Palier 0 — WebGL2 indisponible** (`perf/detectionWebGL2.ts`) : testé une seule fois, avant même de monter le `<Canvas>` R3F, en tentant `canvas.getContext('webgl2')`. Si `null`, affichage immédiat de l'écran de repli (`components/EcranRepli.tsx`), avec un lien cliquable vers l'URL de la version 2D.
2. **Palier 1 — `prefers-reduced-motion`** (`hooks/useAnimationReduite.ts`, écoute `matchMedia`) : reste en 3D, mais caméra verrouillée sur un plan aérien fixe, foule immobile, positions appliquées sans lissage animé (voir §4.2). Vérifié empiriquement : les captures d'écran à N secondes d'intervalle sont pixel-identiques sauf quand une vraie mise à jour de données arrive.
3. **Palier 2 — sentinelle de performance** (`perf/SentinellePerformance.ts`) : mesure le temps de frame lissé (moyenne exponentielle) ; sous ~30 fps soutenus pendant 5 s, dégrade progressivement — post-traitement retiré → foule réduite de moitié → ombres désactivées → si toujours insuffisant, même écran de repli que le palier 0 (raison différente affichée). **La dégradation ne remonte jamais** : un poste qui a ramé une fois reste dégradé pour le reste de la session.

En complément, un **bouton de repli manuel** existe (`components/PanneauReglages.tsx`, panneau « Réglages ») pour basculer proactivement vers la 2D sur un poste connu à l'avance comme faible, sans attendre la détection automatique.

### 6.2 — Configuration de l'URL de repli

```
VITE_RACE_PULSE_2D_URL=https://url-de-la-version-2d-deployee
```
Lu une seule fois, exporté depuis `src/perf/urlRepli2D.ts`, consommé à la fois par `EcranRepli.tsx` (automatique) et `PanneauReglages.tsx` (manuel). Si la variable n'est pas définie, l'écran de repli affiche un message d'aide au lieu du lien (jamais d'URL cassée).

### 6.3 — Implications pour l'intégration Next.js — **décision à prendre, pas encore tranchée**

Le code actuel suppose que la 2D est déployée **ailleurs**, à une URL externe. Deux options pour l'intégration Next.js, ni l'une ni l'autre implémentée aujourd'hui :

- **(a) Garder la séparation** : déployer la 2D comme un second petit projet (Vite SPA, quasiment sans dépendance) sur Vercel, indépendamment de l'app Next.js principale ; ne porter que la 3D dans Next.js ; renseigner `NEXT_PUBLIC_RACE_PULSE_2D_URL` (ou équivalent) vers cette URL externe. C'est le portage le plus fidèle au comportement actuel, le plus rapide à faire.
- **(b) Unifier** : porter aussi la 2D comme une route interne de la même app Next.js (`/race-pulse/2d` par exemple), et remplacer le lien `<a href={URL_REPLI_2D}>` par un `<Link>` Next.js interne. Demande de porter `race-pulse` (2D) en plus de `race-pulse-3d`, mais élimine une dépendance à un déploiement externe et simplifie le repli (navigation interne au lieu d'un rechargement complet de page).

**Ce document ne tranche pas ce choix** — c'est une décision produit à confirmer avec le porteur du projet avant de commencer le portage, car elle change le périmètre du travail (un seul dépôt à porter vs deux).

---

## 7. Dépendances installées — détail et rôle

### 7.1 — `race-pulse-3d` (3D), `dependencies` (à réinstaller telles quelles dans l'app Next.js)

| Paquet | Version | Rôle |
| --- | --- | --- |
| `react`, `react-dom` | `^19.2.7` | Déjà en v19 — vérifier la compatibilité avec la version de React utilisée par l'app Next.js cible avant de fusionner les `node_modules`. |
| `three` | `^0.185.1` | Moteur de rendu WebGL. Version récente — l'API Three.js change vite entre versions majeures (« r-xxx ») ; ne pas mettre à jour sans retester tout le rendu 3D. |
| `@react-three/fiber` | `^9.6.1` | Reconciler React ↔ Three.js. |
| `@react-three/drei` | `^10.7.7` | Utilitaires R3F (`useGLTF`, `Billboard`, `Text`...). |
| `@react-three/postprocessing` | `^3.0.4` | Wrapper R3F pour `EffectComposer`/`Bloom`/`Vignette`. |
| `postprocessing` | `^6.39.4` | Dépendance directe de bas niveau (jamais importée directement dans le code du projet — présente pour figer la résolution de version, car `@react-three/postprocessing` la requiert en interne à `^6.36.6`). |

### 7.2 — `race-pulse-3d`, `devDependencies` (build-time / vérification uniquement — **ne pas exposer côté client, ne pas ajouter aux dépendances de production de l'app Next.js**)

| Paquet | Rôle | Nécessaire à l'exécution ? |
| --- | --- | --- |
| `vite`, `@vitejs/plugin-react`, `typescript`, `oxlint` | Outillage de build/lint du SPA Vite actuel — **disparaît** lors du portage dans Next.js (remplacé par la chaîne de build Next.js elle-même). | Non |
| `@gltf-transform/cli`, `@gltf-transform/core`, `@gltf-transform/functions` | Pipeline d'optimisation d'assets glTF (`scripts/optimiser-assets.mjs`), exécuté **hors ligne**, une fois par asset, jamais au runtime. | Non — mais utile à garder si de nouveaux modèles 3D sont ajoutés plus tard. |
| `playwright` | Scripts de vérification visuelle par capture d'écran (`scripts/capture-*.mjs`, `scripts/valider-repli.mjs`...) — **jamais importé par le code applicatif**. Utile pour re-valider le rendu après le portage. | Non |
| `@types/*` | Typage TypeScript. | Non (dev uniquement) |

`sharp` a été utilisé ponctuellement en ligne de commande pendant le développement (recadrage de captures de diagnostic) mais **n'est pas dans `package.json`** — invoqué via `npx`/déjà présent dans le cache npm local. Si les scripts `scripts/audit-memoire.mjs` ou `scripts/*.mjs` doivent être conservés, ajouter `sharp` en devDependency. Ne pas s'inquiéter d'une collision : Next.js embarque déjà `sharp` en interne pour `next/image`, aucun conflit à prévoir si la version reste raisonnablement proche.

### 7.3 — `race-pulse` (2D)

Dépendances minimales : `react` + `react-dom` en production, `vite` + `typescript` + `oxlint` en dev. Aucune dépendance graphique. Le portage de la 2D (si l'option (b) du §6.3 est retenue) est nettement plus simple que celui de la 3D — essentiellement du SVG + de la logique pure.

### 7.4 — Assets

- `public/modeles/vehicules/kart-race-pulse.glb` — **58 Ko**, optimisé Meshopt (`gltf-transform optimize`, sans fusion de matériaux — voir §9 pour pourquoi c'est critique). C'est le seul asset 3D externe au code aujourd'hui. À copier tel quel dans `public/` de l'app Next.js (Next.js sert `public/` nativement, sans configuration).
- `assets-source/vehicules/kart-race-pulse.blend` — fichier Blender source, committé pour permettre une ré-édition future. **Ne pas tenter de le régénérer** sans Blender + l'add-on communautaire `ahujasid/blender-mcp` (utilisé pour la modélisation initiale). Le `.glb` déjà optimisé dans `public/` se suffit à lui-même pour l'intégration.
- Aucune texture externe, aucun asset CC0 (Kenney/Quaternius/Poly Pizza) n'a finalement été utilisé — la foule, le décor, la piste sont entièrement générés par géométrie procédurale en code (voir `src/scene/stade/`), pas de fichiers à copier pour ces éléments.

---

## 8. Charge et hébergement Vercel — points critiques

### 8.1 — Rendu 100% client, aucun SSR possible pour la 3D

Three.js/WebGL nécessite `window`, `document` et un contexte GPU — **inexistants côté serveur**. Toute tentative de rendu serveur (SSR/SSG) du composant 3D fera échouer le build Next.js ou produira une page vide.

**Obligatoire lors du portage :**
```tsx
'use client'
// ...
```
sur le composant racine de la scène, **et** l'importer depuis la page via :
```tsx
import dynamic from 'next/dynamic'
const RacePulse3D = dynamic(() => import('@/components/race-pulse/App'), { ssr: false })
```
Sans le `ssr: false`, Next.js tentera quand même un pré-rendu côté serveur du composant au moment du build, qui échouera dès le premier appel à `document.createElement('canvas')` (dans `perf/detectionWebGL2.ts`) ou au montage du `<Canvas>` R3F.

### 8.2 — Aucune charge sur les fonctions serverless Vercel pour le rendu lui-même

Le rendu 3D (calcul de scène, animation, post-traitement) tourne **entièrement dans le navigateur du client** (GPU/CPU du poste qui affiche l'écran). Aucun appel à une fonction Vercel n'est impliqué dans le rendu — pas de risque de cold start, de timeout de fonction, ni de facturation de compute liée à l'affichage 3D en tant que tel.

### 8.3 — La vraie charge réseau : le modèle de sondage (polling) de `SourceApi`

`SourceApi.interroger()` fait un `fetch` toutes les **10 secondes**, en continu, tant qu'un onglet est ouvert et qu'au moins un composant est abonné. C'est un modèle de **sondage périodique côté client**, pas du push/WebSocket.

- Pour l'usage prévu (quelques écrans muraux de centre d'appels, pas un site public à fort trafic), c'est négligeable : quelques requêtes par minute au total, quel que soit le nombre d'écrans (de l'ordre de 1 à 10).
- **Point d'attention si le contexte change** (l'app Next.js cible dessert potentiellement beaucoup plus de visiteurs simultanés que quelques écrans internes) : si la route interrogée est elle-même une fonction Vercel qui interroge à son tour un vrai backend, chaque écran ouvert génère indépendamment un appel toutes les 10 s vers cette fonction. À grande échelle, envisager un cache court (`revalidate`/ISR sur la route, ou un cache en mémoire/Edge Config partagé entre requêtes) plutôt que de laisser chaque client déclencher son propre appel amont — non fait aujourd'hui, à évaluer selon le nombre réel d'écrans cibles.
- Le simulateur (`SimulateurCourse`), lui, ne fait **aucun appel réseau** : tout est calculé en mémoire côté client, avec un timer JS (`setTimeout` auto-replanifié toutes les 8–15 s). Zéro charge serveur tant que la vraie API n'est pas branchée.

### 8.4 — Taille du bundle JS

Le build Vite actuel produit **un seul chunk d'environ 1,3 Mo non compressé (≈ 395 Ko gzip)** — Vite avertit lui-même du dépassement du seuil recommandé (500 Ko/chunk), Three.js + R3F + drei + postprocessing pesant l'essentiel. Ce n'est **pas anormal** pour une stack 3D, mais deux points à surveiller lors du portage :
- Utiliser `next/dynamic(..., { ssr: false })` (§8.1) fait automatiquement du **code-splitting** : ce chunk ne sera chargé que par les visiteurs de la route Race Pulse, jamais par le reste de l'app Next.js — c'est déjà une amélioration par rapport au SPA Vite actuel où tout est dans le bundle initial.
- Ne pas importer `three`/`@react-three/*` depuis un fichier partagé/chargé globalement (layout racine, etc.) — cela romprait le code-splitting et alourdirait toutes les pages de l'app.

### 8.5 — Poste d'affichage : contrainte matérielle, pas contrainte Vercel

Le budget de performance visé (voir `perf/SentinellePerformance.ts`) cible un **poste sans GPU dédié** (graphique intégré), plancher 30 fps. C'est une contrainte côté client (le PC/écran mural), sans rapport avec l'hébergement Vercel — mais à connaître si Codex doit choisir des réglages qualité par défaut (`dpr`, ombres, nombre de spectateurs instanciés).

---

## 9. Points critiques et dépendances extrêmes — à ne pas casser en portant le code

Cette section liste les pièges déjà rencontrés et corrigés pendant le développement. Les reproduire ferait régresser des bugs déjà résolus.

1. **`gltf-transform optimize` fusionne les matériaux par défaut (« palette »).** Si le `.glb` du kart est un jour ré-optimisé, la fusion de palette **supprime les noms de matériaux** et casse la teinte par agent (`KartRacePulse.tsx` cherche un matériau nommé `Carrosserie`). Voir `SANS_PALETTE` dans `scripts/optimiser-assets.mjs` pour l'exclusion déjà en place. **Ne jamais ré-exécuter l'optimiseur sur ce fichier sans cette exclusion.**

2. **La sprite de flamme de boost (`scene/FlammeBoost.tsx`) a `depthTest={false}` volontairement.** Elle est ancrée au ras de la géométrie du kart (sortie du pot d'échappement) ; avec le test de profondeur activé, le châssis l'occulte selon l'angle de caméra (bug constaté et corrigé pendant le développement — la flamme était quasi invisible). Ne pas « corriger » ce réglage sans revérifier visuellement.

3. **`InstancedMesh.setColorAt()` (Three.js) combiné à R3F rend les instances entièrement noires** (bug documenté de la communauté pmndrs/react-three-fiber#2854). `scene/stade/Foule.tsx` contourne ce problème en construisant directement l'attribut `instanceColor`. Ne **jamais** ajouter `vertexColors` sur ce matériau (casse à nouveau tout en noir — piège distinct, documenté en commentaire dans le fichier).

4. **`EffectComposer` (`@react-three/postprocessing`) n'accepte que des effets comme enfants directs.** Un enfant conditionnel du type `{condition ? <Bloom/> : <></>}` casse silencieusement tout le rendu (constaté : ciel qui devient noir). `scene/PostTraitement.tsx` utilise deux `return` JSX distincts plutôt qu'une condition interne — pattern à conserver si ce composant est modifié.

5. **`performance.memory.usedJSHeapSize` est inutilisable pour détecter des fuites mémoire dans Chromium** — la valeur s'est révélée figée/quantifiée (probablement pour limiter l'empreinte numérique du navigateur), y compris sous charge réelle. Utiliser `Runtime.getHeapUsage` via le protocole CDP à la place (voir `scripts/audit-memoire.mjs`) pour tout futur audit mémoire.

6. **WebGL2 est un prérequis dur, sans repli interne.** Aucun mode de rendu alternatif (WebGL1, Canvas 2D) n'existe dans le dépôt 3D — le seul repli est une redirection externe vers la 2D (§6). Si la cible d'intégration doit fonctionner sur du matériel très ancien/verrouillé, c'est une contrainte à anticiper, pas un simple réglage.

7. **`KartPlaceholder.tsx` est du code mort** (formes primitives Three.js utilisées en Phase 1, remplacées par `KartRacePulse.tsx` en Phase 4) — encore présent dans le dépôt mais plus importé nulle part. À ne pas porter, ou à supprimer.

8. **Le simulateur utilise une graine aléatoire fixe** (`creerAleatoire(20260729)` dans `SimulateurCourse.ts`) : la démo est reproductible d'un lancement à l'autre (mêmes agents, mêmes scores de départ) tant que le code n'est pas modifié. Ce n'est pas un vrai hasard cryptographique — sans conséquence pour ce produit, mais à savoir si quelqu'un s'étonne que « la course recommence toujours pareil ».

9. **Discipline stricte domaine/rendu** : `src/domain/` (2D comme 3D) **n'importe jamais** de type React ni Three.js — uniquement des calculs purs sur des nombres/vecteurs bruts. Cette séparation est ce qui a permis de forker `circuit.ts` → `circuit3d.ts` sans toucher à `classement.ts`. À préserver si le code est restructuré : ne pas laisser des imports Three.js remonter dans `domain/`.

---

## 10. Recommandation de portage dans Next.js — étapes concrètes

1. **Décider du périmètre** (§6.3) : 3D seule avec 2D restant externe (a), ou les deux portées en interne (b). Confirmer avec le porteur produit avant de commencer.
2. **Copier telles quelles** les couches `domain/`, `data/`, `hooks/` du dépôt 3D (et de la 2D si option b) dans l'app Next.js — zéro changement de logique attendu.
3. **Copier** `src/scene/`, `src/camera/`, `src/perf/`, `src/components/` (3D) sous un dossier dédié (ex. `components/race-pulse-3d/`).
4. **Créer une page/route dédiée** (`app/.../race-pulse/page.tsx`) qui importe le composant racine via `next/dynamic({ ssr: false })` (§8.1).
5. **Traduire les variables d'environnement** : `import.meta.env.VITE_RACE_PULSE_API_URL` et `VITE_RACE_PULSE_2D_URL` n'existent pas dans Next.js (`import.meta.env` est spécifique à Vite). Remplacer par `process.env.NEXT_PUBLIC_*` **uniquement si la valeur peut être publique** — pour l'URL de la vraie API du centre d'appels, préférer une Route Handler serveur (§5.3) plutôt qu'exposer l'URL au client.
6. **Copier** `public/modeles/` et `public/favicon.svg` dans le `public/` de l'app Next.js.
7. **Isoler le CSS** (`src/index.css`, classes génériques type `.carte`, `.bouton`, variables CSS `--vert-nuit` etc.) dans un module ou une feuille de style scopée à la route Race Pulse — **ne pas fusionner dans un `globals.css` partagé** si l'app cible a déjà son propre système de design (risque de collision de noms de classes).
8. **Ajouter les dépendances de production** du §7.1 au `package.json` de l'app Next.js, en gardant les versions testées ici. Ne **pas** ajouter les devDependencies du §7.2 aux dépendances de production.
9. **Revalider visuellement** après portage — les scripts Playwright de `scripts/` (notamment `valider-repli.mjs` pour les 3 paliers de repli, `capture-tablette.mjs` pour le responsive, `capture-multi-navigateurs.mjs` pour le cross-browser) peuvent être adaptés pour pointer vers la nouvelle URL Next.js plutôt que réécrits de zéro.

---

## 11. Référence rapide — scripts utiles du dépôt 3D

| Script | Usage |
| --- | --- |
| `npm run dev` | Serveur de développement Vite (actuel, disparaît après portage) |
| `npm run build` | Vérifie les types puis build de production |
| `npm run assets:optimiser` | Optimise les `.glb` bruts de `assets-source/` vers `public/modeles/` (Meshopt + WebP) |
| `node scripts/valider-repli.mjs <dossier-sortie>` | Vérifie les 3 paliers de repli (WebGL2, reduced-motion, sentinelle) |
| `node scripts/capture-multi-navigateurs.mjs <dossier>` | Vérifie le rendu WebGL2 sur Chromium/Firefox/WebKit |
| `node scripts/capture-tablette.mjs <dossier>` | Captures à 3 tailles de viewport tablette |
| `node scripts/audit-memoire.mjs [cycles]` | Stress-test mémoire accéléré (CDP `Runtime.getHeapUsage`) |

Tous nécessitent le serveur de dev lancé sur `http://localhost:5199` (ou ajuster l'URL en tête de chaque script) et `npx playwright install` (Chromium déjà présent par défaut ; Firefox/WebKit à installer explicitement si besoin).
