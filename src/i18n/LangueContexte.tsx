/**
 * Langue de l'interface — NL par défaut (la langue du plateau), bascule EN.
 *
 * Le choix persiste par navigateur (`localStorage`), ce qui suffit pour un
 * écran mural configuré une fois. Même modèle que le LangContext de
 * salesdash, en plus petit : pas de rôle, pas de session, juste la langue.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LANGUES, TEXTES, type Langue, type Textes } from './textes'

const CLE_STOCKAGE = 'race-pulse:langue'
const LANGUE_DEFAUT: Langue = 'nl'

function lireLangueInitiale(): Langue {
  try {
    const valeur = window.localStorage.getItem(CLE_STOCKAGE)
    return (LANGUES as readonly string[]).includes(valeur ?? '') ? (valeur as Langue) : LANGUE_DEFAUT
  } catch {
    return LANGUE_DEFAUT
  }
}

interface ContexteLangue {
  langue: Langue
  textes: Textes
  changerLangue: (langue: Langue) => void
}

const Contexte = createContext<ContexteLangue>({
  langue: LANGUE_DEFAUT,
  textes: TEXTES[LANGUE_DEFAUT],
  changerLangue: () => undefined,
})

export function FournisseurLangue({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>(lireLangueInitiale)

  const changerLangue = useCallback((suivante: Langue) => {
    setLangue(suivante)
    try {
      window.localStorage.setItem(CLE_STOCKAGE, suivante)
    } catch {
      // Stockage refusé (navigation privée) : la bascule vaut pour la session.
    }
  }, [])

  // L'attribut lang du document suit la langue choisie — lecteurs d'écran et
  // césure du navigateur en dépendent.
  useEffect(() => {
    document.documentElement.lang = langue
  }, [langue])

  return (
    <Contexte.Provider value={{ langue, textes: TEXTES[langue], changerLangue }}>
      {children}
    </Contexte.Provider>
  )
}

export function useLangue(): ContexteLangue {
  return useContext(Contexte)
}

/** Raccourci : la grande majorité des composants ne lisent que les textes. */
export function useTextes(): Textes {
  return useLangue().textes
}
