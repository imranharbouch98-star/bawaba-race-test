/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de l'API du centre d'appels. Absente → le simulateur est utilisé. */
  readonly VITE_RACE_PULSE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
