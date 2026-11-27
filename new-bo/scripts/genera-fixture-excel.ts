// Genera i file .xlsx di prova dell'import Excel in tests/api/fixture/import-excel/.
//
//   ~/.bun/bin/bun run new-bo/scripts/genera-fixture-excel.ts
//
// I file si committano: rigenerarli dà file identici, finché non cambiano il generatore
// (src/lib/excel/template.ts) o le righe qui sotto. Usano solo:
// - i videogame di prova 990001-990003, inseriti con questi id da tests/api/global-setup.js;
// - slug «e2e-…», che il finto RAWG (tests/api/mock-rawg.js) conosce tutti, tranne quelli che
//   iniziano con «e2e-missing» (404).
// Il teardown dei test cancella i giochi con slug «e2e-…», compresi quelli creati dall'import.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { creaTemplate, type RigaCompilata } from '../src/lib/excel/template'

const CARTELLA = join(import.meta.dir, '..', '..', 'tests', 'api', 'fixture', 'import-excel')

// Gli stessi di global-setup.js: id e titolo devono coincidere.
const GIOCHI_FIXTURE = [
  { id: 990001, titolo: 'E2E Fixture 1' },
  { id: 990002, titolo: 'E2E Fixture 2' },
  { id: 990003, titolo: 'E2E Fixture 3' },
]
const [uno, due, tre] = GIOCHI_FIXTURE.map((g) => `${g.id}-${g.titolo}`)

const FIXTURE: Record<string, RigaCompilata[]> = {
  // tre giochi dal menu; istanti con «:» e con «.»; etichette complete, forme corte e vuote
  'valido.xlsx': [
    { videogame: uno, istante: '12:30', tipologia: 'Recensione', speaker: 'Matteo Bordone (corri!)' },
    { videogame: due, istante: '1:02:03', tipologia: 'Chiacchiera', speaker: 'Zampini' },
    { videogame: tre, istante: '10.11' },
  ],
  // uno slug nuovo su due righe (RAWG chiamato una volta sola) e un gioco dal menu
  'valido-slug.xlsx': [
    { slug: 'e2e-import-nuovo', istante: '5:00', tipologia: 'Consiglio' },
    { videogame: uno, istante: '6:00' },
    { slug: 'E2E-Import-Nuovo ', istante: '7:00', speaker: 'Fossetti' },
  ],
  // uno slug già nel DB: nessuna chiamata a RAWG
  'slug-esistente.xlsx': [{ slug: 'e2e-fixture-2', istante: '3:00' }],
  // VIDEOGAME e slug insieme: si usa il gioco e lo slug (che RAWG non conosce) si ignora
  'videogame-e-slug.xlsx': [{ videogame: tre, slug: 'e2e-missing-ignorato', istante: '4:00' }],
  // uno slug che RAWG non conosce: errore di riga
  'slug-sconosciuto.xlsx': [
    { videogame: uno, istante: '1:00' },
    { slug: 'e2e-missing-import', istante: '2:00' },
  ],
  // un errore per tipo, più una riga valida che non deve entrare
  'errori-misti.xlsx': [
    { videogame: uno, istante: '1:00' },
    { videogame: 'Gioco senza id', istante: '2:00' },
    { videogame: due, istante: '1:75:00' },
    { videogame: tre, istante: '3:00', tipologia: 'Intervista', speaker: 'Pippo' },
    { istante: '4:00', tipologia: 'Recensione' },
    { slug: 'slug con spazi', istante: '5:00' },
  ],
  // una riga vuota fra due compilate: si ignora
  'riga-vuota-in-mezzo.xlsx': [{ videogame: uno, istante: '1:00' }, {}, { videogame: due, istante: '2:00' }],
  // «12:30» già convertito dal programma in un orario vero: 12 ore, oltre la durata (P1)
  'istante-orario.xlsx': [{ videogame: uno, istante: 12.5 / 24 }],
  // 0:45:00: va bene con la durata 1:30:00, è oltre quella iniziale del nuovo episodio (0:30:00)
  'istante-lungo.xlsx': [{ videogame: due, istante: '45:00', tipologia: 'Recensione' }],
}

mkdirSync(CARTELLA, { recursive: true })
for (const [nome, righe] of Object.entries(FIXTURE)) {
  writeFileSync(join(CARTELLA, nome), creaTemplate(GIOCHI_FIXTURE, righe))
}
console.log(`${Object.keys(FIXTURE).length} fixture in ${CARTELLA}`)
