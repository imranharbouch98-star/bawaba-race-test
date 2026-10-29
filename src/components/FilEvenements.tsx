import { formaterHeure } from '../domain/classement'
import type { EvenementCourse, TypeEvenement } from '../domain/types'
import { useTextes } from '../i18n/LangueContexte'

const ICONES: Record<TypeEvenement, string> = {
  depart: '🏁',
  depassement: '↗️',
  boost: '⚡',
  record: '🏆',
  objectif: '🎯',
  ralentissement: '〰️',
}

interface ProprietesFil {
  evenements: EvenementCourse[]
  miseAJour: number
}

/**
 * Le texte de chaque événement (`evenement.message`) vient tel quel de la
 * couche données — des fichiers copiés du dépôt 2D qu'on ne fait pas dériver.
 * Ce panneau n'apparaît qu'en développement ou derrière `localStorage.show`,
 * jamais sur l'écran mural de production.
 */
export function FilEvenements({ evenements, miseAJour }: ProprietesFil) {
  const textes = useTextes()

  return (
    <section className="carte fil" aria-label={textes.faitsDeCourse}>
      <div className="carte__entete">
        <h2 className="carte__titre">{textes.faitsDeCourse}</h2>
        <span className="carte__note">{textes.misAJourA(formaterHeure(miseAJour))}</span>
      </div>

      {evenements.length === 0 ? (
        <p className="fil__vide">{textes.filVide}</p>
      ) : (
        <ul className="fil__liste">
          {evenements.map((evenement) => (
            <li key={evenement.id} className={`fil__item fil__item--${evenement.type}`}>
              <span className="fil__icone" aria-hidden="true">
                {ICONES[evenement.type]}
              </span>
              <span className="fil__texte">{evenement.message}</span>
              <time className="fil__heure" dateTime={new Date(evenement.horodatage).toISOString()}>
                {formaterHeure(evenement.horodatage)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
