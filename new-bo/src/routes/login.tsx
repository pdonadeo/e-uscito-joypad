import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Cuore, GlifoChiudi, GlifoGiu, GlifoPlay, Joypad, NuvolaGrande, NuvolaMedia, NuvolaPiccola, Prato, Scintilla } from '@/components/pixel-art'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErroreApi, esegui, MESSAGGIO_RETE } from '@/lib/graphql'
import { graphql } from '@/gql'
import { login, utenteCorrente } from '@/lib/sessione'
import { cn } from '@/lib/utils'

// Login (F-AU-01): schermate «Login» e «Login · errore» di docs/ui.md, PNG login-*.png.
// Le spaziature verticali sotto lg sono misurate su login-390.png e login-errore-390.png;
// da lg restano quelle già allineate a login-1440.png.

const documentoSessioneAttiva = graphql(`
  query SessioneAttiva {
    me {
      id
    }
  }
`)

export const Route = createFileRoute('/login')({
  // con una sessione già valida il login non serve: si va agli episodi
  beforeLoad: async () => {
    let attiva = false
    try {
      await esegui(documentoSessioneAttiva)
      attiva = true
    } catch {
      // nessuna sessione (o server irraggiungibile): si resta sul login
    }
    if (attiva) throw redirect({ to: '/episodi' })
  },
  component: PaginaLogin,
})

// Etichette dei campi: sotto lg interlinea stretta, così etichetta e campo distano 9 px come in
// login-390.png; da lg l'interlinea normale (1,5) di login-1440.png.
const ETICHETTA = 'leading-titolo lg:leading-ariosa'

function Paesaggio({ errore }: { errore: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <NuvolaGrande className="absolute top-36 -left-40 w-150 lg:top-130 lg:left-[10.4%] lg:w-192" />
      <NuvolaMedia className="absolute top-18 -right-24 w-144 lg:top-96 lg:right-auto lg:left-[77.8%]" />
      <NuvolaPiccola className="absolute bottom-148 left-10 opacity-80 lg:top-330 lg:bottom-auto lg:left-[20.8%]" />
      <NuvolaPiccola className="absolute top-300 left-[72.9%] hidden opacity-80 lg:block" />
      <div className={cn(errore && 'hidden lg:block')}>
        <Scintilla className="absolute bottom-164 left-150 fill-bianco lg:top-420 lg:bottom-auto lg:left-[88.2%]" />
        <Scintilla grande className="absolute bottom-176 left-110 fill-giallo lg:top-520 lg:bottom-auto lg:left-[81.9%]" />
        <Joypad className="absolute right-2 bottom-120 lg:right-auto lg:left-[13.2%]" />
      </div>
      <Prato />
    </div>
  )
}

function PaginaLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [errore, setErrore] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { username: '', password: '' },
    onSubmit: async ({ value }) => {
      setErrore(null)
      try {
        const me = await login(value.username, value.password)
        queryClient.setQueryData(utenteCorrente.queryKey, me)
        await navigate({ to: '/episodi' })
      } catch (e) {
        // il messaggio è quello del server: 401 «Credenziali non valide o utente non abilitato»,
        // 429 «Troppe richieste di login, riprova tra poco» (V-04)
        setErrore(e instanceof ErroreApi ? e.message : MESSAGGIO_RETE)
      }
    },
  })

  return (
    <div className="relative flex min-h-dvh justify-center bg-linear-to-b from-cielo to-rosa px-16 pt-80 pb-160 lg:items-center lg:pt-0 lg:pb-28">
      <Paesaggio errore={errore !== null} />

      {/* Dialog `retro`: cornice inchiostro > bianco > crema, ombra inchiostro al 30 % */}
      <main className="relative h-fit w-full max-w-500 bg-inchiostro p-8 shadow-pixel-3xl shadow-inchiostro/30">
        <div className="bg-bianco p-6">
          <div className="flex flex-col bg-crema px-10 pt-21 pb-32 lg:px-24 lg:pt-28 lg:pb-20">
            <h1 className="text-center font-titolo text-7xl font-bold text-inchiostro">RETROBOTTEGA</h1>
            <p className="mt-0 text-center font-testo lg:mt-4 text-base text-inchiostro-600">di «È uscito Joypad?»</p>

            <p className="mt-23 text-lg leading-ariosa lg:mt-20 text-inchiostro">
              {errore === null ? (
                <>
                  Un JOYPAD selvatico appare!
                  <br />
                  Dicci chi sei, avventuriero.
                </>
              ) : (
                <>
                  Ouch! Il JOYPAD ha resistito.
                  <br />
                  Riprova, avventuriero.
                </>
              )}
            </p>
            <p className="mt-12 flex items-center gap-6 text-sm font-extrabold">
              <span className="mr-4">HP</span>
              <span className="sr-only">{errore === null ? '3 su 3' : '2 su 3'}</span>
              <Cuore pieno />
              <Cuore pieno />
              <Cuore pieno={errore === null} />
            </p>

            <form
              className="mt-24 flex flex-col"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.state.isSubmitting) void form.handleSubmit()
              }}
            >
              <form.Field name="username">
                {(campo) => (
                  <div className="flex flex-col gap-6 lg:gap-8">
                    <Label htmlFor="username" className={ETICHETTA}>Nome utente</Label>
                    <Input
                      id="username"
                      name="username"
                      inputSize="lg"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="player1"
                      value={campo.state.value}
                      onChange={(e) => campo.handleChange(e.target.value)}
                      onBlur={campo.handleBlur}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="password">
                {(campo) => (
                  <div className="mt-16 flex flex-col gap-6 lg:mt-20 lg:gap-8">
                    <Label htmlFor="password" className={ETICHETTA}>Parola d'ordine</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      inputSize="lg"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={campo.state.value}
                      onChange={(e) => campo.handleChange(e.target.value)}
                      onBlur={campo.handleBlur}
                    />
                  </div>
                )}
              </form.Field>

              {errore !== null && (
                <Alert icona={<GlifoChiudi misura="piccolo" />} className="mt-12 lg:mt-14">
                  {errore}
                </Alert>
              )}

              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(invio) => (
                  <Button
                    type="submit"
                    variant="retro"
                    size="xl"
                    aria-busy={invio}
                    className={cn('gap-17 aria-busy:cursor-wait', errore === null ? 'mt-20 lg:mt-32' : 'mt-6 lg:mt-10')}
                  >
                    <GlifoPlay misura="grande" /> {invio ? 'Attendi…' : 'Entra'}
                  </Button>
                )}
              </form.Subscribe>
            </form>

            <p className="mt-26 flex items-center justify-between text-sm lg:mt-24 text-inchiostro-300">
              <span className="lg:hidden">Tocca ENTRA per continuare</span>
              <span className="hidden lg:inline">Premi INVIO per continuare</span>
              <GlifoGiu className="mr-3 text-inchiostro lg:mr-4" />
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
