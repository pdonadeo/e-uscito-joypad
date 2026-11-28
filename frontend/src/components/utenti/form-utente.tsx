import * as React from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouteContext, useRouter } from '@tanstack/react-router'
import { BarraAzioni } from '@/components/barra-azioni'
import { Campo } from '@/components/campi'
import { ConfermaEliminazione } from '@/components/conferma-eliminazione'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { GlifoChiudi } from '@/components/pixel-art'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { chiudiErrori, mostraErrore, mostraSuccesso } from '@/components/ui/sonner'
import { Switch } from '@/components/ui/switch'
import { useDesktop } from '@/lib/formato'
import { eErroreApi, ErroreApi } from '@/lib/graphql'
import { cn } from '@/lib/utils'
import { aggiornaUtente, creaUtente, dataOra, eliminaUtente, utente as dettaglio, type Utente } from '@/lib/utenti'

// «Modifica utente» (F-UT-03, F-UT-05, F-UT-06; modifica-utente-*.png) e «Nuovo utente» (F-UT-04),
// che è la stessa schermata con le differenze di docs/ui.md («Schermate non disegnate»).
// - La password non si legge mai: in modifica il campo parte vuoto («Lascia vuoto per non
//   cambiarla») e vuoto non la cambia; in creazione è obbligatoria.
// - Nel proprio account «✕ ELIMINA UTENTE» è disattivato, con «Non puoi cancellare te stesso».
// - «Salva e continua» come nelle altre modifiche (docs/ui.md); dopo il salvataggio il campo
//   password torna vuoto.
// Proposte (non disegnate): in creazione il campo password ha il placeholder «Almeno 8
// caratteri»; dopo il salvataggio del proprio account si rilegge l'utente della barra app
// (`me`, che la Shell prende dal contesto del router).

type Valori = {
  username: string
  password: string
  first_name: string
  last_name: string
  email: string
  is_staff: boolean
  is_active: boolean
  is_superuser: boolean
}

type Invio = { continua: boolean }
type Salvataggio = { v: Valori; continua: boolean }

function valoriIniziali(u: Utente | null): Valori {
  if (!u)
    // F-UT-04: staff e attivo accesi, superuser spento
    return {
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      is_staff: true,
      is_active: true,
      is_superuser: false,
    }
  return {
    username: u.username,
    password: '',
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    is_staff: u.is_staff,
    is_active: u.is_active,
    is_superuser: u.is_superuser,
  }
}

// La password vuota non si manda: in modifica lascia quella di prima (UtenteInput).
function dati(v: Valori) {
  return {
    username: v.username.trim(),
    password: v.password === '' ? null : v.password,
    first_name: v.first_name,
    last_name: v.last_name,
    email: v.email,
    is_staff: v.is_staff,
    is_active: v.is_active,
    is_superuser: v.is_superuser,
  }
}

const PERMESSI = [
  { nome: 'is_staff', etichetta: 'Staff', spiegazione: 'entra nel backoffice, gestisce episodi e videogame' },
  { nome: 'is_active', etichetta: 'Attivo', spiegazione: 'può fare login' },
  { nome: 'is_superuser', etichetta: 'Superuser', spiegazione: 'gestisce anche gli utenti' },
] as const

const NON_TE_STESSO = 'Non puoi cancellare te stesso'

