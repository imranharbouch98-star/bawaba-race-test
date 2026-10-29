export interface MesurePerformance3D {
  fps: number
  tempsImageMs: number
  pireImageMs: number
  appelsRendu: number
  triangles: number
  geometries: number
  textures: number
  dpr: number
  gpu: string
}

export const MESURE_PERFORMANCE_INITIALE: MesurePerformance3D = {
  fps: 0,
  tempsImageMs: 0,
  pireImageMs: 0,
  appelsRendu: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  dpr: 1,
  gpu: 'Détection en cours…',
}
