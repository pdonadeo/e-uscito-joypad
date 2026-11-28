import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

// Home pubblica, SCHELETRO della Fase 1 (non è il design): mostra in testo la risposta di
// GET /api/ultima-puntata. Niente graphql qui: la rotta è nel chunk d'ingresso (AC-3).

// ep_num è il variant OCaml serializzato da ppx_deriving_yojson
type EpNum = ['Intero', number] | ['Stringa', string] | ['NonSpecificato']

type UltimaPuntata = {
  uscito: boolean
  giorni_fa: string
  data_italiano: string
  ep_num: EpNum
  titolo: string
  msg_risposta_no: string | null
}

async function ultimaPuntata(): Promise<UltimaPuntata> {
  const risposta = await fetch('/api/ultima-puntata', { cache: 'no-store' })
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`)
  return (await risposta.json()) as UltimaPuntata
}

const numero = (n: EpNum) => (n[0] === 'NonSpecificato' ? '' : ` ${n[1]}`)

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { data, isPending, isError } = useQuery({ queryKey: ['ultima-puntata'], queryFn: ultimaPuntata })

  return (
    <main className="p-16">
      <h1>È uscito Joypad?</h1>
      {isPending && <p>Caricamento…</p>}
      {isError && <p>Non riesco a sapere se è uscito.</p>}
      {data && (
        <>
          <p>{data.uscito ? 'Sì!' : 'No.'}</p>
          <p>
            Episodio{numero(data.ep_num)}: «{data.titolo}», uscito {data.giorni_fa} ({data.data_italiano}).
          </p>
          {!data.uscito && data.msg_risposta_no && <p>{data.msg_risposta_no}</p>}
        </>
      )}
      {/* tra pubblico e bo solo <a href>: ricarica completa, i meta li inietta Dream */}
      <p className="mt-24 text-sm">
        <a href="/bo">Retrobottega</a>
      </p>
    </main>
  )
}
