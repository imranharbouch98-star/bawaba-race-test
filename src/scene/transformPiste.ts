/**
 * Conversion d'une pose de piste (vecteurs bruts du domaine) vers une
 * transformation Three.js. C'est la SEULE couche autorisée à importer Three —
 * `domain/circuit3d.ts` n'en connaît rien, conformément à la discipline du
 * reste du projet.
 *
 * Deux familles de fonctions :
 *
 *  - `ecrire…DepuisPose(pose, sortie)` — écrit dans un objet fourni par
 *    l'appelant et n'alloue rien. À utiliser dans toute boucle `useFrame`.
 *  - `…DepuisPose(pose)` — alloue et renvoie un objet neuf. Réservé aux
 *    calculs faits une seule fois, à la construction (voir `Piste3D`), où
 *    la lisibilité prime.
 *
 * Pourquoi cette distinction : à trente karts, la version allouante coûtait
 * onze objets Three par kart et par image, soit environ vingt mille objets
 * par seconde. Ce n'est pas leur taille qui pose problème mais leur débit —
 * il alimente le ramasse-miettes en continu et produit des à-coups de
 * quelques millisecondes à intervalles imprévisibles, exactement le genre de
 * pic que remonte le « pire temps d'image » du panneau.
 */

import { Matrix4, Quaternion, Vector3 } from 'three'
import type { PosePiste3D } from '../domain/circuit3d'

// Tampons de travail au niveau module. JavaScript étant mono-thread et ces
// fonctions n'étant appelées que depuis la boucle de rendu, il n'y a pas de
// réentrance possible : chaque appel a fini d'utiliser les tampons avant que
// le suivant ne commence. Ils ne sont jamais renvoyés à l'appelant.
const tamponAvant = new Vector3()
const tamponHaut = new Vector3()
const tamponDroite = new Vector3()
const tamponHautApproche = new Vector3()
const tamponMatrice = new Matrix4()

/**
 * Écrit dans `sortie` le quaternion d'orientation d'un kart à partir de sa pose.
 *
 * Convention (identique au kart 2D « dessiné orienté vers les X positifs ») :
 * l'axe local +X du modèle pointe vers l'avant, +Y vers le haut. La troisième
 * direction (« droite » du kart) est déduite par produit vectoriel plutôt que
 * stockée, ce qui reste correct même quand `haut` s'inclinera plus tard pour
 * simuler un dévers en virage.
 */
export function ecrireQuaternionDepuisPose(pose: PosePiste3D, sortie: Quaternion): Quaternion {
  tamponAvant.set(pose.avant.x, pose.avant.y, pose.avant.z).normalize()
  tamponHautApproche.set(pose.haut.x, pose.haut.y, pose.haut.z)
  tamponDroite.crossVectors(tamponAvant, tamponHautApproche).normalize()
  tamponHaut.crossVectors(tamponDroite, tamponAvant).normalize()

  tamponMatrice.makeBasis(tamponAvant, tamponHaut, tamponDroite)
  return sortie.setFromRotationMatrix(tamponMatrice)
}

export function ecrirePositionDepuisPose(pose: PosePiste3D, sortie: Vector3): Vector3 {
  return sortie.set(pose.position.x, pose.position.y, pose.position.z)
}

export function ecrireAvantDepuisPose(pose: PosePiste3D, sortie: Vector3): Vector3 {
  return sortie.set(pose.avant.x, pose.avant.y, pose.avant.z).normalize()
}

export function ecrireHautDepuisPose(pose: PosePiste3D, sortie: Vector3): Vector3 {
  return sortie.set(pose.haut.x, pose.haut.y, pose.haut.z).normalize()
}

/**
 * Écrit dans `sortie` la direction « à droite du kart » en cet endroit de la
 * piste — même produit vectoriel que dans `ecrireQuaternionDepuisPose`, pour
 * rester cohérent avec l'orientation réellement appliquée aux karts. Utile au
 * réalisateur de caméra pour décaler un plan latéralement (plan « spot »).
 */
export function ecrireDroiteDepuisPose(pose: PosePiste3D, sortie: Vector3): Vector3 {
  ecrireAvantDepuisPose(pose, tamponAvant)
  ecrireHautDepuisPose(pose, tamponHautApproche)
  return sortie.crossVectors(tamponAvant, tamponHautApproche).normalize()
}

/* --- Variantes allouantes, pour les calculs faits une seule fois ---------- */

export function quaternionDepuisPose(pose: PosePiste3D): Quaternion {
  return ecrireQuaternionDepuisPose(pose, new Quaternion())
}

export function positionDepuisPose(pose: PosePiste3D): Vector3 {
  return ecrirePositionDepuisPose(pose, new Vector3())
}

export function avantDepuisPose(pose: PosePiste3D): Vector3 {
  return ecrireAvantDepuisPose(pose, new Vector3())
}

export function hautDepuisPose(pose: PosePiste3D): Vector3 {
  return ecrireHautDepuisPose(pose, new Vector3())
}

export function droiteDepuisPose(pose: PosePiste3D): Vector3 {
  return ecrireDroiteDepuisPose(pose, new Vector3())
}
