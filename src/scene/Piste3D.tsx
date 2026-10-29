/**
 * Maillage de la piste : ruban plat extrudé depuis la géométrie du domaine,
 * bordures rouge/blanc façon vibreurs, lignes de voies en pointillés.
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { CIRCUIT, type PisteCircuit } from '../domain/circuit3d'
import { positionDepuisPose, quaternionDepuisPose } from './transformPiste'

/** Plus de segments que sur l'ancien ovale : les pistes modélisées font 1,3–1,6 km. */
const SEGMENTS = 800

function construireGeometriePiste(piste: PisteCircuit): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= SEGMENTS; i += 1) {
    const s = (i / SEGMENTS) * piste.longueurTour
    const interieur = piste.pointSurPiste3D(s, -piste.demiLargeurVoies)
    const exterieur = piste.pointSurPiste3D(s, piste.demiLargeurVoies)
    positions.push(interieur.position.x, interieur.position.y, interieur.position.z)
    positions.push(exterieur.position.x, exterieur.position.y, exterieur.position.z)

    if (i < SEGMENTS) {
      const a = i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometrie = new THREE.BufferGeometry()
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometrie.setIndex(indices)
  geometrie.computeVertexNormals()
  return geometrie
}

/**
 * Vibreur rouge et blanc suivant un bord de la piste.
 *
 * Chaque bande est un quad INDÉPENDANT (ses 4 sommets ne sont partagés avec
 * aucune bande voisine), et tous ses sommets portent la MÊME couleur.
 * Piège évité ici : une couleur par sommet le long d'un ruban CONTINU
 * s'interpole en douceur entre deux sommets voisins de couleurs
 * différentes — le GPU ne sait pas qu'on voulait une transition nette, et
 * la bordure ressort floue, surtout visible de près. Dupliquer les sommets
 * à chaque frontière de bande supprime toute interpolation entre bandes.
 */
function construireVibreur(piste: PisteCircuit, decalageCentre: number): THREE.BufferGeometry {
  const largeur = 0.9
  const longueurBande = 2.6
  const nombreBandes = Math.round(piste.longueurTour / longueurBande)
  const positions: number[] = []
  const couleurs: number[] = []
  const indices: number[] = []
  const rouge = new THREE.Color('#e2493a')
  const blanc = new THREE.Color('#f4f7f5')

  for (let bande = 0; bande < nombreBandes; bande += 1) {
    const s0 = (bande / nombreBandes) * piste.longueurTour
    const s1 = ((bande + 1) / nombreBandes) * piste.longueurTour
    const teinte = bande % 2 === 0 ? rouge : blanc

    const int0 = piste.pointSurPiste3D(s0, decalageCentre - largeur / 2)
    const ext0 = piste.pointSurPiste3D(s0, decalageCentre + largeur / 2)
    const int1 = piste.pointSurPiste3D(s1, decalageCentre - largeur / 2)
    const ext1 = piste.pointSurPiste3D(s1, decalageCentre + largeur / 2)

    const base = positions.length / 3
    // Hauteur de la ROUTE (+2 cm) et non une hauteur fixe : sur une piste
    // en relief, les vibreurs à y = 0.02 flottaient ou s'enterraient.
    positions.push(int0.position.x, int0.position.y + 0.02, int0.position.z)
    positions.push(ext0.position.x, ext0.position.y + 0.02, ext0.position.z)
    positions.push(int1.position.x, int1.position.y + 0.02, int1.position.z)
    positions.push(ext1.position.x, ext1.position.y + 0.02, ext1.position.z)

    for (let k = 0; k < 4; k += 1) couleurs.push(teinte.r, teinte.g, teinte.b)

    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
  }

  const geometrie = new THREE.BufferGeometry()
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometrie.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3))
  geometrie.setIndex(indices)
  geometrie.computeVertexNormals()
  return geometrie
}

/** Points d'une ligne de voie (pointillée), suivant le tracé en boucle fermée. */
function pointsLigneVoie(piste: PisteCircuit, decalage: number, hauteur: number): [number, number, number][] {
  const points: [number, number, number][] = []
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const s = (i / SEGMENTS) * piste.longueurTour
    const pose = piste.pointSurPiste3D(s, decalage)
    points.push([pose.position.x, pose.position.y + hauteur, pose.position.z])
  }
  return points
}

/**
 * Barre perpendiculaire à la piste (ligne de départ, ligne d'arrivée).
 *
 * Orientée avec la même fonction `quaternionDepuisPose` que les karts : local
 * +X (« avant ») s'aligne sur le sens de la piste, donc une boîte fine selon
 * X et large selon Z (« droite ») donne exactement une barre en travers,
 * quelle que soit la portion de circuit — pas de rotation devinée à la main.
 */
function BarreTravers({ piste, abscisse, couleur }: { piste: PisteCircuit; abscisse: number; couleur: string }) {
  const pose = useMemo(() => piste.pointSurPiste3D(abscisse), [piste, abscisse])
  const position = useMemo(() => positionDepuisPose(pose), [pose])
  const quaternion = useMemo(() => quaternionDepuisPose(pose), [pose])

  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[0.5, 0.06, piste.demiLargeurVoies * 2]} />
      <meshStandardMaterial color={couleur} />
    </mesh>
  )
}

export function Piste3D({ piste }: { piste: PisteCircuit }) {
  const geometriePiste = useMemo(() => construireGeometriePiste(piste), [piste])
  const geometrieVibreurInt = useMemo(() => construireVibreur(piste, -piste.demiLargeurVoies), [piste])
  const geometrieVibreurExt = useMemo(() => construireVibreur(piste, piste.demiLargeurVoies), [piste])

  // Une ligne pointillée à chaque séparation entre deux voies (nombreVoies - 1).
  const pointsVoies = useMemo(
    () =>
      Array.from({ length: CIRCUIT.nombreVoies - 1 }, (_, i) => {
        const decalage = -piste.demiLargeurVoies + (i + 1) * piste.largeurVoie
        return pointsLigneVoie(piste, decalage, 0.025)
      }),
    [piste],
  )

  return (
    <group>
      <mesh geometry={geometriePiste} receiveShadow>
        <meshStandardMaterial color="#22272e" roughness={0.95} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      <mesh geometry={geometrieVibreurInt}>
        <meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometrieVibreurExt}>
        <meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} />
      </mesh>

      {pointsVoies.map((points, i) => (
        <Line key={i} points={points} color="#f4f7f5" lineWidth={1.2} dashed dashSize={1.4} gapSize={1.4} />
      ))}

      {/* Une seule barre depuis le passage au modèle en tours : sur un
          circuit bouclé, départ et arrivée sont la même ligne. L'ancienne
          barre d'arrivée, posée aux trois quarts du tour, ne correspondait
          plus à rien — les karts la franchissent désormais sans s'arrêter et
          poursuivent dans le dernier virage, qui était jusqu'ici toujours
          vide. */}
      <BarreTravers piste={piste} abscisse={0} couleur="#f4f7f5" />
    </group>
  )
}
