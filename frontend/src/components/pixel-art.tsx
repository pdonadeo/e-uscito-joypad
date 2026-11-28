import { cn } from '@/lib/utils'

// Disegni a pixel del login (nuvole, scintille, joypad, cuori, prato), ricavati dai PNG
// login-*.png. Sono rettangoli SVG a spigoli vivi colorati con i token dello stile C.

type Rett = readonly [x: number, y: number, w: number, h: number]

function Pixel({
  larghezza,
  altezza,
  rettangoli,
  className,
}: {
  larghezza: number
  altezza: number
  rettangoli: readonly Rett[]
  className?: string
}) {
  return (
    <svg
      viewBox={`0 0 ${larghezza} ${altezza}`}
      width={larghezza}
      height={altezza}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {rettangoli.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} />
      ))}
    </svg>
  )
}

export function NuvolaGrande({ className }: { className?: string }) {
  return (
    <Pixel
      larghezza={192}
      altezza={64}
      rettangoli={[
        [64, 0, 64, 16],
        [32, 16, 128, 16],
        [0, 32, 192, 32],
      ]}
      className={cn('fill-bianco', className)}
    />
  )
}

export function NuvolaMedia({ className }: { className?: string }) {
  return (
    <Pixel
      larghezza={144}
      altezza={48}
      rettangoli={[
        [48, 0, 48, 16],
        [24, 16, 96, 16],
        [0, 32, 144, 16],
      ]}
      className={cn('fill-bianco', className)}
    />
  )
}

export function NuvolaPiccola({ className }: { className?: string }) {
  return (
    <Pixel
      larghezza={72}
      altezza={24}
      rettangoli={[
        [24, 0, 24, 8],
        [8, 8, 56, 8],
        [0, 16, 72, 8],
      ]}
      className={cn('fill-bianco', className)}
    />
  )
}

export function Scintilla({ grande, className }: { grande?: boolean; className?: string }) {
  const r: readonly Rett[] = grande
    ? [
        [12, 0, 6, 30],
        [0, 12, 30, 6],
      ]
    : [
        [8, 0, 4, 20],
        [0, 8, 20, 4],
      ]
  return <Pixel larghezza={grande ? 30 : 20} altezza={grande ? 30 : 20} rettangoli={r} className={className} />
}

// Il joypad «selvatico»: corpo rosa, croce, tasti, occhi, guance e bocca, su una griglia di 12 px.
export function Joypad({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 120" width={192} height={120} shapeRendering="crispEdges" aria-hidden="true" className={className}>
      <g className="fill-rosa-200">
        <rect x={36} y={0} width={120} height={12} />
        <rect x={12} y={12} width={168} height={12} />
        <rect x={0} y={24} width={192} height={72} />
        <rect x={12} y={96} width={60} height={24} />
        <rect x={120} y={96} width={60} height={24} />
      </g>
      <g className="fill-inchiostro">
        <rect x={36} y={24} width={12} height={36} />
        <rect x={24} y={36} width={36} height={12} />
        <rect x={72} y={48} width={12} height={12} />
        <rect x={108} y={48} width={12} height={12} />
        <rect x={84} y={72} width={24} height={12} />
      </g>
      <g className="fill-viola">
        <rect x={144} y={24} width={12} height={12} />
        <rect x={132} y={36} width={12} height={12} />
        <rect x={156} y={36} width={12} height={12} />
        <rect x={144} y={48} width={12} height={12} />
      </g>
      <g className="fill-rosa-acceso">
        <rect x={60} y={60} width={12} height={12} />
        <rect x={120} y={60} width={12} height={12} />
      </g>
    </svg>
  )
}

// Cuore a pixel (7 × 6 celle da 3 px) dei punti vita del login.
export function Cuore({ pieno }: { pieno: boolean }) {
  return (
    <Pixel
      larghezza={21}
      altezza={18}
      rettangoli={[
        [3, 0, 6, 3],
        [12, 0, 6, 3],
        [0, 3, 21, 6],
        [3, 9, 15, 3],
        [6, 12, 9, 3],
        [9, 15, 3, 3],
      ]}
      className={pieno ? 'fill-rosso-400' : 'fill-inchiostro-100'}
    />
  )
}