export function FormUtente({ utente }: { utente: Utente | null }) {
  const nuovo = utente == null
  const desktop = useDesktop()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { me } = useRouteContext({ from: '/bo/_app' })
  const idNonTeStesso = React.useId()
  const proprio = utente != null && utente.id === me.id
  const [conferma, setConferma] = React.useState(false)
  const [continua, setContinua] = React.useState(false)

  const salva = useMutation({
    mutationFn: ({ v }: Salvataggio) => (utente == null ? creaUtente(dati(v)) : aggiornaUtente(utente.id, dati(v))),
    onSuccess: async (esito, inviato) => {
      // proprio account: la barra app deve mostrare nome e username nuovi
      const proprioSalvato = esito.id === me.id
      if (proprioSalvato) await queryClient.refetchQueries({ queryKey: ['me'] })
      if (nuovo) {
        // Dopo «Crea» si apre la modifica (F-UT-04).
        await queryClient.invalidateQueries({ queryKey: ['utenti'], refetchType: 'none' })
        await navigate({ to: '/bo/utenti/$id', params: { id: esito.id } })
      } else if (inviato.continua) {
        const chiave = dettaglio(esito.id).queryKey
        await queryClient.invalidateQueries({ queryKey: ['utenti'], refetchType: 'none' })
        await queryClient.cancelQueries({ queryKey: chiave })
        queryClient.setQueryData(chiave, esito)
        // le modifiche fatte durante l'invio restano, da salvare col prossimo invio; la password
        // inviata però si svuota comunque, così un secondo invio non la rimanda
        if (form.state.values === inviato.v) form.reset(valoriIniziali(esito))
        else if (form.state.values.password === inviato.v.password) form.setFieldValue('password', '')
        // senza navigazione il contesto del router (con `me`) si ricalcola solo così
        if (proprioSalvato) await router.invalidate()
        mostraSuccesso('Modifiche salvate')
      } else {
        await queryClient.invalidateQueries({ queryKey: ['utenti'], refetchType: 'none' })
        await navigate({ to: '/bo/utenti' })
      }
    },
    onError: (e) => {
      if (!eErroreApi(e, 'UNAUTHENTICATED')) mostraErrore(e.message)
    },
  })

  const elimina = useMutation({
    mutationFn: () => eliminaUtente(utente!.id),
    onSuccess: async () => {
      setConferma(false)
      queryClient.removeQueries({ queryKey: dettaglio(utente!.id).queryKey })
      await queryClient.invalidateQueries({ queryKey: ['utenti'], refetchType: 'none' })
      await navigate({ to: '/bo/utenti' })
    },
    onError: (e) => {
      setConferma(false)
      if (!eErroreApi(e, 'UNAUTHENTICATED')) mostraErrore(e.message)
    },
  })

  const form = useForm({
    defaultValues: valoriIniziali(utente),
    onSubmitMeta: { continua: false } as Invio,
    onSubmit: async ({ value, meta }) => {
      chiudiErrori()
      await salva.mutateAsync({ v: value, continua: meta.continua }).catch((e: unknown) => {
        if (!(e instanceof ErroreApi)) throw e
      })
    },
  })
  const modificato = useStore(form.store, (s) => s.isDirty)

  const invia = (meta: Invio) => {
    if (form.state.isSubmitting) return
    setContinua(meta.continua)
    void form.handleSubmit(meta)
  }

  const testo = (
    nome: 'username' | 'password' | 'first_name' | 'last_name' | 'email',
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <form.Field name={nome}>
      {(f) => (
        <Input
          id={nome}
          name={nome}
          value={f.state.value}
          onChange={(e) => f.handleChange(e.target.value)}
          onBlur={f.handleBlur}
          {...props}
        />
      )}
    </form.Field>
  )

  const pannelloAccount = (
    <Card>
      <CardTitle>Account</CardTitle>
      <CardContent className="mt-14 gap-16">
        <Campo etichetta="Username" htmlFor="username" obbligatorio>
          {testo('username', { autoComplete: 'off', spellCheck: false, 'aria-required': true })}
        </Campo>
        <Campo etichetta={nuovo ? 'Password' : 'Nuova password'} htmlFor="password" obbligatorio={nuovo}>
          {testo('password', {
            type: 'password',
            autoComplete: 'new-password',
            placeholder: nuovo ? 'Almeno 8 caratteri' : 'Lascia vuoto per non cambiarla',
            'aria-required': nuovo || undefined,
          })}
        </Campo>
        <div className="grid grid-cols-2 gap-12">
          <Campo etichetta="Nome" htmlFor="first_name">
            {testo('first_name')}
          </Campo>
          <Campo etichetta="Cognome" htmlFor="last_name">
            {testo('last_name')}
          </Campo>
        </div>
        <Campo etichetta="Email" htmlFor="email">
          {testo('email', { type: 'email', autoComplete: 'off' })}
        </Campo>
      </CardContent>
    </Card>
  )

  const pannelloPermessi = (
    <Card>
      <CardTitle>Permessi</CardTitle>
      <CardContent className="mt-14 gap-16">
        {PERMESSI.map((p) => (
          <form.Field key={p.nome} name={p.nome}>
            {(f) => (
              <div className="flex items-center gap-12">
                <Switch id={p.nome} checked={f.state.value} onCheckedChange={f.handleChange} className="shrink-0" />
                <Label htmlFor={p.nome} className="text-sm leading-compatta normal-case">
                  <span>
                    <span className="uppercase">{p.etichetta}</span> · {p.spiegazione}
                  </span>
                </Label>
              </div>
            )}
          </form.Field>
        ))}
      </CardContent>
    </Card>
  )

  const regole = (
    <Card variant="sezione-scura">
      <CardTitle scura>Regole del gioco</CardTitle>
      <div className="flex flex-col text-sm leading-ariosa">
        <p>Se cambi la password, l'utente esce da tutte le sessioni aperte (tranne la tua, se modifichi te stesso).</p>
        <p>Un superuser non può togliere a se stesso staff, attivo o superuser, né cancellarsi.</p>
      </div>
    </Card>
  )

  const registro = utente && (
    <Card data-testid="registro">
      <CardTitle>Registro</CardTitle>
      <CardContent className="mt-14 gap-14">
        <dl className="flex flex-col gap-14">
          <div className="flex flex-col gap-6">
            <dt className="text-xs font-extrabold uppercase tracking-wide">Ultimo accesso</dt>
            <dd className={cn('text-sm font-bold', !utente.last_login && 'text-inchiostro-400')}>
              {utente.last_login ? dataOra(utente.last_login) : 'mai'}
            </dd>
          </div>
          <div className="flex flex-col gap-6">
            <dt className="text-xs font-extrabold uppercase tracking-wide">Iscritto dal</dt>
            <dd className="text-sm font-bold">{dataOra(utente.date_joined)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )

  // Nel proprio account ELIMINA è disattivato e il suggerimento è un testo visibile, collegato
  // con aria-describedby (docs/ui.md, «Bottone disattivato»).
  const bottoneElimina = (larga: boolean) => (
    <div className={cn('flex gap-12', larga ? 'flex-col items-stretch' : 'items-center')}>
      <Button
        type="button"
        variant="destructive"
        className={cn(larga && 'w-full')}
        disabled={proprio}
        aria-describedby={proprio ? idNonTeStesso : undefined}
        onClick={() => {
          chiudiErrori()
          setConferma(true)
        }}
      >
        <GlifoChiudi misura="bottone" /> Elimina utente
      </Button>
      {proprio && (
        <p id={idNonTeStesso} className={cn('text-sm', larga ? 'text-inchiostro-700' : 'text-inchiostro-200')}>
          {NON_TE_STESSO}
        </p>
      )}
    </div>
  )

  const barra = (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(invio) => (
        <BarraAzioni
          desktop={desktop}
          invio={invio}
          inCorso={continua ? 'continua' : 'salva'}
          elimina={!nuovo && bottoneElimina(false)}
          annulla={{ to: '/bo/utenti' }}
          etichettaSalva={nuovo ? 'Crea' : 'Salva'}
          onContinua={nuovo ? undefined : () => invia({ continua: true })}
        />
      )}
    </form.Subscribe>
  )

  return (
    <form
      noValidate
      autoComplete="off"
      data-modificato={modificato}
      className="flex min-w-0 flex-col gap-18 lg:gap-20"
      onSubmit={(e) => {
        e.preventDefault()
        invia({ continua: false })
      }}
    >
      <IntestazionePagina
        className="lg:-mb-2"
        indietro={{ to: '/bo/utenti', etichetta: 'Utenti' }}
        titolo={utente ? utente.username : 'Nuovo utente'}
      />

      {desktop ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-24">
              {pannelloAccount}
              {pannelloPermessi}
            </div>
            <div className="flex flex-col gap-24">
              {regole}
              {registro}
            </div>
          </div>
          {barra}
        </>
      ) : (
        <>
          {pannelloAccount}
          {pannelloPermessi}
          {regole}
          {registro}
          {!nuovo && bottoneElimina(true)}
          {barra}
        </>
      )}

      {utente && (
        <ConfermaEliminazione
          aperto={conferma}
          onApertoChange={setConferma}
          titolo="Eliminare l'utente?"
          inCorso={elimina.isPending}
          onConferma={() => elimina.mutate()}
        >
          {`Stai per eliminare l'utente «${utente.username}» e i suoi collegamenti a registro, gruppi e permessi. Episodi e videogame restano come sono.`}
        </ConfermaEliminazione>
      )}
    </form>
  )
}
