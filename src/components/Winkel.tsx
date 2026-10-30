/**
 * Onglet « Winkel » : connexion par le nom, puis la vitrine (garage 3D de
 * ses véhicules), le portefeuille et la boutique (un véhicule par level,
 * achetés dans l'ordre). Vu par les agents — aucun mot « race » à l'écran.
 */

import { useRef, useState, type FormEvent } from 'react'
import {
  CATALOGUE,
  niveauAgent,
  prochainVehicule,
  REGLES_PIECES,
  solde,
  vehiculeChoisi,
  vehiculesPossedes,
  type Mouvement,
  type Vehicule,
} from '../domain/portefeuille'
import type { Agent } from '../domain/types'
import type { Portefeuille } from '../hooks/usePortefeuille'
import { useLangue, useTextes } from '../i18n/LangueContexte'
import { Vitrine } from './Vitrine'

/** Nombre de mouvements affichés dans l'historique. */
const HISTORIQUE_AFFICHE = 8

export function Winkel({ portefeuille }: { portefeuille: Portefeuille }) {
  const { agent } = portefeuille
  if (!agent) return <Connexion connecter={portefeuille.connecter} />
  return <Boutique portefeuille={portefeuille} agent={agent} />
}

/**
 * Boutique d'un agent connecté. En haut, la VITRINE (garage 3D) : ses
 * véhicules un à un (flèches), et « Kiezen » pour conduire celui affiché.
 * En faisant défiler : portefeuille et boutique — un clic sur un véhicule de
 * la boutique le montre dans la vitrine avant de l'acheter.
 */