// Prato con la merlatura (quadrati da 24 × 12 ogni 48 px) e terra, in fondo alla pagina.
export function Prato({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 bottom-0', className)}>
      <svg width="100%" height={12} shapeRendering="crispEdges" className="block">
        <defs>
          <pattern id="merlatura" width={48} height={12} patternUnits="userSpaceOnUse">
            <rect x={0} y={0} width={24} height={12} className="fill-verde" />
          </pattern>
        </defs>
        <rect width="100%" height={12} fill="url(#merlatura)" />
      </svg>
      <div className="h-48 bg-verde" />
      <div className="h-72 bg-terra" />
    </div>
  )
}

// Glifi a pixel (▶ ◆ ★ ▼ ✕ ⏏) al posto dei caratteri del font: i sottoinsiemi latin dei font
// non li hanno, e quelli di sistema cambiano misura e aspetto (⏏ diventa un'emoji).
// Ogni glifo è una bitmap: «#» = pixel acceso. Il colore è currentColor, la misura è quella
// delle schermate di docs/design/new-bo.figcraft (pixel coperti almeno a metà), 1 cella = 1 px.

type Bitmap = readonly string[]

function Glifo({ bitmap, className }: { bitmap: Bitmap; className?: string }) {
  const larghezza = bitmap[0].length
  const altezza = bitmap.length
  return (
    <svg
      viewBox={`0 0 ${larghezza} ${altezza}`}
      width={larghezza}
      height={altezza}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {bitmap.flatMap((riga, y) =>
        [...riga.matchAll(/#+/g)].map((m) => (
          <rect key={`${m.index}-${y}`} x={m.index} y={y} width={m[0].length} height={1} />
        )),
      )}
    </svg>
  )
}

const PLAY = {
  // 9 × 11: occhiello «▶ LIVELLO …» (elenco-*-1440.png)
  occhiello: [
    '#........',
    '###......',
    '####.....',
    '######...',
    '########.',
    '#########',
    '########.',
    '######...',
    '####.....',
    '###......',
    '#........',
  ],
  // 10 × 12: voce EPISODI della Sidebar espansa e dello Sheet (elenco-episodi-1440.png, menu-390.png)
  voce: [
    '#.........',
    '###.......',
    '####......',
    '######....',
    '########..',
    '##########',
    '##########',
    '########..',
    '######....',
    '####......',
    '###.......',
    '#.........',
  ],
  // 11 × 13: «▶ SALVA» e «▶ CREA» nella barra delle azioni (modifica-episodio-*.png)
  medio: [
    '#..........',
    '###........',
    '####.......',
    '######.....',
    '########...',
    '#########..',
    '###########',
    '#########..',
    '########...',
    '######.....',
    '####.......',
    '###........',
    '#..........',
  ],
  // 14 × 16: «▶ ENTRA» del login e voce EPISODI della rotaia (login-*.png, elenco-episodi-1180.png)
  grande: [
    '#.............',
    '###...........',
    '#####.........',
    '######........',
    '########......',
    '##########....',
    '############..',
    '##############',
    '##############',
    '############..',
    '##########....',
    '########......',
    '######........',
    '#####.........',
    '###...........',
    '#.............',
  ],
} as const satisfies Record<string, Bitmap>

const ROMBO = {
  // 12 × 12: voce VIDEOGAME della Sidebar espansa e dello Sheet
  voce: [
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.##########.',
    '############',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
  ],
  // 17 × 17: voce VIDEOGAME della rotaia
  grande: [
    '........#........',
    '.......###.......',
    '......#####......',
    '.....#######.....',
    '....#########....',
    '...###########...',
    '..#############..',
    '.###############.',
    '#################',
    '.###############.',
    '..#############..',
    '...###########...',
    '....#########....',
    '.....#######.....',
    '......#####......',
    '.......###.......',
    '........#........',
  ],
} as const satisfies Record<string, Bitmap>

