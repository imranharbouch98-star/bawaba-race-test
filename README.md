# Race Pulse 3D — La performance prend la piste

Version 3D de [race-pulse](../race-pulse) : même concept, même moteur de
score, même règle « un kart ne recule jamais » — la piste, le décor et les
karts sont maintenant rendus en 3D (Three.js / React Three Fiber) au lieu
du SVG 2D. Dépôt Git séparé, voir la justification dans le plan
d'implémentation : `~/.claude/plans/peut-on-essayer-de-distributed-fox.md`.

## État actuel : Phases 1 à 5 (proto + stade + caméras + marque/post-traitement + durcissement kiosque)

Ce qui fonctionne aujourd'hui :

- Piste 3D générée depuis la géométrie du domaine, lignes de départ et
  d'arrivée, bordures de voie.
- Jusqu'à trente karts branchés sur le **vrai simulateur** — mêmes données, mêmes
  règles que la version 2D. Modèle de marque glTF (Phase 4) : kart modélisé
  dans Blender (source `assets-source/vehicules/kart-race-pulse.blend`),
  optimisé Meshopt (~58 Ko), carrosserie teintée aux couleurs de chaque
  agent via son matériau nommé `Carrosserie`.
- Stade : deux tribunes (gradins en escalier), foule animée (spectateurs
  instanciés, balancement d'ambiance, ~900 places), arche et panneaux de
  marque en 3D (texte repris du contenu 2D), arbres, ciel procédural.
- **Réalisateur de caméra automatique** (`camera/`) : quatre plans — aérien
  (orbite lente et continue), embarqué (derrière le leader du moment), spot
  (sur l'agent visé par un dépassement/boost/objectif) et podium (ligne
  d'arrivée, sur un record). Coupes propres entre plans, jamais de dérive
  continue entre deux cadrages différents ; durée plancher de 5 s par plan ;
  priorité record > dépassement > boost > objectif ; un changement de
  période ou une nouvelle journée force un recadrage aérien. Plus d'orbite
  manuelle à la souris : c'est la mise en scène qui pilote la caméra.
- Panneau latéral complet réutilisé tel quel : classement, podium,
  sélecteur de période, fil d'événements, commandes du kart invité,
  explications.
- Écran de repli si WebGL2 est indisponible (invite à ouvrir la version 2D).
- `prefers-reduced-motion` respecté : caméra rigoureusement figée sur un plan
  aérien fixe, positions et balancement de la foule figés, aucune coupe.

Ajouts de la Phase 4 :

- **Post-traitement** (`scene/PostTraitement.tsx`) : bloom (seuil de
  luminance 1 — seuls les karts en boost, matériau émissif poussé à 2.4,
  produisent un halo) + vignette légère. Deux passes, conformément au budget
  du plan (§8).
- **Boost visible** : la logique de traînée 2D (tendance > seuil) pilote
  maintenant l'émissif des karts ; le kart invité s'illumine aussi pendant
  son boost clavier.
- **Sentinelle de performance** (`perf/SentinellePerformance.ts`) : sous
  30 fps soutenus (lissage exponentiel, confirmation 5 s), dégradation par
  paliers — post-traitement retiré → foule réduite de moitié → ombres
  coupées → écran de repli vers la 2D. `?sans-sentinelle` dans l'URL la
  neutralise (diagnostic, captures sur rendu logiciel).
- Panneaux de signalétique en face avant uniquement (`material-side` =
  `FrontSide` sur les `<Text>` drei) — plus de texte miroir vu de dos.

Ajouts de la Phase 5 (durcissement kiosque) :

- **Flamme de boost** (`scene/FlammeBoost.tsx`) : sprite billboard, texture
  procédurale en shader (bruit + dégradé, pas de flipbook à sourcer),
  ancrée à la sortie du pot d'échappement modélisé sur le kart, `depthTest`
  désactivé (sinon occultée par la géométrie du kart selon l'angle de
  caméra — bug constaté et corrigé). Coupée au même palier de qualité que
  le post-traitement.
- **Dispose des matériaux clonés par kart** (`KartRacePulse.tsx`) au
  démontage — portée pratique faible aujourd'hui (roster d'agents
  statique) mais correcte si la liste d'agents devient un jour dynamique.
- **Layout responsive** déjà en place depuis les phases précédentes
  (points de rupture 1180px/640px/1900px dans `index.css`) — vérifié sur
  trois tailles tablette (portrait 768, paysage 1024, limite 1180) : le
  panneau latéral s'empile sous la scène 3D en dessous de 1180px. Cibles
  tactiles des boutons portées à 44px minimum (WCAG/tablette).
- **Vérification multi-navigateurs** : rendu WebGL2 confirmé sans erreur
  console sur Chromium, Firefox et WebKit (Playwright).
- **Bouton de repli manuel** (`components/PanneauReglages.tsx`, §5 du
  plan) : bascule vers la 2D en un clic, en complément de la détection
  automatique, pour les postes connus à l'avance comme faibles. URL
  partagée avec `EcranRepli.tsx` via `perf/urlRepli2D.ts`.
- **Audit mémoire** : `data/SimulateurCourse.ts` et `hooks/useInstantane.ts`
  déjà propres (événements plafonnés, abonnement avec désabonnement
  correct — hérités du code 2D). Stress-test accéléré (`scripts/audit-memoire.mjs`,
  montage/démontage répété du kart invité + CDP `Runtime.getHeapUsage`) :
  la croissance du tas décélère et se stabilise en plateau — signature
  d'un échauffement de caches, pas d'une fuite linéaire.
- **Validation finale des 3 paliers de repli** (`scripts/valider-repli.mjs`) :
  WebGL2 indisponible, `prefers-reduced-motion` (vérifié figé — écarts de
  pixels nuls sauf quand le classement change réellement,
  `scripts/diag-reduit.mjs`), sentinelle de performance sous CPU bridé.
  Aucune régression.

Race Pulse 3D a maintenant complété les 5 phases du plan d'implémentation.

## Test de charge 10 / 20 / 30 agents

Le panneau « Test de charge 3D » permet de changer l'effectif simulé à chaud
entre 10, 20 et 30 agents. Le mode 30 agents est sélectionné par défaut. Le
choix est aussi reflété dans l'URL (`?agents=10`, `?agents=20` ou
`?agents=30`) afin de reproduire facilement un test.