function Boutique({ portefeuille, agent }: { portefeuille: Portefeuille; agent: Agent }) {
  const textes = useTextes()
  const { etat } = portefeuille
  const possedes = vehiculesPossedes(etat, agent.id)
  const enUsage = vehiculeChoisi(etat, agent.id)
  const prochain = prochainVehicule(etat, agent.id)
  const monSolde = solde(etat, agent.id)
  const monNiveau = niveauAgent(etat, agent.id)
  const historique = etat.mouvements
    .filter((m) => m.agentId === agent.id)
    .sort((a, b) => b.horodatage - a.horodatage)
    .slice(0, HISTORIQUE_AFFICHE)

  // Véhicule montré dans la vitrine : un des siens (on démarre sur celui
  // qu'il conduit), ou l'aperçu d'un véhicule de la boutique.
  const [montre, setMontre] = useState(enUsage)
  const [apercu, setApercu] = useState<string | null>(null)
  const section = useRef<HTMLElement>(null)
  const affiche = apercu ?? (possedes.includes(montre) ? montre : enUsage)
  const indexGarage = Math.max(0, possedes.indexOf(affiche))

  const parcourir = (sens: number) => {
    setApercu(null)
    setMontre(possedes[(indexGarage + sens + possedes.length) % possedes.length])
  }
  const montrerApercu = (id: string) => {
    if (possedes.includes(id)) {
      setApercu(null)
      setMontre(id)
    } else {
      setApercu(id)
    }
    section.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Bouton d'achat d'un véhicule du catalogue — partagé par la vitrine et la liste. */
  const etatAchat = (vehicule: Vehicule) => {
    const index = CATALOGUE.indexOf(vehicule)
    const possede = possedes.includes(vehicule.id)
    const achetable = prochain?.id === vehicule.id
    const manque = vehicule.prix - monSolde
    // Un seul bouton actif : le prochain level, s'il est payable.
    // Un véhicule verrouillé renvoie au level juste avant lui.
    const libelle = possede
      ? textes.enPossession
      : !achetable
        ? textes.deverrouillerAvant(CATALOGUE[index - 1]?.niveau ?? vehicule.niveau)
        : manque > 0
          ? textes.encoreMunten(manque)
          : textes.acheterBouton(vehicule.prix)
    return { possede, achetable, manque, libelle }
  }
  const boutonAchat = (vehicule: Vehicule) => {
    const { possede, achetable, manque, libelle } = etatAchat(vehicule)
    return (
      <button
        type="button"
        className={`bouton${achetable && manque <= 0 ? ' bouton--principal' : ''}`}
        disabled={possede || !achetable || manque > 0}
        onClick={() => {
          // Acheté depuis la vitrine : il rejoint le garage et y reste affiché.
          if (!portefeuille.acheter(vehicule.id) && apercu === vehicule.id) {
            setApercu(null)
            setMontre(vehicule.id)
          }
        }}
      >
        {libelle}
      </button>
    )
  }

  const vehiculeApercu = apercu ? CATALOGUE.find((v) => v.id === apercu) : undefined
  const niveauAffiche = CATALOGUE.find((v) => v.id === affiche)?.niveau ?? 0

  return (
    <section ref={section} className="winkel" aria-label={textes.ongletWinkel}>
      <div className="winkel__entete">
        <h2 className="winkel__bonjour">
          <span className="winkel__pastille" style={{ backgroundColor: agent.couleur }} aria-hidden="true">
            {agent.initiales}
          </span>
          {textes.bonjour(agent.nom)}
          <span className="winkel__badge winkel__badge--niveau">{textes.niveau(monNiveau)}</span>
        </h2>
        <button type="button" className="bouton" onClick={portefeuille.deconnecter}>
          {textes.deconnexion}
        </button>
      </div>

      <div className="vitrine" aria-label={textes.garageTitre}>
        <Vitrine vehiculeId={affiche} couleur={agent.couleur} />

        <div className="vitrine__haut">
          <span className="winkel__badge">{apercu ? textes.apercuBoutique : textes.garageTitre}</span>
          {!apercu && possedes.length > 1 && (
            <span className="vitrine__compteur">
              {indexGarage + 1} / {possedes.length}
            </span>
          )}
        </div>

        {!apercu && possedes.length > 1 && (
          <>
            <button type="button" className="vitrine__fleche vitrine__fleche--gauche" aria-label={textes.vehiculePrecedent} onClick={() => parcourir(-1)}>
              ‹
            </button>
            <button type="button" className="vitrine__fleche vitrine__fleche--droite" aria-label={textes.vehiculeSuivant} onClick={() => parcourir(1)}>
              ›
            </button>
          </>
        )}

        <div className="vitrine__bas">
          <span className="vitrine__nom">
            <strong>{textes.nomVehicule(affiche)}</strong>
            <span className="winkel__niveau">{textes.niveau(niveauAffiche)}</span>
          </span>
          <span className="vitrine__actions">
            {vehiculeApercu ? (
              <>
                <button type="button" className="bouton" onClick={() => setApercu(null)}>
                  {textes.terugNaarGarage}
                </button>
                {boutonAchat(vehiculeApercu)}
              </>
            ) : affiche === enUsage ? (
              <span className="winkel__badge">{textes.vehiculeEnUsage}</span>
            ) : (
              <button type="button" className="bouton bouton--principal" onClick={() => portefeuille.choisir(affiche)}>
                {textes.vehiculeChoisir}
              </button>
            )}
          </span>
        </div>
      </div>

      <p className="vitrine__defiler" aria-hidden="true">
        {textes.defilerNaarWinkel}
      </p>

      <div className="winkel__grille">
        <article className="carte">
          <h3 className="carte__titre">{textes.boutiqueTitre}</h3>
          {CATALOGUE.length === 0 ? (
            <p className="winkel__vide">{textes.boutiqueVide}</p>
          ) : (
            <ul className="winkel__vehicules">
              {CATALOGUE.map((vehicule) => {
                const { possede, achetable } = etatAchat(vehicule)
                return (
                  <li
                    key={vehicule.id}
                    className={`winkel__vehicule winkel__vehicule--boutique${possede ? ' est-possede' : ''}${!possede && !achetable ? ' est-verrouille' : ''}${vehicule.id === affiche ? ' est-montre' : ''}`}
                  >
                    {/* Vignette + nom : un clic le montre dans la vitrine. */}
                    <button
                      type="button"
                      className="winkel__apercu"
                      aria-label={textes.bekijkInGarage(textes.nomVehicule(vehicule.id))}
                      onClick={() => montrerApercu(vehicule.id)}
                    >
                      <Vignette id={vehicule.id} />
                      <span className="winkel__vehicule-nom">
                        <strong>{textes.nomVehicule(vehicule.id)}</strong>
                        <span className="winkel__niveau">
                          {textes.niveau(vehicule.niveau)} · <span className="winkel__prix">{textes.munten(vehicule.prix)}</span>
                        </span>
                      </span>
                    </button>
                    {boutonAchat(vehicule)}
                  </li>
                )
              })}
            </ul>
          )}
        </article>

        <article className="carte winkel__portefeuille">
          <h3 className="carte__titre">{textes.portefeuilleTitre}</h3>
          <p className="winkel__solde">
            <span className="winkel__piece" aria-hidden="true" />
            {textes.munten(monSolde)}
          </p>

          {portefeuille.aujourdhui && (
            <div className="winkel__aujourdhui">
              <span className="winkel__etiquette">{textes.aujourdhuiTitre}</span>
              <strong>{textes.aujourdhuiDetail(portefeuille.aujourdhui.km, portefeuille.aujourdhui.pieces)}</strong>
              <JaugeJour pieces={portefeuille.aujourdhui.pieces} />
            </div>
          )}
          <p className="winkel__regle">{textes.regleMunten(REGLES_PIECES.piecesParKm, REGLES_PIECES.maxParJour)}</p>

          <h4 className="winkel__sous-titre">{textes.historiqueTitre}</h4>
          {historique.length === 0 ? (
            <p className="winkel__vide">{textes.historiqueVide}</p>
          ) : (
            <ul className="winkel__historique">
              {historique.map((mouvement) => (
                <LigneHistorique key={mouvement.id} mouvement={mouvement} />
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}

function Connexion({ connecter }: { connecter: (nom: string) => boolean }) {
  const textes = useTextes()
  const [nom, setNom] = useState('')
  const [inconnu, setInconnu] = useState(false)

  const valider = (evenement: FormEvent) => {
    evenement.preventDefault()
    setInconnu(!connecter(nom))
  }

  return (
    <section className="winkel winkel--connexion" aria-label={textes.connexionTitre}>
      <form className="carte winkel__connexion" onSubmit={valider}>
        <h2 className="carte__titre">{textes.connexionTitre}</h2>
        <p className="winkel__regle">{textes.connexionUitleg}</p>
        <label className="winkel__champ">
          <span>{textes.connexionChamp}</span>
          <input
            type="text"
            value={nom}
            autoComplete="name"
            autoFocus
            onChange={(evenement) => {
              setNom(evenement.target.value)
              setInconnu(false)
            }}
            aria-invalid={inconnu}
          />
        </label>
        {inconnu && (
          <p className="winkel__erreur" role="alert">
            {textes.connexionInconnu}
          </p>
        )}
        <button type="submit" className="bouton bouton--principal" disabled={!nom.trim()}>
          {textes.connexionBouton}
        </button>
      </form>
    </section>
  )
}

/**
 * Image d'un véhicule, rendue depuis son modèle 3D (`preparer-vehicules.mjs
 * vignettes`). Le kart de départ n'a pas de fichier : une pastille neutre.
 */
function Vignette({ id }: { id: string }) {
  if (id === 'kart-standaard') return <span className="winkel__vignette winkel__vignette--kart" aria-hidden="true" />
  return <img className="winkel__vignette" src={`/modeles/vehicules/vignettes/${id}.webp`} alt="" loading="lazy" />
}

/** Jauge des pièces du jour vers le plafond — pour voir où l'on en est. */
function JaugeJour({ pieces }: { pieces: number }) {
  const part = Math.min(1, pieces / REGLES_PIECES.maxParJour)
  return (
    <span className="winkel__jauge" aria-hidden="true">
      <span style={{ width: `${part * 100}%` }} />
    </span>
  )
}

function LigneHistorique({ mouvement }: { mouvement: Mouvement }) {
  const { langue, textes } = useLangue()
  // La langue de l'écran (NL/EN), pas celle du navigateur du poste.
  const locale = langue === 'nl' ? 'nl-BE' : 'en-GB'
  const date = new Date(mouvement.horodatage).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const heure = new Date(mouvement.horodatage).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return (
    <li className="winkel__ligne">
      <span className="winkel__date">
        {date} {heure}
      </span>
      <span>
        {mouvement.type === 'gain' ? textes.gainLigne(mouvement.km) : textes.achatLigne(textes.nomVehicule(mouvement.vehiculeId))}
      </span>
      <strong className={mouvement.montant >= 0 ? 'winkel__plus' : 'winkel__moins'}>
        {mouvement.montant >= 0 ? '+' : ''}
        {mouvement.montant}
      </strong>
    </li>
  )
}
