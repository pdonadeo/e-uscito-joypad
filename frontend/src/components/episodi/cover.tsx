import * as React from 'react'
import { Button } from '@/components/ui/button'
import { mostraErrore } from '@/components/ui/sonner'
import { controllaCover } from '@/lib/episodi'
import { cn } from '@/lib/utils'

// Pannello COVER (F-EP-10, F-EP-11): la modifica parte solo dopo il salvataggio dei campi, quindi
// qui si tiene solo la scelta: un file nuovo (con l'anteprima locale) oppure la rimozione.
// - con una cover: miniatura, nome del file, «Solo PNG · max 10 MB», SOSTITUISCI e RIMUOVI;
// - senza cover (o in «Nuovo episodio»): l'area per scegliere il PNG (proposta: miniatura
//   tratteggiata, «Nessuna cover» e il bottone SCEGLI PNG). Si può anche trascinare un file
//   sulla miniatura.
// Un file non PNG o oltre i 10 MB si rifiuta subito, con lo stesso messaggio del server.

export type SceltaCover = { file: File | null; rimuovi: boolean }

export function PannelloCover({
  cover,
  coverUrl,
  scelta,
  onScelta,
  nuovo,
}: {
  cover: string | null
  coverUrl: string | null
  scelta: SceltaCover
  onScelta: (s: SceltaCover) => void
  nuovo: boolean
}) {
  const input = React.useRef<HTMLInputElement>(null)
  const [trascina, setTrascina] = React.useState(false)
  const anteprima = React.useMemo(() => (scelta.file ? URL.createObjectURL(scelta.file) : null), [scelta.file])
  React.useEffect(() => () => {
    if (anteprima) URL.revokeObjectURL(anteprima)
  }, [anteprima])
  const [rotta, setRotta] = React.useState(false)
  React.useEffect(() => setRotta(false), [coverUrl])

  const prendi = (file: File | undefined) => {
    if (!file) return
    const errore = controllaCover(file)
    if (errore) {
      mostraErrore(errore)
      return
    }
    onScelta({ file, rimuovi: false })
  }

  const mostrata = scelta.file ? anteprima : scelta.rimuovi ? null : coverUrl
  const nome = scelta.file ? scelta.file.name : scelta.rimuovi || !cover ? null : cover.split('/').pop()
  const haImmagine = mostrata != null

  return (
    <div className="flex items-start gap-12">
      <button
        type="button"
        aria-label={haImmagine ? 'Sostituisci la cover' : 'Scegli la cover'}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setTrascina(true)
        }}
        onDragLeave={() => setTrascina(false)}
        onDrop={(e) => {
          e.preventDefault()
          setTrascina(false)
          prendi(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex size-96 shrink-0 items-center justify-center overflow-hidden border-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola',
          haImmagine ? 'border-inchiostro bg-rosa-200' : 'border-dashed border-inchiostro-200 bg-bianco',
          trascina && 'border-viola bg-viola-50',
        )}
      >
        {haImmagine && !rotta ? (
          <img src={mostrata} alt="" className="size-full object-cover [image-rendering:pixelated]" onError={() => setRotta(true)} />
        ) : (
          <span className="px-6 text-center text-2xs font-extrabold uppercase tracking-wide text-inchiostro-400">
            {haImmagine ? 'Anteprima non disponibile' : 'Trascina qui il PNG'}
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-col gap-4 pt-2">
        <p className="truncate text-sm font-bold" data-testid="nome-cover">
          {nome ?? 'Nessuna cover'}
        </p>
        <p className="text-xs text-inchiostro-500">Solo PNG · max 10 MB</p>
        <div className="mt-8 flex flex-wrap items-center gap-8">
          {haImmagine && !nuovo ? (
            <>
              <Button type="button" variant="outline-ombra" size="xs" onClick={() => input.current?.click()}>
                Sostituisci
              </Button>
              <Button
                type="button"
                variant="ghost-destructive"
                size="xs"
                className="underline"
                onClick={() => onScelta({ file: null, rimuovi: cover != null })}
              >
                Rimuovi
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline-ombra" size="xs" onClick={() => input.current?.click()}>
                Scegli PNG
              </Button>
              {scelta.file && (
                <Button
                  type="button"
                  variant="ghost-destructive"
                  size="xs"
                  className="underline"
                  onClick={() => onScelta({ file: null, rimuovi: false })}
                >
                  Rimuovi
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,.png"
        aria-label="File della cover"
        className="hidden"
        data-testid="file-cover"
        onChange={(e) => {
          prendi(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
