import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { BarraAzioni } from '@/components/barra-azioni'
import { Campo } from '@/components/campi'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { chiudiErrori, mostraErrore, mostraSuccesso } from '@/components/ui/sonner'
import { useDesktop } from '@/lib/formato'
import { eErroreApi } from '@/lib/graphql'
import { cambiaPassword, MESSAGGIO_ATTUALE_ERRATA } from '@/lib/sessione'

// Cambio della propria password (F-AU-06), per ogni utente staff. Pagina non disegnata
// (docs/ui.md, «Schermate non disegnate»): la griglia e la barra delle azioni di «Modifica utente».
// - Nuova sotto gli 8 caratteri (punti di codice, il server conta i byte: il client è sempre più
//   severo): errore nel campo «nuova», nessuna richiesta. Poi, se la nuova e la ripetuta non
//   coincidono: errore nel campo «ripeti», nessuna richiesta.
// - Password attuale sbagliata (riconosciuta dal messaggio del server, BAD_USER_INPUT
//   MESSAGGIO_ATTUALE_ERRATA): sotto il campo «attuale» il testo dell'interfaccia; la sessione
//   resta aperta. Gli altri errori del server (compreso quello degli 8 caratteri, di riserva)
//   vanno nel Toast.
// - A successo: Toast `success` CHECKPOINT, form vuoto, si resta sulla pagina.
// - ANNULLA torna alla pagina precedente dell'app; se la pagina è stata aperta direttamente,
//   agli episodi.
export const Route = createFileRoute('/bo/_app/password')({
  component: PaginaPassword,
})

type Valori = { attuale: string; nuova: string; ripeti: string }
type Errori = { attuale?: string; nuova?: string; ripeti?: string }

const VUOTI: Valori = { attuale: '', nuova: '', ripeti: '' }
const NON_COINCIDE = "Non coincide con la nuova parola d'ordine"
const ATTUALE_ERRATA = "La parola d'ordine attuale non è corretta"
const MINIMO_CARATTERI = 8
const TROPPO_CORTA = 'Almeno 8 caratteri'

function PaginaPassword() {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const router = useRouter()
  const indietro = useCanGoBack()
  const id = React.useId()
  const campoAttuale = React.useRef<HTMLInputElement>(null)
  const [valori, setValori] = React.useState<Valori>(VUOTI)
  const [errori, setErrori] = React.useState<Errori>({})

  const salva = useMutation({
    mutationFn: (v: Valori) => cambiaPassword(v.attuale, v.nuova),
    onSuccess: () => {
      setValori(VUOTI)
      setErrori({})
      mostraSuccesso("Parola d'ordine cambiata")
    },
    onError: (e) => {
      // UNAUTHENTICATED: ci pensa il MutationCache (main.tsx), che porta al login
      if (eErroreApi(e, 'UNAUTHENTICATED')) return
      if (eErroreApi(e, 'BAD_USER_INPUT') && e.message === MESSAGGIO_ATTUALE_ERRATA) {
        setErrori({ attuale: ATTUALE_ERRATA })
        campoAttuale.current?.focus()
        return
      }
      mostraErrore(e.message)
    },
  })

  const invia = () => {
    if (salva.isPending) return
    chiudiErrori()
    if ([...valori.nuova].length < MINIMO_CARATTERI) {
      setErrori({ nuova: TROPPO_CORTA })
      return
    }
    if (valori.nuova !== valori.ripeti) {
      setErrori({ ripeti: NON_COINCIDE })
      return
    }
    setErrori({})
    salva.mutate(valori)
  }

  const annulla = () => {
    chiudiErrori()
    if (indietro) router.history.back()
    else void navigate({ to: '/bo/episodi' })
  }

  const campo = (
    nome: keyof Valori,
    etichetta: string,
    props: React.ComponentProps<typeof Input> & { errore?: string },
  ) => {
    const { errore, ...resto } = props
    const idCampo = `${id}-${nome}`
    const idErrore = `${idCampo}-errore`
    return (
      <Campo etichetta={etichetta} htmlFor={idCampo} obbligatorio>
        <Input
          id={idCampo}
          name={nome}
          type="password"
          aria-required="true"
          aria-invalid={errore ? true : undefined}
          aria-describedby={errore ? idErrore : undefined}
          value={valori[nome]}
          onChange={(e) => {
            const v = e.target.value
            setValori((s) => ({ ...s, [nome]: v }))
            // l'errore del campo sparisce appena lo si corregge; cambiare la nuova toglie anche quello di «ripeti»
            setErrori((s) => ({
              ...s,
              [nome]: undefined,
              ...(nome === 'nuova' ? { ripeti: undefined } : {}),
            }))
          }}
          {...resto}
        />
        {errore && (
          <p id={idErrore} className="text-sm font-bold text-rosso">
            {errore}
          </p>
        )}
      </Campo>
    )
  }

  const pannello = (
    <Card>
      <CardTitle>Parola d'ordine</CardTitle>
      <CardContent className="mt-14 gap-16">
        {campo('attuale', "Parola d'ordine attuale", {
          ref: campoAttuale,
          autoComplete: 'current-password',
          errore: errori.attuale,
        })}
        {campo('nuova', "Nuova parola d'ordine", {
          autoComplete: 'new-password',
          placeholder: 'Almeno 8 caratteri',
          errore: errori.nuova,
        })}
        {campo('ripeti', 'Ripeti la nuova', {
          autoComplete: 'new-password',
          errore: errori.ripeti,
        })}
      </CardContent>
    </Card>
  )

  const regole = (
    <Card variant="sezione-scura">
      <CardTitle scura>Regole del gioco</CardTitle>
      <div className="flex flex-col text-sm leading-ariosa">
        <p>La nuova parola d'ordine deve avere almeno 8 caratteri.</p>
        <p>Qui resti dentro. Le altre sessioni aperte con il tuo account si chiudono: lì dovrai rientrare con la nuova.</p>
      </div>
    </Card>
  )

  const barra = (
    <BarraAzioni desktop={desktop} invio={salva.isPending} inCorso="salva" annulla={{ onClick: annulla }} etichettaSalva="Salva" />
  )

  return (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-18 lg:gap-20"
      onSubmit={(e) => {
        e.preventDefault()
        invia()
      }}
    >
      {/* campo nascosto con lo username: i gestori di password capiscono di quale account si tratta */}
      <UsernameNascosto />
      <IntestazionePagina className="lg:-mb-2" occhiello="Il tuo account" titolo="Cambia parola d'ordine" />

      {desktop ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
            {pannello}
            {regole}
          </div>
          {barra}
        </>
      ) : (
        <>
          {pannello}
          {regole}
          {barra}
        </>
      )}
    </form>
  )
}

function UsernameNascosto() {
  const { me } = Route.useRouteContext()
  return <input type="text" name="username" autoComplete="username" value={me.username} readOnly hidden />
}
