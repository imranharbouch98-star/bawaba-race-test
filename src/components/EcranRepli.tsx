/**
 * Écran de repli — réservé aux cas où la 3D ne PEUT pas tourner : WebGL2
 * absent ou contexte GPU perdu. Une machine simplement lente n'arrive plus
 * ici : l'échelle de qualité descend jusqu'à la « 3D minimale » à la place
 * (décision produit 24/08 : pas de version 2D, pas d'écran bloquant).
 */

import { useTextes } from '../i18n/LangueContexte'

export type RaisonRepli =
  | 'webgl2-indisponible'
  | 'performance-insuffisante'
  | 'contexte-perdu'

interface ProprietesEcranRepli {
  raison: RaisonRepli
}

export function EcranRepli({ raison }: ProprietesEcranRepli) {
  const textes = useTextes()

  return (
    <div className="repli" role="alert">
      <span className="repli__logo" aria-hidden="true">
        <span className="repli__logo-pouls" />
      </span>
      <h1 className="repli__titre">Bawaba Race</h1>
      <p className="repli__message">{textes.messagesRepli[raison]}</p>
    </div>
  )
}