Le panneau affiche une télémétrie WebGL actualisée une fois par seconde : FPS,
temps moyen et pire temps d'image, draw calls, triangles, textures, DPR et nom
du GPU communiqué par le navigateur. Un navigateur web ne fournit pas de
pourcentage fiable d'utilisation GPU ; pour cette valeur, compléter le test
avec le gestionnaire des tâches du navigateur ou les outils système.

La dégradation automatique peut être coupée depuis le panneau afin d'observer
la charge maximale sans passage aux paliers allégés. Le bouton « Réinitialiser
la qualité » remet immédiatement tous les effets visuels.

### Piège Three.js/R3F rencontré en Phase 2 (documenté dans `scene/stade/Foule.tsx`)

`InstancedMesh.setColorAt()` combiné à React Three Fiber rend les instances
entièrement noires (bug connu de la communauté). Le contournement — construire
soi-même l'attribut `instanceColor` — fonctionne, **mais** ajouter
`vertexColors` sur le matériau casse à nouveau tout en noir : ce flag attend
un attribut `color` par SOMMET (absent ici), distinct de la couleur par
INSTANCE qui s'applique automatiquement dès que `instanceColor` existe, avec
n'importe quel matériau (éclairé ou non). En bref : ne mettez jamais
`vertexColors` avec `InstancedMesh.instanceColor`.

### Pièges rencontrés en Phase 4

- **`gltf-transform optimize` fusionne les matériaux** (« palette ») : les
  noms disparaissent et la teinte par agent devient impossible. Les assets
  listés dans `SANS_PALETTE` (`scripts/optimiser-assets.mjs`) échappent à
  cette fusion — le kart en fait partie.
- **`EffectComposer` n'accepte que des effets comme enfants** : préférez
  des retours JSX distincts à une condition `{x ? <effet/> : <></>}` dans
  ses enfants (`scene/PostTraitement.tsx`).
- **Captures Playwright : ne jamais cliquer pendant une capture d'élément.**
  `locator.click()` fait défiler la page vers le bouton ; si des clics
  répétés (setInterval) courent pendant `locator('canvas').screenshot()`,
  la zone capturée est contaminée par le défilement (frames noires
  trompeuses — une après-midi de fausse piste). Cliquer via
  `page.evaluate(el.click())`, qui ne défile pas.
- **Ombres « manquantes » dans le virage +X : fausse piste aussi** — le
  soleil est haut (y = 0.78), l'ombre est courte et tombe sous le châssis ;
  selon l'azimut de la caméra elle se voit à peine. Le frustum d'ombre
  ±120 couvre bien tout l'anneau (offset latéral max ~94 unités, vérifié
  par calcul).

## Lancer le projet

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # vérifie les types puis produit dist/
npm run preview  # sert le build de production
npm run lint      # oxlint
```

## Architecture

Même séparation `data → domain → scene/components` que la version 2D.
Le détail complet (fichiers copiés à l'identique, fichiers forkés, fichiers
entièrement nouveaux) est dans le plan d'implémentation, §6. En bref :

```
src/
├── domain/           types.ts et classement.ts copiés tels quels depuis
│                     race-pulse (2D) ; circuit3d.ts est le fork 3D de la
│                     géométrie de piste (topologie identique, rendu neuf)
├── data/             copié tel quel — simulateur, source API, agents
├── hooks/             copiés tels quels (seul l'import de CIRCUIT change
│                     de fichier, pas de logique)
├── scene/            NOUVEAU — piste, karts, moteur d'animation useFrame,
│                     conversion pose → transform Three.js
│   └── stade/        tribunes, foule instanciée, signalétique, arbres
├── camera/           NOUVEAU — machine à états pure (machineCamera.ts) +
│                     hook useFrame qui l'exploite (RealisateurCamera.ts)
├── components/       panneau latéral copié tel quel + écran de repli
└── perf/             détection WebGL2 (le futur SentinellePerformance de
                      la Phase 4 vivra ici aussi)
```

## Assets

Aucun modèle externe pour l'instant (Phase 1 = formes primitives). Le
pipeline d'optimisation est déjà en place et vérifié :

```bash
# Placez des .glb/.gltf bruts dans assets-source/, puis :
npm run assets:optimiser
```

Chaque asset externe ajouté à `public/modeles/` doit être consigné dans
`public/modeles/LICENCES.md` (source, auteur, licence CC0).

## Brancher les données réelles

Identique à la version 2D : `VITE_RACE_PULSE_API_URL` dans `.env.local`
bascule `creerSourceDonnees()` sur l'API réelle, sans changement de code.
`VITE_RACE_PULSE_2D_URL` configure le lien de l'écran de repli vers la
version 2D déployée séparément.

## Propriété intellectuelle

Comme la version 2D : aucun personnage, véhicule ou décor issu d'un jeu
commercial existant. Les futurs assets CC0 (Kenney, Quaternius, Poly Pizza)
sont tracés dans `public/modeles/LICENCES.md`.

En production, `VITE_RACE_PULSE_API_URL` (env Vercel) pointe sur le endpoint
`/api/game/leaderboard` du dashboard — sans elle, le simulateur prend le relais.
