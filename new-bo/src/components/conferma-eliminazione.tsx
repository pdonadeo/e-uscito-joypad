import * as React from 'react'
import { GlifoChiudi } from '@/components/pixel-art'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogIrreversibile,
  AlertDialogOcchiello,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Conferma di eliminazione (docs/ui.md, «Conferme di eliminazione»): occhiello «▶ GAME OVER?»,
// titolo, spiegazione, Alert «NON SI PUÒ ANNULLARE», ANNULLA con il focus iniziale e «✕ ELIMINA».
// ELIMINA non chiude da solo: chiama `onConferma`, e il chiamante chiude a lavoro finito.
// Durante l'eliminazione (non disegnato, proposta) i due bottoni sono disattivati e ELIMINA
// dice «Attendi…».
export function ConfermaEliminazione({
  aperto,
  onApertoChange,
  titolo,
  children,
  inCorso,
  onConferma,
}: {
  aperto: boolean
  onApertoChange: (aperto: boolean) => void
  titolo: string
  children: React.ReactNode
  inCorso: boolean
  onConferma: () => void
}) {
  return (
    <AlertDialog open={aperto} onOpenChange={(v) => !inCorso && onApertoChange(v)}>
      <AlertDialogContent>
        <AlertDialogOcchiello>Game over?</AlertDialogOcchiello>
        <AlertDialogTitle>{titolo}</AlertDialogTitle>
        <AlertDialogDescription className="wrap-anywhere">{children}</AlertDialogDescription>
        <AlertDialogIrreversibile />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={inCorso}>Annulla</AlertDialogCancel>
          <AlertDialogAction
            disabled={inCorso}
            aria-busy={inCorso}
            onClick={(e) => {
              e.preventDefault()
              onConferma()
            }}
          >
            <GlifoChiudi misura="bottone" />
            {inCorso ? 'Attendi…' : 'Elimina'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
