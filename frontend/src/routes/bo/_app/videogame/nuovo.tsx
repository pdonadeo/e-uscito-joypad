import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { FormNuovoVideogame } from '@/components/videogame/form-nuovo-videogame'

// Nuovo videogame (F-VG-05): il form è un componente a sé, che non naviga; qui, a creazione
// riuscita, si apre la modifica del videogame creato e ANNULLA torna all'elenco.
export const Route = createFileRoute('/bo/_app/videogame/nuovo')({
  component: NuovoVideogame,
})

function NuovoVideogame() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-18 lg:gap-20">
      <IntestazionePagina
        className="lg:-mb-2"
        indietro={{ to: '/bo/videogame', etichetta: 'Videogame' }}
        titolo="Nuovo videogame"
      />
      <FormNuovoVideogame
        onCreato={(v) => void navigate({ to: '/bo/videogame/$id', params: { id: v.id } })}
        onAnnulla={() => void navigate({ to: '/bo/videogame' })}
      />
    </div>
  )
}
