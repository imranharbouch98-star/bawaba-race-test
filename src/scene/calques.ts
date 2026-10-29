/**
 * Calques Three.js propres à l'application. Le calque 0 est celui du rendu ;
 * les autres ne servent qu'aux rayons (un objet peut être sur plusieurs).
 */

/**
 * Décor capable de cacher un kart à la caméra : les maillages opaques de la
 * piste (`PisteModele`). Ni le ciel, ni les effets translucides, ni les
 * karts et leurs plaques — c'est ce que teste `RealisateurCamera`.
 */
export const CALQUE_OCCULTANT = 1

/** Nom du modèle de piste dans la scène — la caméra y lance ses rayons. */
export const NOM_PISTE_MODELE = 'piste-modele'
