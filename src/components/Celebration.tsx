/**
 * La célébration plein écran (demande user 26/08) : quand un objectif tombe
 * ou que la production grimpe, une carte éclate au MILIEU de la vue 3D pour
 * attirer l'œil du plateau — puis s'efface seule. Une seule à la fois ;
 * l'App tient la file. DOM pur : coût graphique nul pour la scène.
 */

export interface CelebrationAffichee {
  genre: 'objectif' | 'scorePlus'
  titre: string
  sousTitre: string
  couleur: string
}

export function Celebration({ fete }: { fete: CelebrationAffichee | null }) {
  if (!fete) return null
  return (
    <div className={`celebration celebration--${fete.genre}`} role="status" key={`${fete.titre}-${fete.sousTitre}`}>
      <div className="celebration__carte" style={{ borderColor: fete.couleur }}>
        <span className="celebration__eclat" aria-hidden style={{ color: fete.couleur }}>
          {fete.genre === 'objectif' ? '🏆' : '⚡'}
        </span>
        <p className="celebration__titre">{fete.titre}</p>
        <p className="celebration__sous" style={{ color: fete.couleur }}>{fete.sousTitre}</p>
      </div>
    </div>
  )
}
