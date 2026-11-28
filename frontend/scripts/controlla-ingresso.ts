// Controllo del chunk d'ingresso (AC-3 del piano .omc/plans/nuovo-frontend.md): la home pubblica
// non deve scaricare il bo. Gira dentro `bun run build`, dopo `vite build`:
//   bun scripts/controlla-ingresso.ts
// Legge dist/.vite/chunk.json (plugin `elenco-chunk` di vite.config.ts) e dist/.vite/manifest.json.
// Parte dal chunk con isEntry, segue la chiusura degli import statici, aggiunge il chunk della
// rotta `/` (con i suoi import statici) e controlla i moduli che contiene: si guardano i moduleId,
// non le stringhe del bundle minificato, che non sono affidabili.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

// Tetti in KB gzip, misurati il 2026-11-28 sul build dello scheletro della Fase 1
// (JS d'ingresso + rotta `/`: 110.7 KB, somma dei chunk compressi uno per uno; CSS d'ingresso:
// 8.8 KB), con circa il 10 % di margine.
// Si ricalibrano in Fase 3 solo con il motivo scritto nel resoconto della demo.
const TETTO_JS_KB = 122
const TETTO_CSS_KB = 10

// Moduli che non devono stare nel chunk d'ingresso. Per src/routes/bo/ si vieta il codice delle
// pagine (i pezzi `?tsr-split=`): la parte non separata delle rotte (createFileRoute con
// beforeLoad, loader, validateSearch) è importata in modo statico da routeTree.gen.ts e sta per
// forza nell'ingresso; le sue dipendenze pesanti le coprono gli altri pattern.
const VIETATI: [RegExp, string][] = [
  [
    /\/node_modules\/(graphql|graphql-request|read-excel-file|fflate|cmdk|@tanstack\/react-table|@tanstack\/react-form|sonner)\//,
    'dipendenza del bo',
  ],
  [/\/src\/gql\//, 'documenti GraphQL generati'],
  [/\/src\/lib\/graphql\.ts$/, 'client GraphQL'],
  [/\/src\/routes\/bo\/.*\?tsr-split=/, 'pagina del bo'],
]

const ROTTA_HOME = 'src/routes/index.tsx?tsr-split=component'
const MARCATORE_HEAD = '<!-- euj:head -->'

type Chunk = { fileName: string; isEntry: boolean; imports: string[]; dynamicImports: string[]; moduleIds: string[] }
type VoceManifest = { file: string; isEntry?: boolean; imports?: string[]; css?: string[] }

const dist = path.resolve(import.meta.dir, '..', 'dist')
const leggi = (f: string) => readFileSync(path.join(dist, f))
const errori: string[] = []

const chunk: Chunk[] = JSON.parse(leggi('.vite/chunk.json').toString())
const manifest: Record<string, VoceManifest> = JSON.parse(leggi('.vite/manifest.json').toString())
const perNome = new Map(chunk.map((c) => [c.fileName, c]))

// chiusura degli import statici a partire da alcuni chunk
function chiusura(partenza: string[]): Set<string> {
  const visti = new Set<string>()
  const pila = [...partenza]
  while (pila.length > 0) {
    const f = pila.pop()!
    if (visti.has(f)) continue
    const c = perNome.get(f)
    if (!c) throw new Error(`chunk ${f} non trovato in chunk.json`)
    visti.add(f)
    pila.push(...c.imports)
  }
  return visti
}

const ingressi = chunk.filter((c) => c.isEntry)
if (ingressi.length !== 1) errori.push(`attesi 1 chunk d'ingresso, trovati ${ingressi.length}`)

// il chunk della rotta `/`: senza la sua chiave nel manifest il controllo non vedrebbe la home
const home = manifest[ROTTA_HOME]
if (!home) {
  console.error(`controlla-ingresso: nel manifest manca ${ROTTA_HOME} (rotta \`/\` spostata o non più separata?)`)
  process.exit(1)
}
const partenza = [...ingressi.map((c) => c.fileName), home.file]
const daControllare = chiusura(partenza)

for (const f of daControllare) {
  for (const id of perNome.get(f)!.moduleIds) {
    for (const [re, cosa] of VIETATI) {
      if (re.test(id)) errori.push(`${f} contiene ${cosa}: ${id}`)
    }
  }
}

const kb = (b: Buffer) => gzipSync(b).length / 1024
const js = [...daControllare].reduce((t, f) => t + kb(leggi(f)), 0)
const voceIngresso = Object.values(manifest).find((v) => v.isEntry)
const css = (voceIngresso?.css ?? []).reduce((t, f) => t + kb(leggi(f)), 0)
if (js > TETTO_JS_KB) errori.push(`JS d'ingresso ${js.toFixed(1)} KB gzip, oltre il tetto di ${TETTO_JS_KB}`)
if (css > TETTO_CSS_KB) errori.push(`CSS d'ingresso ${css.toFixed(1)} KB gzip, oltre il tetto di ${TETTO_CSS_KB}`)

if (!leggi('index.html').toString().includes(MARCATORE_HEAD)) errori.push(`dist/index.html non contiene ${MARCATORE_HEAD}`)

console.log(
  `controlla-ingresso: ${daControllare.size} chunk, JS ${js.toFixed(1)}/${TETTO_JS_KB} KB gzip, CSS ${css.toFixed(1)}/${TETTO_CSS_KB} KB gzip`,
)
if (errori.length > 0) {
  console.error(`controlla-ingresso: il chunk d'ingresso non è isolato dal bo:\n- ${errori.join('\n- ')}`)
  process.exit(1)
}
