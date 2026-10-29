/**
 * Plaque d'identification d'un agent, ancrée au kart mais toujours tournée
 * vers la caméra. Le contenu ne change qu'avec le classement ; seuls la
 * visibilité et le scale sont ajustés directement dans Three.js à chaque
 * frame afin d'éviter un rendu React continu.
 */

import { memo, useCallback, useMemo, useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Color, Group, MathUtils, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three'

const POSITION_ETIQUETTE: [number, number, number] = [0, 1.35, 0]

// L'échelle croît avec la distance, ce qui maintient une taille apparente
// constante à l'écran. En très gros plan la plaque rétrécit au lieu de
// masquer le kart ; le plafond, lui, ne sert qu'à éviter qu'elle devienne
// absurde — il était à 2,8, atteint dès 154 unités, si bien que les karts du
// côté opposé du circuit en plan aérien (jusqu'à ~250) rapetissaient à vue.
const ECHELLE_MIN = 0.32
// Piste Fab : le plan aérien recule jusqu'à ~500 m (soit 9 avec le diviseur
// ci-dessous) — l'ancien plafond de 4,4 rapetissait les plaques de moitié.
const ECHELLE_MAX = 11
const DIVISEUR_ECHELLE = 55

/** Marges entre le texte et le bord de la plaque. */
const MARGE_HORIZONTALE = 0.34
const MARGE_VERTICALE = 0.2

/** Plancher de taille, pour que les plaques très courtes restent des plaques. */
const LARGEUR_MINIMALE = 1.6
const HAUTEUR_MINIMALE = 0.9

const TAILLE_TEXTE = 0.58
const LONGUEUR_NOM_MAX = 16

/**
 * Dégradé continu or → argent → bronze selon la place : chaque rang a sa
 * propre nuance (« très or, un peu moins or, or argenté… »), si bien que
 * l'ordre se lit d'un coup d'œil sans désigner personne — même la dernière
 * place porte une médaille. Les trois métaux étant clairs, le texte est
 * foncé partout.
 */
const OR = new Color('#f6c445')
// Argent foncé et légèrement froid : un gris clair et neutre, coincé entre
// deux métaux saturés, se lisait comme du blanc.
const ARGENT = new Color('#7f8894')
const BRONZE = new Color('#c47a3a')
const COULEUR_TEXTE = '#1a1408'

/**
 * Géométrie unique partagée par toutes les plaques : un carré unitaire, mis
 * à l'échelle en largeur ET en hauteur par instance. Deux bénéfices sur
 * trente agents — une géométrie au lieu de trente, et aucune reconstruction
 * quand la plaque change de dimensions.
 *
 * Passée via `<primitive>`, donc jamais libérée par R3F : c'est voulu, elle
 * vit aussi longtemps que l'application.
 */
const GEOMETRIE_FOND = new PlaneGeometry(1, 1)

/** Ce que `onSync` de drei nous transmet, réduit à ce qu'on utilise. */
interface TroikaText {
  material: MeshBasicMaterial
  textRenderInfo?: { blockBounds: [number, number, number, number] }
}

interface ProprietesEtiquetteAgent {
  nom: string
  initiales: string
  rang: number
  /** Nombre de karts classés — borne le dégradé or → bronze. */
  total: number
  /** Leader ou kart en boost : plaque plus opaque. */
  miseEnAvant?: boolean
  /** Kart choisi dans la liste : plaque agrandie, cerclée, au-dessus des autres. */
  selectionne?: boolean
  /** Un AUTRE kart est choisi : la plaque s'efface pour laisser ressortir l'élu. */
  attenue?: boolean
  /** Hauteur de la plaque au-dessus du sol (m) — plus haute sur une berline que sur le kart. */
  hauteur?: number
}

/** Mise en évidence du kart choisi. */
const AGRANDISSEMENT_SELECTION = 1.6
const COULEUR_CADRE_SELECTION = '#22d3ee'
/** Épaisseur du cadre autour de la plaque choisie (unités de plaque). */
const EPAISSEUR_CADRE = 0.18
const OPACITE_ATTENUEE = 0.35

function compacterNom(nom: string): string {
  const parties = nom.trim().split(/\s+/).filter(Boolean)
  if (parties.length === 0) return 'Agent'

  const [prenom, ...suite] = parties
  const dernierePartie = suite.at(-1)
  const nomCourt = dernierePartie ? `${prenom} ${dernierePartie.charAt(0)}.` : prenom

  return nomCourt.length <= LONGUEUR_NOM_MAX
    ? nomCourt
    : `${nomCourt.slice(0, LONGUEUR_NOM_MAX - 1)}…`
}

/**
 * Couleur de plaque d'un rang : 0 = premier (or pur), 1 = dernier (bronze),
 * l'argent au milieu du peloton. Calculée hors rendu.
 */
function couleurRang(rang: number, total: number): Color {
  const t = total > 1 ? MathUtils.clamp((rang - 1) / (total - 1), 0, 1) : 0
  return t < 0.5
    ? new Color().lerpColors(OR, ARGENT, t * 2)
    : new Color().lerpColors(ARGENT, BRONZE, (t - 0.5) * 2)
}

export const EtiquetteAgent = memo(function EtiquetteAgent({
  nom,
  rang,
  total,
  miseEnAvant = false,
  selectionne = false,
  attenue = false,
  hauteur = POSITION_ETIQUETTE[1],
}: ProprietesEtiquetteAgent) {
  const racineRef = useRef<Group | null>(null)
  const fondRef = useRef<Mesh | null>(null)
  const cadreRef = useRef<Mesh | null>(null)
  const positionMondeRef = useRef(new Vector3())

  const nomAffiche = compacterNom(nom)
  const fond = useMemo(() => couleurRang(rang, total), [rang, total])

  // « P1 », « P2 »… : la convention des retransmissions de course, demandée
  // par Maya pour lire la position au-dessus de chaque kart sans ambiguïté.
  // Toujours le nom (prénom + initiale), quelle que soit la distance : plus
  // de bascule en initiales — « un nom au-dessus de chaque véhicule ».
  const texte = `P${rang}  ${nomAffiche}`

  /**
   * Appelé par troika après chaque composition du texte.
   *
   * La plaque est dimensionnée sur les bornes RÉELLES du texte rendu plutôt
   * que sur une formule à base de nombre de caractères. Cette formule ne
   * pouvait pas être juste : la largeur d'un nom dépend des glyphes (« Wl »
   * n'occupe pas la place de « il »), et surtout elle ignorait le passage à
   * la ligne — un nom trop long produisait deux lignes de texte dans un fond
   * resté à hauteur fixe, donc des lettres débordant sous la plaque.
   *
   * `blockBounds` vaut [minX, minY, maxX, maxY] dans le repère du texte ;
   * l'ancrage étant centré, ces bornes sont symétriques et se transposent
   * directement en échelle du fond.
   */
  const ajusterPlaque = useCallback((troika: TroikaText) => {
    troika.material.depthTest = false
    troika.material.depthWrite = false
    troika.material.toneMapped = false

    const bornes = troika.textRenderInfo?.blockBounds
    const plaque = fondRef.current
    if (!bornes || !plaque) return

    plaque.scale.set(
      Math.max(LARGEUR_MINIMALE, bornes[2] - bornes[0] + MARGE_HORIZONTALE * 2),
      Math.max(HAUTEUR_MINIMALE, bornes[3] - bornes[1] + MARGE_VERTICALE * 2),
      1,
    )
    cadreRef.current?.scale.set(
      plaque.scale.x + EPAISSEUR_CADRE * 2,
      plaque.scale.y + EPAISSEUR_CADRE * 2,
      1,
    )
  }, [])

  useFrame(({ camera }) => {
    const racine = racineRef.current
    if (!racine) return

    racine.getWorldPosition(positionMondeRef.current)
    const distance = camera.position.distanceTo(positionMondeRef.current)
    const echelle = MathUtils.clamp(distance / DIVISEUR_ECHELLE, ECHELLE_MIN, ECHELLE_MAX)
    // L'agrandissement ne sert que de loin (plan d'ensemble) : en caméra
    // embarquée derrière le kart choisi, une plaque 1,6× masquait la piste.
    const agrandissement = selectionne
      ? 1 + (AGRANDISSEMENT_SELECTION - 1) * MathUtils.smoothstep(distance, 20, 60)
      : 1
    racine.scale.setScalar(echelle * agrandissement)
  })

  // La plaque choisie passe AU-DESSUS de toutes les autres (ordre de rendu),
  // toutes étant dessinées sans test de profondeur.
  const ordre = selectionne ? 1010 : 1000

  return (
    <group ref={racineRef} position={[0, hauteur, 0]}>
      <Billboard follow>
        <mesh ref={cadreRef} renderOrder={ordre} visible={selectionne}>
          <primitive object={GEOMETRIE_FOND} attach="geometry" />
          <meshBasicMaterial
            color={COULEUR_CADRE_SELECTION}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh ref={fondRef} renderOrder={ordre + 1}>
          <primitive object={GEOMETRIE_FOND} attach="geometry" />
          <meshBasicMaterial
            color={fond}
            transparent
            opacity={attenue ? OPACITE_ATTENUEE : miseEnAvant || selectionne ? 0.98 : 0.94}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {/*
          Pas d'`outlineWidth` — et ce n'est pas un détail cosmétique.

          Dès que troika a un contour, son getter `material` renvoie un
          TABLEAU `[matériauContour, matériauTexte]` reconstruit à chaque
          lecture, et la géométrie déclare deux groupes. Conséquences :
          - deux draw calls par plaque au lieu d'un ;
          - les props percées `material-depthTest` & co. de R3F écrivaient
            sur ce tableau temporaire, aussitôt jeté. Elles n'avaient donc
            AUCUN effet : le texte restait testé en profondeur (masqué par
            un kart au premier plan, alors que son fond restait visible) et
            passait par le tone mapping, ce qui faisait changer sa teinte
            au moment précis où la sentinelle coupe le post-traitement.

          La couleur de l'agent, que portait `outlineColor`, est reprise
          par la teinte du fond de plaque ci-dessus.

          Les drapeaux sont désormais posés dans `onSync`, sur le vrai
          matériau — unique en l'absence de contour — et réappliqués après
          chaque re-typesetting.
        */}
        <Text
          position={[0, 0, 0.02]}
          renderOrder={ordre + 2}
          fontSize={TAILLE_TEXTE}
          color={COULEUR_TEXTE}
          fillOpacity={attenue ? OPACITE_ATTENUEE + 0.15 : 1}
          anchorX="center"
          anchorY="middle"
          whiteSpace="nowrap"
          letterSpacing={0.015}
          onSync={ajusterPlaque}
        >
          {texte}
        </Text>
      </Billboard>
    </group>
  )
})