const STELLA = {
  // 7 × 8: «★ superuser» nello Sheet (menu-390.png)
  piccola: [
    '...#...',
    '...#...',
    '..###..',
    '#######',
    '.#####.',
    '..###..',
    '.##.##.',
    '##...##',
  ],
  // 9 × 8: titolo delle Card `sezione-scura` («★ QUEST LOG», nuovo-videogame-1440.png)
  titolo: [
    '....#....',
    '...###...',
    '...###...',
    '#########',
    '.#######.',
    '..#####..',
    '..##.##..',
    '.##...##.',
  ],
  // 11 × 10: voce UTENTI della Sidebar espansa e dello Sheet
  voce: [
    '.....#.....',
    '....###....',
    '....###....',
    '###########',
    '.#########.',
    '..#######..',
    '...#####...',
    '..###.###..',
    '..##...##..',
    '.#.......#.',
  ],
  // 13 × 13: voce UTENTI della rotaia
  grande: [
    '......#......',
    '......#......',
    '.....###.....',
    '.....###.....',
    '....#####....',
    '#############',
    '.###########.',
    '..#########..',
    '...#######...',
    '...#######...',
    '..####.####..',
    '..###...###..',
    '..#.......#..',
  ],
} as const satisfies Record<string, Bitmap>

const CHIUDI = {
  // 7 × 7: «✕» nei bottoni ELIMINA (modifica-episodio-*.png, elenco-episodi-*.png)
  bottone: [
    '##...##',
    '.##.##.',
    '..###..',
    '...#...',
    '..###..',
    '.##.##.',
    '##...##',
  ],
  // 8 × 8: «✕» dell'Alert del login, del bottone `destructive` · `icon` e del filtro (login-errore-*.png)
  piccolo: ['#......#', '##....##', '.##..##.', '..####..', '..####..', '.##..##.', '##....##', '#......#'],
  // 10 × 10: «✕» che chiude lo Sheet (menu-390.png)
  grande: [
    '##......##',
    '.##....##.',
    '..##..##..',
    '...####...',
    '....##....',
    '....##....',
    '...####...',
    '..##..##..',
    '.##....##.',
    '##......##',
  ],
} as const satisfies Record<string, Bitmap>

// 11 × 10: «▼» in fondo al riquadro del login
const GIU: Bitmap = [
  '###########',
  '###########',
  '.#########.',
  '.#########.',
  '..#######..',
  '..#######..',
  '...#####...',
  '....###....',
  '....###....',
  '.....#.....',
]

// 8 × 7: «⏏» di ESCI (elenco-*-1440.png, menu-390.png)
const ESPELLI: Bitmap = ['...##...', '..####..', '.######.', '########', '........', '........', '########']

type Misure<T> = { misura: keyof T; className?: string }

export function GlifoPlay({ misura, className }: Misure<typeof PLAY>) {
  return <Glifo bitmap={PLAY[misura]} className={className} />
}

export function GlifoRombo({ misura, className }: Misure<typeof ROMBO>) {
  return <Glifo bitmap={ROMBO[misura]} className={className} />
}

export function GlifoStella({ misura, className }: Misure<typeof STELLA>) {
  return <Glifo bitmap={STELLA[misura]} className={className} />
}

export function GlifoChiudi({ misura, className }: Misure<typeof CHIUDI>) {
  return <Glifo bitmap={CHIUDI[misura]} className={className} />
}

export function GlifoGiu({ className }: { className?: string }) {
  return <Glifo bitmap={GIU} className={className} />
}

export function GlifoEspelli({ className }: { className?: string }) {
  return <Glifo bitmap={ESPELLI} className={className} />
}

// 9 × 11: «◀» per tornare all'elenco e nella Pagination: è il «▶» dell'occhiello rovesciato
const INDIETRO: Bitmap = PLAY.occhiello.map((riga) => [...riga].reverse().join(''))

const TENDINA = {
  // 6 × 6: «▾» del Select `con-etichetta` (filtro «Pubblicato», ORDINA)
  piccola: ['######', '######', '.####.', '.####.', '..##..', '..##..'],
  // 7 × 6: «▾» dei Select `default`, `tabella` e `xs`
  normale: ['#######', '.#####.', '.#####.', '..###..', '..###..', '...#...'],
} as const satisfies Record<string, Bitmap>

