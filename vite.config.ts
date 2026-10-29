import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiSimulee } from './scripts/apiSimulee'

// https://vite.dev/config/
export default defineConfig({
  // `apiSimulee` ne s'active qu'en développement (`apply: 'serve'`) : elle
  // sert le simulateur en HTTP pour éprouver `SourceApi`, le client réel,
  // qui sans cela ne s'exécuterait jamais avant l'arrivée de la vraie API.
  plugins: [react(), apiSimulee()],
})
