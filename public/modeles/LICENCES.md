# Registre de licences — assets 3D

Condition directe de la contrainte produit « aucun asset copiant un jeu
commercial existant » (voir CLAUDE/AGENTS du projet d'origine et §4 du plan
d'implémentation). **Chaque modèle externe ajouté à `public/modeles/` doit
avoir une ligne ici avant d'être committé.**

Sources autorisées pour les assets génériques (décor, foule, véhicules non
identitaires) : [Kenney](https://kenney.nl) (CC0), [Quaternius](https://quaternius.com)
(CC0), [Poly Pizza](https://poly.pizza) (vérifier la licence par modèle — pas
tout le catalogue n'est CC0). Les pièces de marque (kart « Race Pulse »,
signalétique) sont modélisées sur mesure et n'ont pas besoin d'entrée ici.

| Fichier (`public/modeles/…`) | Source | Auteur | Licence | Date d'ajout | Modifications |
| --- | --- | --- | --- | --- | --- |
| `circuit/snoep-circuit.glb` | Fichier `map_tgsd.glb` (export Sketchfab 16.72) fourni par l'équipe le 29/10 (`assets-source/circuit/candy-source.glb`, non commité) | **Inconnu** | ⚠️ **À CONFIRMER — risque élevé.** Indices d'un modèle EXTRAIT d'un jeu commercial : noms en pinyin (`tgsd` = *tángguǒ sàidào*, « circuit de bonbons »), mini-carte (`mini_map_road`), surface de collision invisible, matériaux « unlit » de jeu mobile. Contraire à la règle ci-dessus tant que la source et la licence ne sont pas établies. Ne pas mettre en production avant confirmation. | 2026-10-29 | Mini-carte et maillages invisibles retirés, ×50, recentré ; aucune simplification, textures natives 1024 en WebP, Meshopt 16 bits ; ligne médiane, sauts et zones extraits (`scripts/preparer-piste-snoep.mjs`). |
| `vehicules/niveaux/*.glb` (9 fichiers : `kruiwagen`, `sedan-klassiek`, `bolle-wagen`, `limousine`, `sedan-roze`, `cabrio`, `lowrider`, `stretch-limo`, `hello-kitty`) + `vehicules/vignettes/*.webp` | Dossier « levels » envoyé par le chef de projet (`assets-source/vehicules/bruts/`, non commité) | Généré par IA (Tripo AI) | ⚠️ **À CONFIRMER** — usage commercial selon le plan Tripo. Points à valider : figurines Hello Kitty sur les tableaux de bord des levels 5 et 9 (personnage sous licence Sanrio) ; ressemblance VW Coccinelle (level 3) ; logo sur la brouette ; plaques d'immatriculation. Le level 6 reçu est **Hello Kitty elle-même** (personnage Sanrio, marque protégée) : placé en dernier level de la boutique à la demande de l'équipe (27/10) — **usage commercial d'un personnage Sanrio à faire valider explicitement** ; pas de level 7 reçu. | 2026-10-27 | Réorientés (avant +X), posés au sol, mis à l'échelle ; simplifiés à ~10 000 triangles ; textures WebP, Meshopt (`scripts/preparer-vehicules.mjs` puis `npm run assets:optimiser`) ; vignettes rendues depuis le modèle (`preparer-vehicules.mjs vignettes`). |
| `vehicules/niveaux/{appeltaart,dessert-taart,wafelauto,gevulde-chariot,dessert-auto}.glb` + leurs vignettes | Dossier « candy cars » fourni par l'équipe le 29/10 (`assets-source/vehicules/bruts/`, non commité) | Vraisemblablement généré par IA (même format que le dossier « levels » : ~1,9 M triangles, ~55 Mo) | ⚠️ **À CONFIRMER** — source et licence d'usage commercial. | 2026-10-29 | Réorientés (avant +X), posés au sol, mis à l'échelle (les trois plus trapus raccourcis pour rester sous 1,9 m de large) ; simplifiés à ~10 000 triangles ; textures WebP, Meshopt. Levels 1–5 de la boutique. Les véhicules `kruiwagen`, `sedan-klassiek` et `bolle-wagen` sont désactivés à la vente (`VEHICULES_DESACTIVES`), fichiers conservés. |

_`vehicules/kart-race-pulse.glb` est une pièce de marque modélisée sur mesure dans Blender (source `assets-source/vehicules/kart-race-pulse.blend`), hors périmètre de ce registre._

**Régénérer la piste** (source non commitée) : copier `map_tgsd.glb` en `assets-source/circuit/candy-source.glb`, puis `node scripts/preparer-piste-snoep.mjs preparer`, `npm run assets:optimiser -- circuit/` et `node scripts/preparer-piste-snoep.mjs tracer`.

_Pistes retirées le 29/10 : « Drift Track Short » (Fab, licence Standard du client) et le circuit du désert (IA) — voir l'historique git._
