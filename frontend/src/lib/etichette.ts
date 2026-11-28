import type { Speaker, Tipologia } from '@/gql/graphql'

// Etichette di speaker e tipologia (F-AS-03: l'interfaccia mostra le etichette, mai i codici).
// Stanno qui, e non in episodi.ts, perché questo modulo non importa GraphQL a runtime: lo usano
// anche il template Excel e i suoi test con `bun test`, che girano senza browser e senza server.

export const SPEAKER: readonly { valore: Speaker; etichetta: string }[] = [
  { valore: 'TUTT', etichetta: 'Tutti' },
  { valore: 'BORD', etichetta: 'Matteo Bordone (corri!)' },
  { valore: 'FOSS', etichetta: 'Francesco Fossetti (salta!)' },
  { valore: 'ZAMP', etichetta: 'Alessandro Zampini (spara!)' },
]

export const TIPOLOGIA: readonly { valore: Tipologia; etichetta: string }[] = [
  { valore: 'FREE', etichetta: 'Chiacchiera libera' },
  { valore: 'RECE', etichetta: 'Recensione' },
  { valore: 'CONS', etichetta: 'Consiglio' },
  { valore: 'STAR', etichetta: 'Osservatorio Star Citizen' },
]