// 9 × 8: «⌕» dell'Input `ricerca`
const LENTE: Bitmap = [
  '..#####..',
  '.##...##.',
  '.#.....#.',
  '.#.....#.',
  '.##...##.',
  '..#####..',
  '.##......',
  '##.......',
]

// 13 × 12: «▦» dell'Input `data`
const CALENDARIO: Bitmap = [
  '#############',
  '#############',
  '#...........#',
  '###.##.##.###',
  '###.##.##.###',
  '#...........#',
  '###.##.##.###',
  '###.##.##.###',
  '#...........#',
  '###.##.##.###',
  '###.##.##.###',
  '#############',
]

const SPUNTA = {
  // 6 × 6: «✔ PUBBLICATO» e «✔ COVER» nei Badge
  badge: ['.....#', '....##', '#..##.', '####..', '.##...', '.#....'],
  // 7 × 6: Checkbox selezionata
  casella: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'],
  // 9 × 8: colonne «presente» della tabella episodi
  riga: [
    '.......##',
    '......###',
    '.....###.',
    '....###..',
    '.#####...',
    '#####....',
    '.####....',
    '.###.....',
  ],
} as const satisfies Record<string, Bitmap>

// 9 × 8: «▲» della colonna ordinata (TableHeader); «▼» è lo stesso capovolto
const SU: Bitmap = [
  '....#....',
  '...###...',
  '...###...',
  '..#####..',
  '.#######.',
  '.#######.',
  '#########',
  '#########',
]

// 11 × 8: «↵» del ComboboxItem evidenziato
const INVIO: Bitmap = [
  '.........##',
  '.........##',
  '..#......##',
  '.##......##',
  '###########',
  '###########',
  '.##........',
  '..#........',
]

// 13 × 7: «↑↓» nel piede del Combobox
const FRECCE: Bitmap = [
  '..#.......#..',
  '.###......#..',
  '#.#.#.....#..',
  '..#.......#..',
  '..#.....#.#.#',
  '..#......###.',
  '..#.......#..',
]

// 8 × 2: «–» della Checkbox `indeterminate`
const MENO: Bitmap = ['########', '########']

export function GlifoIndietro({ className }: { className?: string }) {
  return <Glifo bitmap={INDIETRO} className={className} />
}

export function GlifoTendina({ misura, className }: Misure<typeof TENDINA>) {
  return <Glifo bitmap={TENDINA[misura]} className={className} />
}

export function GlifoLente({ className }: { className?: string }) {
  return <Glifo bitmap={LENTE} className={className} />
}

export function GlifoCalendario({ className }: { className?: string }) {
  return <Glifo bitmap={CALENDARIO} className={className} />
}

export function GlifoSpunta({ misura, className }: Misure<typeof SPUNTA>) {
  return <Glifo bitmap={SPUNTA[misura]} className={className} />
}

export function GlifoOrdine({ verso, className }: { verso: 'su' | 'giu'; className?: string }) {
  return <Glifo bitmap={verso === 'su' ? SU : [...SU].reverse()} className={className} />
}

export function GlifoInvio({ className }: { className?: string }) {
  return <Glifo bitmap={INVIO} className={className} />
}

export function GlifoFrecce({ className }: { className?: string }) {
  return <Glifo bitmap={FRECCE} className={className} />
}

export function GlifoMeno({ className }: { className?: string }) {
  return <Glifo bitmap={MENO} className={className} />
}

// 13 × 11: «⚠» dell'Alert `warning` (nuovo-videogame-1440.png), col «!» vuoto
const AVVISO: Bitmap = [
  '......#......',
  '.....###.....',
  '.....###.....',
  '....##.##....',
  '....##.##....',
  '...###.###...',
  '...###.###...',
  '..#########..',
  '..####.####..',
  '.###########.',
  '#############',
]

export function GlifoAvviso({ className }: { className?: string }) {
  return <Glifo bitmap={AVVISO} className={className} />
}

// 6 × 7: «▸» in fondo alle righe degli episodi citati (modifica-videogame-*.png)
const APRI: Bitmap = ['#.....', '###...', '#####.', '######', '#####.', '###...', '#.....']

export function GlifoApri({ className }: { className?: string }) {
  return <Glifo bitmap={APRI} className={className} />
}
