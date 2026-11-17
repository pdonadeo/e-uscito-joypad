import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate, useRouteContext } from '@tanstack/react-router'
import { GlifoChiudi, GlifoEspelli, GlifoPlay, GlifoRombo, GlifoStella } from '@/components/pixel-art'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Sidebar,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuIcon,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { logout, type UtenteCorrente } from '@/lib/sessione'

// Shell delle pagine dietro il login (docs/ui.md, «Comportamento responsive»):
// - sotto lg (390): Barra app mobile (56 px) con «≡», che apre lo Sheet da sinistra;
// - da lg (1180): Barra app desktop (64 px) e Sidebar a rotaia (88 px);
// - da xl (1440): Sidebar espansa (232 px).

const VOCI = [
  {
    to: '/episodi',
    etichetta: 'Episodi',
    rotaia: <GlifoPlay misura="grande" />,
    espansa: <GlifoPlay misura="voce" />,
    soloSuperuser: false,
  },
  {
    to: '/videogame',
    etichetta: 'Videogame',
    rotaia: <GlifoRombo misura="grande" />,
    espansa: <GlifoRombo misura="voce" />,
    soloSuperuser: false,
  },
  {
    to: '/utenti',
    etichetta: 'Utenti',
    rotaia: <GlifoStella misura="grande" />,
    espansa: <GlifoStella misura="voce" />,
    soloSuperuser: true,
  },
] as const

// «P1» come nei PNG (Avatar di docs/ui.md: «iniziali bianche (es. «P1»)»).
const SIGLA_AVATAR = 'P1'

function useEsci() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return async () => {
    try {
      await logout()
    } finally {
      // il logout riesce sempre (F-AU-02); anche se la rete cade, la sessione locale si chiude
      queryClient.removeQueries()
      await navigate({ to: '/login' })
    }
  }
}

function VociMenu({ me, onScelta }: { me: UtenteCorrente; onScelta?: () => void }) {
  return (
    <SidebarMenu>
      {VOCI.filter((v) => !v.soloSuperuser || me.is_superuser).map((v) => (
        <SidebarMenuItem key={v.to}>
          <SidebarMenuButton asChild>
            <Link to={v.to} onClick={onScelta}>
              <SidebarMenuIcon rotaia={v.rotaia} espansa={v.espansa} />
              <span>{v.etichetta}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

function Marchio({ conSottotitolo }: { conSottotitolo: boolean }) {
  return (
    <span className="flex items-baseline gap-12">
      <span className="font-titolo text-3xl font-bold text-crema">RETROBOTTEGA</span>
      {conSottotitolo && <span className="font-testo text-md text-inchiostro-200">di «È uscito Joypad?»</span>}
    </span>
  )
}

function AvatarUtente() {
  return (
    <Avatar>
      <AvatarFallback>{SIGLA_AVATAR}</AvatarFallback>
    </Avatar>
  )
}

function MenuMobile({ me, esci }: { me: UtenteCorrente; esci: () => void }) {
  const [aperto, setAperto] = useState(false)
  return (
    <Sheet open={aperto} onOpenChange={setAperto}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Apri il menu"
          className="flex size-32 items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
        >
          {/* «≡» a pixel: il glifo dei font di sistema è troppo sottile rispetto al PNG */}
          <svg viewBox="0 0 18 14" width={18} height={14} shapeRendering="crispEdges" aria-hidden="true" className="fill-crema">
            <rect x={0} y={0} width={18} height={3} />
            <rect x={0} y={5.5} width={18} height={3} />
            <rect x={0} y={11} width={18} height={3} />
          </svg>
        </button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>RETROBOTTEGA</SheetTitle>
          <SheetClose
            aria-label="Chiudi il menu"
            className="flex size-32 items-center justify-center text-crema outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
          >
            <GlifoChiudi misura="grande" />
          </SheetClose>
        </SheetHeader>
        <div className="flex items-center gap-12 border-b border-linea px-16 py-20">
          <AvatarUtente />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="truncate text-md font-bold">{me.fullName}</span>
            {me.is_superuser && (
              <SheetDescription className="flex items-center gap-10">
                <GlifoStella misura="piccola" /> superuser
              </SheetDescription>
            )}
          </div>
        </div>
        <Sidebar layout="espansa" aria-label="Menu" className="pt-24">
          <SidebarGroupLabel>Seleziona livello</SidebarGroupLabel>
          <VociMenu me={me} onScelta={() => setAperto(false)} />
        </Sidebar>
        <SheetFooter>
          <Button variant="outline" className="gap-12" onClick={esci}>
            Esci <GlifoEspelli />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function Shell() {
  const { me } = useRouteContext({ from: '/_app' })
  const esci = useEsci()

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Barra app mobile (sotto lg) */}
      <header className="sticky top-0 z-40 grid h-56 grid-cols-[32px_1fr_32px] items-center bg-inchiostro px-16 lg:hidden">
        <MenuMobile me={me} esci={esci} />
        <span className="justify-self-center">
          <Marchio conSottotitolo={false} />
        </span>
        <AvatarUtente />
      </header>

      {/* Barra app desktop (da lg) */}
      <header className="hidden h-64 items-center justify-between bg-inchiostro px-24 lg:flex">
        <Marchio conSottotitolo />
        <div className="flex items-center gap-12">
          <AvatarUtente />
          <span className="text-md font-bold text-crema" data-testid="nome-utente">
            {me.fullName}
          </span>
          <Button variant="outline-su-scuro" size="sm" className="ml-2 gap-10" onClick={esci}>
            Esci <GlifoEspelli />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <Sidebar aria-label="Menu">
          <SidebarGroupLabel>Seleziona livello</SidebarGroupLabel>
          <VociMenu me={me} />
        </Sidebar>
        <main className="flex min-w-0 flex-1 flex-col gap-18 bg-linear-to-b from-cielo to-rosa px-16 pt-16 pb-24 lg:min-h-[calc(100dvh-64px)] lg:border-l-3 lg:border-inchiostro lg:px-24 lg:pt-28 lg:pb-40 xl:px-32">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
