// Choices delle associazioni, come in euscitojoypad_db/backoffice/models.py
export const SPEAKER_CHOICES = [
  { id: "TUTT", name: "Tutti" },
  { id: "BORD", name: "Matteo Bordone (corri!)" },
  { id: "FOSS", name: "Francesco Fossetti (salta!)" },
  { id: "ZAMP", name: "Alessandro Zampini (spara!)" },
];

export const TIPOLOGIA_CHOICES = [
  { id: "FREE", name: "Chiacchiera libera" },
  { id: "RECE", name: "Recensione" },
  { id: "CONS", name: "Consiglio" },
  { id: "STAR", name: "Osservatorio Start Citizen" },
];

// meta.detail separa la cache del dettaglio da quella che getList riempie con i
// record della lista (senza associazioni né cover): altrimenti l'Edit partirebbe
// da un record parziale e un Salva veloce cancellerebbe associazioni e cover.
export const detailOptions = { queryOptions: { meta: { detail: true } }, mutationOptions: { meta: { detail: true } } };
