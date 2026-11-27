# Interfaccia di `/bo` (stile C «Avventura 8-bit»)

Questo documento è il riferimento per la Fase 3.6c. Tutto quello che contiene viene da
`docs/design/new-bo.figcraft` (commit `0e76c12`) e non è ricostruito a occhio:

- i token sono le 94 variabili della collezione «Stile C»;
- i componenti sono quelli della pagina «Componenti · stile C», con le varianti e i token
  legati ai loro livelli;
- le schermate sono nella pagina «Schermate · stile C»: una riga per schermata, con le colonne
  390, 1180 e 1440 px;
- i PNG delle schermate si esportano da quel file (non sono più nel repository).

Nel file nessun colore, font, dimensione del testo, spaziatura, bordo, ombra od opacità è
scritto a mano: sono tutti legati a una variabile. Fa eccezione l'interlinea in percentuale
(vedi [Token](#token--theme-di-tailwind-v4)).

Le funzioni F-xx sono quelle di [`docs/analisi.md`](analisi.md).

## Token → `@theme` di Tailwind v4

Il blocco qui sotto va copiato così com'è nel CSS principale di `new-bo`. È stato compilato
con Tailwind 4.3.5 per verificare che generi le utility attese, per esempio
`shadow-pixel-md shadow-rosa-acceso`, `leading-testo` e `p-12` = 12 px.

```css
@import "tailwindcss";

@theme static {
  /* reset: solo i token dello stile C */
  --color-*: initial;
  --font-*: initial;
  --font-weight-*: initial;
  --text-*: initial;
  --tracking-*: initial;
  --leading-*: initial;
  --shadow-*: initial;
  --radius-*: initial;

  /* colori: palette */
  --color-inchiostro: #3A2E5C;
  --color-viola: #6C63FF;
  --color-crema: #FFF8E7;
  --color-bianco: #FFFFFF;
  --color-rosa: #FFE3F1;
  --color-rosa-acceso: #FF7AB6;
  --color-rosso: #D63A5A;
  --color-verde: #6CC97E;
  --color-giallo: #FFD84D;
  --color-cielo: #8FCBFF;
  /* colori: gradazioni */
  --color-inchiostro-100: #D9D4EE;
  --color-inchiostro-200: #B9B3D9;
  --color-inchiostro-300: #A79BC9;
  --color-inchiostro-400: #9A93C4;
  --color-inchiostro-500: #8A82B8;
  --color-inchiostro-600: #7A6FA8;
  --color-inchiostro-700: #5C5288;
  --color-inchiostro-900: #2A2145;
  --color-viola-50: #F3F1FF;
  --color-viola-100: #E9E6FF;
  --color-viola-300: #B9B3FF;
  --color-rosa-200: #FFD3E8;
  --color-rosa-300: #FFB3D1;
  --color-rosso-400: #FF5C7A;
  --color-verde-100: #DDF5E3;
  --color-verde-200: #B8F5C8;
  --color-verde-300: #8BD3A8;
  --color-verde-600: #2F9E52;
  --color-verde-700: #2F7A45;
  --color-giallo-100: #FFF1B8;
  --color-giallo-300: #FFE066;
  --color-giallo-600: #E0A800;
  /* colori: illustrazioni e segnaposto delle cover */
  --color-arancio: #FF9F43;
  --color-lime: #B8E986;
  --color-terra: #B9784C;
  --color-notte: #2B3A67;
  /* colori con trasparenza (inchiostro) */
  --color-linea: rgb(58 46 92 / 0.2);
  --color-velo: rgb(58 46 92 / 0.7216);
  --color-trasparente: rgb(58 46 92 / 0);

  /* font */
  --font-titolo: "Comfortaa", ui-rounded, sans-serif;
  --font-ui: "JetBrains Mono", ui-monospace, monospace;
  --font-testo: "Nunito Sans", ui-sans-serif, sans-serif;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;

  /* dimensioni del testo (interlinea: normal, come «Auto» in FigCraft) */
  --text-2xs: 10px;
  --text-xs: 11px;
  --text-sm: 12px;
  --text-md: 13px;
  --text-base: 14px;
  --text-lg: 15px;
  --text-xl: 16px;
  --text-2xl: 18px;
  --text-3xl: 20px;
  --text-4xl: 22px;
  --text-5xl: 24px;
  --text-6xl: 30px;
  --text-7xl: 32px;
  --tracking-normal: 0px;
  --tracking-wide: 1px;
  --tracking-wider: 2px;
  --leading-titolo: 1.3;
  --leading-compatta: 1.4;
  --leading-testo: 1.45;
  --leading-ariosa: 1.5;

  /* spaziature: 1 unità = 1px, quindi p-12 = 12px, h-44 = 44px */
  --spacing: 1px;
  --spacing-0: 0px;
  --spacing-2: 2px;
  --spacing-3: 3px;
  --spacing-4: 4px;
  --spacing-6: 6px;
  --spacing-7: 7px;
  --spacing-8: 8px;
  --spacing-10: 10px;
  --spacing-12: 12px;
  --spacing-14: 14px;
  --spacing-16: 16px;
  --spacing-18: 18px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-94: 94px;

  /* bordi (spessori) e angoli */
  --border-0: 0px;
  --border-1: 1px;
  --border-2: 2px;
  --border-3: 3px;
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;

  /* ombre «pixel»: offset senza sfocatura */
  --pixel-shadow-none: 0px;
  --pixel-shadow-sm: 2px;
  --pixel-shadow-md: 3px;
  --pixel-shadow-lg: 4px;
  --pixel-shadow-xl: 5px;
  --pixel-shadow-2xl: 6px;
  --pixel-shadow-3xl: 12px;
  --shadow-pixel-sm: 2px 2px 0 0 #3A2E5C;
  --shadow-pixel-md: 3px 3px 0 0 #3A2E5C;
  --shadow-pixel-lg: 4px 4px 0 0 #3A2E5C;
  --shadow-pixel-xl: 5px 5px 0 0 #3A2E5C;
  --shadow-pixel-2xl: 6px 6px 0 0 #3A2E5C;
  --shadow-pixel-3xl: 12px 12px 0 0 #3A2E5C;

  /* opacità */
  --opacity-30: 30%;
  --opacity-80: 80%;
}

/* raccordo con le variabili semantiche di shadcn/ui */
:root {
  --radius: 0px;
  --background: var(--color-crema);
  --foreground: var(--color-inchiostro);
  --card: var(--color-crema);
  --card-foreground: var(--color-inchiostro);
  --popover: var(--color-bianco);
  --popover-foreground: var(--color-inchiostro);
  --primary: var(--color-viola);
  --primary-foreground: var(--color-bianco);
  --secondary: var(--color-crema);
  --secondary-foreground: var(--color-inchiostro);
  --muted: var(--color-viola-100);
  --muted-foreground: var(--color-inchiostro-500);
  --accent: var(--color-viola);
  --accent-foreground: var(--color-bianco);
  --destructive: var(--color-rosso);
  --border: var(--color-inchiostro);
  --input: var(--color-inchiostro);
  --ring: var(--color-viola);
  --sidebar: var(--color-crema);
  --sidebar-foreground: var(--color-inchiostro);
  --sidebar-primary: var(--color-viola);
  --sidebar-primary-foreground: var(--color-bianco);
  --sidebar-accent: var(--color-viola-100);
  --sidebar-accent-foreground: var(--color-inchiostro);
  --sidebar-border: var(--color-inchiostro);
  --sidebar-ring: var(--color-viola);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```

### Corrispondenza con le variabili di FigCraft

Il nome di una variabile diventa il nome della proprietà sostituendo `/` con `-`: la variabile
`color/viola` diventa `--color-viola`, `text/md` diventa `--text-md`, `spacing/12` diventa
`--spacing-12`. È la stessa regola dell'export Tailwind di FigCraft. Ecco gli scostamenti da
quell'export e il loro motivo.

| Variabili | Nel blocco | Perché |
|---|---|---|
| `font/titolo`, `font/ui`, `font/testo` | aggiunta una famiglia di ripiego (`ui-rounded`, `ui-monospace`, `ui-sans-serif`, poi quella generica) | in FigCraft il valore è solo il nome del font; nel browser serve un ripiego se il font non è ancora caricato |
| `font-weight/*` (`"Regular"` … `"Extra Bold"`) | numeri: 400, 500, 600, 700, 800 | in FigCraft il peso è il nome della variante del font, in CSS `font-weight` vuole un numero |
| `color/linea`, `color/velo`, `color/trasparente` | `rgb(58 46 92 / α)` con α = 0,2, 0,7216 e 0 | in FigCraft sono `color/inchiostro` con opacità 20 %, 72,16 % (184/255) e 0 % |
| `opacity/30`, `opacity/80` | `30%`, `80%` | in FigCraft le opacità sono numeri in percento; Tailwind genera `opacity-30` e `opacity-80` |
| `pixel-shadow/*` (offset in px) | restano `--pixel-shadow-*` **e** si aggiungono `--shadow-pixel-sm…3xl` | Tailwind costruisce `shadow-*` solo da un'ombra completa. Le ombre composte hanno l'offset scritto in px e il colore `inchiostro`, perché Tailwind deve leggere il valore per poter sostituire il colore con `shadow-<colore>` (verificato in compilazione) |
| interlinee (nessuna variabile) | `--leading-titolo` 1.3, `--leading-compatta` 1.4, `--leading-testo` 1.45, `--leading-ariosa` 1.5 | in FigCraft le variabili numeriche sono solo in px, quindi le interlinee in % (75 testi) sono rimaste valori dei testi: 130 % nel titolo dei dialoghi (Comfortaa 22 px), 140 % in testi da 12 px, 145 % in Textarea e testi dei dialoghi, 150 % nel JSON di RAWG, nei passi di «Come funziona» e nella battuta del login. Gli altri testi hanno interlinea «Auto», cioè `normal`: per questo i `--text-*` non hanno un `--line-height` associato |
| — | `--spacing: 1px` | Tailwind calcola le utility di spaziatura e misura come multipli di `--spacing`. Con 1 px un numero è un valore in px (`h-44` = 44 px, `w-320` = 320 px) e coincide con i nomi `spacing/<px>` delle variabili |
| `border/*` | restano `--border-0…3` | Tailwind non ha un namespace per gli spessori: si usano le utility native `border`, `border-2`, `border-3` (1, 2, 3 px). Le variabili servono per CSS scritto a mano |
| — | `--radius-sm…xl: 0px` e `--radius: 0px` | lo stile C non ha angoli arrotondati (nessun livello del file ha un raggio). Così anche le classi `rounded-*` dei componenti shadcn danno angoli vivi |
| — | reset `--color-*: initial`, `--font-*`, `--text-*`, `--tracking-*`, `--leading-*`, `--shadow-*`, `--radius-*` | restano solo i token dello stile C: nessuna utility di Tailwind (`text-sm` da 14 px, `bg-white`, …) può reintrodurre valori fuori palette. Le spaziature e i breakpoint di default non si azzerano |
| — | blocco `:root` + `@theme inline` di shadcn | le variabili semantiche che i componenti shadcn usano (`--primary`, `--border`, …) puntano ai colori dello stile C (vedi [Componenti](#componenti)) |

**Gradiente di fondo.** Il fondo delle pagine (frame e `principale`) è un gradiente
verticale `cielo` → `rosa`: `bg-linear-to-b from-cielo to-rosa`.

## Componenti

### Regole comuni

Tutti i componenti partono dal componente shadcn/ui indicato, con queste personalizzazioni:

- angoli vivi, perché `--radius` vale 0;
- bordi pieni di 2 px (3 px nei campi da 44 px, nelle Card e nei dialoghi), quasi sempre
  `inchiostro`;
- ombre «pixel» senza sfocatura (`shadow-pixel-*`), colorate con `shadow-<colore>`;
- testo in `font-ui` (JetBrains Mono); etichette, bottoni e badge in maiuscolo, `font-extrabold`,
  `tracking-wide`;
- i titoli di pagina e il marchio usano `font-titolo` (Comfortaa Bold), il sottotitolo del
  marchio `font-testo` (Nunito Sans);
- focus: bordo `viola` di 3 px su fondo `bianco` (variante `ricerca-focus` di Input);
- nessuna animazione oltre a quelle del [prototipo](#prototipo).

Le varianti sono quelle del file. Nella colonna «Token» compaiono fondo, bordo, ombra, padding
(verticale/orizzontale) e testo.

### Button → `button`

| Variante | Token | Uso |
|---|---|---|
| `default` · `default` | `bg-viola` · `border-2 border-inchiostro` · `shadow-pixel-md` · `py-12 px-18` · `text-md` bianco | «+ NUOVO EPISODIO/VIDEOGAME/UTENTE» su desktop |
| `default` · `sm` | come sopra, `py-10 px-14` | «+ NUOVO» a 390 |
| `default-su-scuro` · `lg` | `bg-viola` · `border-2 border-crema` · `shadow-pixel-md` · `py-14 px-16` · `text-lg tracking-wider` bianco | «▶ SALVA», «▶ CREA DA RAWG» nella barra delle azioni |
| `secondary` · `lg` | `bg-crema`, senza bordo · `py-14 px-16` · `text-md` inchiostro | «ANNULLA» e «SALVA E CONTINUA» nella barra delle azioni |
| `outline` · `lg` | `bg-bianco border-2 border-inchiostro` · `py-14 px-16` · `text-md` | «ANNULLA» nei dialoghi (focus iniziale) |
| `outline` · `default` | come sopra, `py-12 px-14` | «ESCI» nello Sheet |
| `outline-ombra` · `xs` | `bg-bianco border-2 border-inchiostro shadow-pixel-sm` · `py-8 px-10` · `text-xs tracking-normal` | «SOSTITUISCI» della cover |
| `outline-su-scuro` · `sm` | trasparente, `border-2 border-crema` · `py-7 px-12` · `text-sm` crema | «ESCI ⏏» nella barra app desktop |
| `destructive` · `default` | `bg-rosa border-2 border-rosso` · `py-12 px-16` · `text-sm` rosso | «✕ ELIMINA EPISODIO/VIDEOGAME/UTENTE» |
| `destructive` · `sm` | come sopra, `py-8 px-12` | «✕ ELIMINA SELEZIONATI» su desktop |
| `destructive` · `xs` | come sopra, `py-7 px-10 text-xs` | «✕ ELIMINA» selezionati a 390 |
| `destructive` · `icon` | `bg-rosa border-2 border-inchiostro`, 40 × 40 · «✕» `text-base` rosso | rimuovi un'associazione |
| `destructive-pieno` · `lg` | `bg-rosso border-2 border-inchiostro shadow-pixel-md` · `py-14 px-16` · `text-md` bianco | «✕ ELIMINA» nel dialogo di conferma |
| `ghost` · `sm` | niente fondo né bordo · `py-6 px-10` · `text-sm` viola | «DESELEZIONA» |
| `ghost-destructive` · `xs` | niente fondo né bordo · `py-8 px-10` · `text-xs` rosso | «RIMUOVI» della cover |
| `dashed` · `default` | trasparente, `border-2 border-dashed border-viola` (tratti 6/4) · `p-12` · `text-sm` viola | «+ AGGIUNGI VIDEOGAME» |
| `dashed` · `sm` / `xs` | come sopra, alto quanto la riga, `px-14 text-sm` / `px-12 text-xs` | «+ AGGIUNGI FILTRO» / «+ FILTRO» |
| `retro` · `xl` | `bg-viola border-3 border-inchiostro shadow-pixel-2xl`, 52 px · `text-2xl tracking-wider` bianco | «▶ ENTRA» del login |

**Bottone disattivato** (non disegnato; deciso da Paolo per «✕ ELIMINA UTENTE» sul proprio
account). Si usa lo stesso stile già disegnato per la freccia disattivata di PaginationLink:
- classi: `disabled` + `bg-transparent border-2 border-inchiostro-200 text-inchiostro-200
  shadow-none cursor-not-allowed`, senza ombra;
- accanto al bottone, o sotto a 390, il suggerimento «Non puoi cancellare te stesso» in
  `text-sm`, collegato al bottone con `aria-describedby`:
  - `text-inchiostro-200` sulla barra delle azioni scura (desktop);
  - `text-inchiostro-700` sul contenuto chiaro (390).

  È un testo visibile, non un tooltip, così funziona anche al tocco.

### Input → `input`

| Variante | Token | Uso |
|---|---|---|
| `default` · `default` | `h-44 bg-bianco border-3 border-inchiostro px-12` · `text-lg` inchiostro | campi di testo dei form |
| `disabled` · `default` | come sopra, testo `inchiostro-400` | campi «arriva da RAWG» in nuovo videogame (F-VG-05) |
| `data` · `default` | come `default`, con l'icona «▦» `text-xl font-bold text-viola` a destra | data uscita |
| `url` · `default` / `url-placeholder` · `default` | come `default`, `text-base`; placeholder `inchiostro-300` | URL audio, post, video |
| `slug` · `default` | prefisso «rawg.io/games/» `inchiostro-400` + valore `font-bold` | slug RAWG prima dell'invio |
| `errore` · `default` | come `slug`, `border-rosso` (`aria-invalid`) | slug RAWG non trovato |
| `ricerca` · `default` | come `default`, icona «⌕» viola, `gap-8`, placeholder `inchiostro-400 text-base` | ricerca negli elenchi |
| `default` · `sm` | `h-40 bg-crema border-2 px-10` · `text-base` | istante di un'associazione |
| `ricerca` · `sm` | come sopra, icona «⌕», valore `font-bold` | videogame di un'associazione (apre il Combobox) |
| `ricerca-focus` · `sm` | `bg-bianco border-3 border-viola` | lo stesso campo mentre si scrive |
| `retro` · `lg` / `retro-placeholder` · `lg` | `h-46 bg-bianco border-3 px-16` · `text-lg`; placeholder `inchiostro-300` | login |

### Textarea → `textarea`

| Variante | Token | Uso |
|---|---|---|
| `default` · `default` | `bg-bianco border-3 border-inchiostro py-10 px-12` · `text-base leading-testo` | descrizione (TXT) |
| `default` · `sm` | come sopra, `text-md` | descrizione (HTML) |
| `placeholder` · `sm` | testo `inchiostro-300` | note libere vuote |
| `disabled` · `default` | testo `inchiostro-400` | descrizioni «arriva da RAWG» |

Altezze: 104 px (80 px per le note), con scorrimento.

### Select → `select`

| Variante | Token | Uso |
|---|---|---|
| `default` · `sm` | `h-40 bg-crema border-2 px-10 gap-6` · valore `text-md` a tutta larghezza, freccia «▾» `font-bold text-viola` | tipologia e speaker a 390 |
| `tabella` · `sm` | `h-40 bg-crema border-2 px-10` · valore `text-base`, freccia «▾» `font-normal` | tipologia e speaker nella tabella delle associazioni (1180/1440) |
| `default` · `xs` | `h-32 bg-bianco border-2 px-10 gap-8` · `text-base` | «Righe per pagina» |
| `con-etichetta` · `default` | `h-44 bg-bianco border-3 px-12 gap-10` · etichetta `text-xs font-extrabold text-viola`, valore `text-base`, «✕» rosso per togliere il filtro | filtro «Pubblicato» su desktop (F-EP-04) |
| `con-etichetta` · `sm` | `h-40 border-2 px-10 gap-8` · etichetta `text-2xs`, valore `text-md`; «✕» solo nei filtri | «ORDINA» e filtro «Pubblicato» a 390 |

### Switch → `switch`

| Variante | Token |
|---|---|
| `checked=true` | 52 × 28, `bg-verde border-3 border-inchiostro p-3`, levetta 16 × 16 `bg-bianco border-2` a destra |
| `checked=false` | `bg-viola-100`, levetta `bg-inchiostro-200` a sinistra |

Usato per «Pubblicato» (episodio) e per staff, attivo, superuser (utente).

### Checkbox → `checkbox`

| Variante | Token |
|---|---|
| `unchecked` · `default` / `lg` | 18 × 18 / 20 × 20, `bg-bianco border-2 border-inchiostro` |
| `checked` · `default` / `lg` | `bg-viola`, «✔» bianco `text-xs` / `text-sm` |
| `indeterminate` · `default` | `bg-bianco border-2 border-crema`, «–» viola: «seleziona tutti» nell'intestazione scura |

`lg` (20 px) si usa a 390.

**La propria riga non ha la casella** (deciso da Paolo, F-UT-06). Nell'elenco utenti la riga
o la scheda dell'utente collegato non mostra la Checkbox:
- la cella resta vuota con la stessa larghezza (18 px su desktop, 20 px a 390), così le colonne
  restano allineate;
- «seleziona tutti» seleziona tutte le altre righe, e il suo stato `checked` o
  `indeterminate` si calcola senza la propria riga.

In questo modo la propria riga non entra mai in un'eliminazione in blocco.

### Badge → `badge`

| Variante | Token | Uso |
|---|---|---|
| `success` · `lg` | `bg-verde border-2 border-inchiostro py-4 px-8` · `text-xs` | «✔ PUBBLICATO» nell'intestazione della modifica |
| `success` · `default` / `destructive` · `default` | `py-3 px-8 text-xs`; `destructive` = `bg-rosa border-rosso text-rosso` | «SÌ» / «NO» nella colonna pubblicato |
| `success` · `sm` / `destructive` · `sm` | come sopra, `text-2xs` | «✔ PUBBLICATO» / «NON PUBBLICATO» nelle schede a 390 |
| `warning` · `sm` | `bg-giallo border-inchiostro` · `text-2xs` | «★ SUPERUSER» a 390 |
| `success-tenue` · `sm` | `bg-verde-100 border-2 border-verde-600 py-3 px-6` · testo `verde-700` | campo presente («✔ COVER», «✔ STAFF») a 390 |
| `outline-tratteggiato` · `sm` | trasparente, `border-2 border-dashed border-inchiostro-200` (tratti 3/3) · testo `inchiostro-400` | campo assente («· VIDEO») a 390 |

### Table → `table`

**TableHeader** (`thead` > `tr`): `bg-inchiostro`. Testi `text-xs font-extrabold tracking-wide` in
`crema`; la colonna ordinata è in `giallo` con «▲/▼»; le colonne «presente» sono in `viola-300`.

| Variante | Padding / gap | Colonne |
|---|---|---|
| `tabella=episodi` | `px-16 gap-8`, 40 px | checkbox «seleziona tutti», N°, titolo, data uscita, durata, cover, audio, post, video, pubblicato (F-EP-01) |
| `tabella=videogame` | `px-16 gap-8`, 40 px | checkbox, cover, titolo, RAWG slug (F-VG-01) |
| `tabella=utenti` | `px-16 gap-8`, 40 px | checkbox, username, nome, cognome, email, staff, attivo, superuser, ultimo accesso (F-UT-01) |
| `tabella=associazioni` | `px-12 gap-12`, 36 px | videogame *, istante ▲, tipologia, speaker, (azioni) (F-EP-09) |
| `tabella=episodi-citati` | `px-14 gap-12`, 36 px | N°, episodio, data uscita ▼, istante, tipologia, (apri) (F-VG-08) |

**TableRow** (`tr`): bordo `border border-linea`, testo `text-base`.

| Stato | Fondo |
|---|---|
| `normale` / `alternata` | `bg-bianco` / `bg-crema` (righe a zebra) |
| `selezionata` | `bg-viola-100`, checkbox `checked` |
| `nuova` (solo associazioni) | `bg-viola-50`: la riga appena aggiunta |

Altezze: 48 px (episodi, utenti), 60 px (videogame, associazioni), 46 px (episodi citati).
Contenuto delle celle:
- «presente» = «✔» `verde-600` oppure «·» `inchiostro-200`, `text-lg font-extrabold`;
- superuser = «★» `giallo-600`;
- la miniatura della cover è 60 × 40 con `border-2`; senza cover è tratteggiata `inchiostro-200`.

Nelle associazioni le celle sono Input `ricerca`/`default` `sm`, Select `tabella` e Button
`destructive` `icon`. Tutta la riga è cliccabile e apre la modifica (F-EP-01, F-VG-01,
F-UT-01, F-VG-08).

### Pagination → `pagination`

| Componente | Variante | Token |
|---|---|---|
| PaginationLink | `link` | 32 × 32, `bg-bianco border-2`, numero `text-md font-bold` |
| | `link-attivo` | `bg-viola`, numero bianco `font-extrabold` |
| | `freccia` / `freccia-disattiva` | «◀ ▶» `text-sm`; disattiva senza fondo, bordo e testo `inchiostro-200` |
| | `freccia-disattiva` · `lg` / `freccia-primaria` · `lg` | 40 × 40, `text-md`; primaria `bg-viola` (successiva a 390) |
| Pagination | `desktop` | `bg-crema`, bordo superiore 2 px e gli altri 1 px, `px-16`, 60 px: a sinistra «RIGHE PER PAGINA» + Select `xs`, a destra «1–10 DI 313» + link |
| | `mobile` | `bg-crema border-2 p-12 gap-10`: riga «◀ PAGINA 1 DI 32 ▶», sotto «1–20 di 313 · righe per pagina» + Select `xs` |
| | `compatta` | solo il testo «1–4 DI 4 · 25 PER PAGINA» (episodi citati, F-VG-08) |

Il selettore offre 5, 10, 20, 25, 50. Nei PNG desktop dell'elenco episodi è su 10 per non
disegnare 20 righe, ma il default resta 20 (F-EP-01).

### Dialog → `alert-dialog`

| Variante | Token |
|---|---|
| `default` (desktop) | 460 px, `bg-crema border-3 border-inchiostro shadow-pixel-xl shadow-rosso p-24 gap-14` |
| `sm` (390) | 342 px, `p-20` |
| `retro` (login) | cornice: `bg-inchiostro p-8` > `bg-bianco p-6` > `bg-crema`, con un'ombra 12 px `inchiostro` al 30 % (`shadow-pixel-3xl shadow-inchiostro/30`) |

Struttura di `default` e `sm`, dall'alto:
- occhiello «▶ GAME OVER?» `text-md font-extrabold text-rosso`;
- titolo in `font-titolo text-4xl leading-titolo`;
- spiegazione `text-base leading-testo`;
- Alert `destructive` `sm` «NON SI PUÒ ANNULLARE»;
- azioni: Button `outline` `lg` (ANNULLA, con il **focus iniziale**) e `destructive-pieno` `lg`.

Si apre sopra un velo `bg-velo`. Il dialogo di sistema non c'è: le conferme usano sempre
`alert-dialog`, mentre il modale grande del nuovo videogame usa `dialog` (vedi [Nuovo videogame
dal form dell'episodio](#nuovo-videogame-dal-form-dellepisodio)).

### Alert → `alert`

| Variante | Token | Uso |
|---|---|---|
| `destructive` · `sm` | `bg-rosa border-2 border-rosso py-8 px-10` · `text-sm font-extrabold` rosso | «NON SI PUÒ ANNULLARE» nei dialoghi |
| `destructive` · `default` | `bg-rosa border-3 border-rosso py-10 px-12 gap-10` · «✕» + messaggio `text-md font-bold` inchiostro | errore del login (F-AU-01, V-04) |
| `warning` · `default` | `bg-giallo-100 border-2 border-inchiostro py-10 px-12` · «⚠» + `text-sm font-extrabold` | «NON COMPILARE MANUALMENTE: viene preso da RAWG» (F-VG-05) |

### Toast → `sonner`

Due varianti, 420 px su desktop e a tutta larghezza a 390, nella stessa posizione. Un Toast
nuovo sostituisce quello mostrato.

| Variante | Contenitore | Contenuto | Durata | Uso |
|---|---|---|---|---|
| `destructive` | `bg-rosa border-3 border-rosso shadow-pixel-lg p-14 gap-12`, `role="alert"` | «✕» rosso, occhiello «MISSIONE FALLITA» `text-xs font-extrabold text-rosso`, messaggio del server `text-base font-bold`, «✕» per chiudere | resta finché non si chiude con «✕» o non si invia di nuovo | i messaggi del server (errori di RAWG di F-VG-05, 403 di F-AU-04, errori di validazione) |
| `success` (non disegnata) | `bg-verde-100 border-3 border-verde-600 shadow-pixel-lg p-14 gap-12`, `role="status"` | «✔» `verde-600` (la spunta di 9 × 8 px delle colonne «presente»), occhiello «CHECKPOINT» `text-xs font-extrabold text-verde-700`, messaggio `text-base font-bold`, «✕» per chiudere | si chiude da sola dopo 4 s (il conto si ferma col puntatore sopra), oppure con «✕» | «Modifiche salvate» dopo «SALVA E CONTINUA» |

La variante `success` usa solo token già nel tema, gli stessi di Badge `success-tenue`
(`verde-700` su `verde-100` ha contrasto 4,6:1).

### Card → `card`

| Variante | Token | Uso |
|---|---|---|
| `sezione` | `bg-crema border-3 border-inchiostro shadow-pixel-lg p-16`; CardTitle «▶ …» `text-md font-extrabold tracking-wide text-viola`; slot «contenuto» (CardContent) | i pannelli dei form e del dettaglio |
| `sezione-scura` | `bg-inchiostro shadow-pixel-lg shadow-rosa-acceso p-18 gap-12`; titolo «★ …» giallo, testo crema | «QUEST LOG», «★ REGOLE DEL GIOCO», «★ DATI RAWG GIÀ PRESENTI» |
| `scheda-episodio` · `normale`/`selezionata` | `bg-bianco` / `bg-viola-100`, `border-2 shadow-pixel-md p-12 gap-8` | elenco episodi a 390: checkbox, numero, titolo, data · durata, badge pubblicato e presenze |
| `scheda-videogame` · … | `py-10 px-12 gap-12`, in riga | elenco videogame a 390: checkbox, miniatura, titolo, slug |
| `scheda-utente` · … | `p-12 gap-7` | elenco utenti a 390: checkbox, username, nome · email, badge |

Il gap tra titolo e contenuto cambia da pannello a pannello (10, 12, 14 o 16 px): è un
override del layout legato ai token `spacing`. A 390 le schede sono cliccabili come le righe.

### Combobox → `command` dentro `popover`

- **Combobox (CommandList):** `bg-bianco border-3 border-inchiostro shadow-pixel-xl
  shadow-viola p-6 gap-2`; 460 px su desktop, a tutta larghezza a 390.
- **ComboboxItem:**
  - `normale`: miniatura 40 × 28 con `border-2`, titolo `text-md font-bold`, slug `text-xs
    text-inchiostro-500`;
  - `evidenziato`: `bg-viola`, testi bianco e `viola-100`, «↵» a destra.
- **Piede:** `bg-crema border border-linea`, con «↑↓ scegli · INVIO conferma · ESC chiudi» e
  «Il gioco non c'è?» seguito dal Button `dashed` · `xs` «+ CREALO QUI», che apre il Dialog
  «Nuovo videogame» ([Nuovo videogame dal form dell'episodio](#nuovo-videogame-dal-form-dellepisodio)).

Il trigger è l'Input `ricerca` `sm`. In /bo la ricerca è la query `cercaVideogame`
(3.6c.4b), non quella di F-VG-03: cerca solo nel titolo, con le regole della ricerca del sito
pubblico. Sotto i 6 caratteri trova i titoli che contengono le parole scritte, nell'ordine, senza
maiuscole né accenti, ordinati per titolo; dai 6 caratteri in su ordina per somiglianza
(`word_similarity` > 0.25) e trova anche un titolo scritto con un errore di battitura. Al massimo
20 opzioni (F-EP-09).

### Avatar → `avatar`

32 × 32, `bg-viola border-2 border-crema`, iniziali bianche `text-sm font-extrabold` (es. «P1»).

### Sidebar → `sidebar`

| Variante | Token |
|---|---|
| `espansa` (1440) | 232 px, `bg-crema pt-24 px-16 gap-8`; occhiello «SELEZIONA LIVELLO» `text-xs text-inchiostro-500`; voci alte 44 px con icona + etichetta `text-md font-extrabold`, bordo `border-2 border-trasparente`; voce attiva `bg-viola border-inchiostro` con testo bianco |
| `rotaia` (1180) | 88 px, `pt-20 px-10 gap-10`; voci alte 64 px con l'icona `text-2xl` sopra l'etichetta `text-2xs` (`collapsible="icon"`) |

Le voci sono EPISODI ▶, VIDEOGAME ◆ e UTENTI ★. UTENTI c'è solo per i superuser (F-AU-04).

### Sheet → `sheet` (`side="left"`)

- Contenitore: 304 px, alto quanto lo schermo, `bg-crema`, bordo destro 3 px `inchiostro`,
  `shadow-pixel-2xl shadow-viola`.
- Testata `bg-inchiostro` con «RETROBOTTEGA» e «✕».
- Utente: Avatar, nome, «★ superuser».
- Voci come la Sidebar espansa; in fondo PAROLA D'ORDINE (Button `outline` `default` come ESCI: il
  `secondary` crema non si vedrebbe sul fondo dello Sheet; porta a «Cambia parola d'ordine»,
  F-AU-06) e sotto ESCI (Button `outline` `default`).

### Barra app (nessun equivalente shadcn)

- **`desktop`:** alta 64 px, `bg-inchiostro px-24`. A sinistra il marchio «RETROBOTTEGA»
  (`font-titolo text-3xl text-crema`) e «di «È uscito Joypad?»» (`font-testo`). A destra
  Avatar, `fullName` (F-AU-03), PAROLA D'ORDINE (Button `secondary` `sm` con `px-12 py-7 text-sm`
  e bordo `border-2 border-crema`, alto come ESCI; porta a «Cambia parola d'ordine», F-AU-06) ed
  ESCI (F-AU-02). Vale anche a 1180.
- **`mobile`:** alta 56 px, `px-16`: «≡», il marchio e l'Avatar.

## Adattare i componenti shadcn

Con questo tema i componenti generati da `shadcn add` **si rompono senza errori**:
- `--spacing: 1px` fa di ogni numero della scala standard un valore in px (`h-9` diventa 9 px
  invece di 36, `size-4` 4 px invece di 16, `p-6` 6 px invece di 24);
- il reset dei colori, delle ombre e del tracking fa sparire alcune classi senza avvisi
  (`bg-black/50`, `text-white`, `shadow-xs`…);
- i nomi `text-xs|sm|base|lg` esistono ancora, ma con le dimensioni dello stile C (11, 12, 14,
  15 px invece di 12, 14, 16, 18).

**Regola.** Ogni componente aggiunto con `shadcn add` va **riscritto** con le classi delle
tabelle di [Componenti](#componenti): non si usa così com'è. Si tengono la struttura Radix,
l'accessibilità e le varianti `cva`, e si sostituiscono tutte le classi di aspetto. Il file
riscritto si marca con il commento `// stile C: adattato secondo docs/ui.md`, che serve al
[controllo automatico](#controllo-automatico).

### Classi da sostituire

L'elenco viene dai sorgenti del registro shadcn `new-york-v4` (scaricati il 2026-11-16). Ogni
classe è stata compilata con il tema di Tailwind e con il nostro, poi ho confrontato i CSS
generati:
- 7 classi non generano più nulla;
- 65 classi cambiano valore;
- 123 classi restano uguali e vanno bene, a parte quelle elencate sotto per lo stile.

Nella tabella «x → y» dà la classe che conserva la misura originale. Va usata **solo se la
tabella del componente non indica un valore**, per esempio per lo spazio tra icona e testo.

| Componente | Scala standard (x → y) | Testo | Classi che spariscono | Stile da togliere |
|---|---|---|---|---|
| Button | `h-9`→`h-36`, `h-8`→`h-32`, `h-10`→`h-40`, `h-6`→`h-24`; `size-9`→`size-36`, `size-8`→`size-32`, `size-10`→`size-40`, `size-6`→`size-24`, `size-4`→`size-16`, `size-3`→`size-12`; `px-4`→`px-16`, `px-3`→`px-12`, `px-2.5`→`px-10`, `px-2`→`px-8`, `px-1.5`→`px-6`, `px-6`→`px-24`, `py-2`→`py-8`; `gap-2`→`gap-8`, `gap-1.5`→`gap-6`, `gap-1`→`gap-4` | `text-sm`, `text-xs` | `shadow-xs`, `text-white` | `rounded-md`, `ring-[3px] ring-ring/50`, colori con `/NN`, `dark:` |
| Input | `h-9`→`h-36`, `h-7`→`h-28`, `px-3`→`px-12`, `py-1`→`py-4` | `text-base`, `text-sm` | `shadow-xs` | `rounded-md`, `ring-[3px] ring-ring/50`, `bg-input/30`, `dark:` |
| Select | `h-9`→`h-36`, `h-8`→`h-32`, `size-4`→`size-16`, `size-3.5`→`size-14`, `p-1`→`p-4`, `px-3`→`px-12`, `px-2`→`px-8`, `py-2`→`py-8`, `py-1.5`→`py-6`, `py-1`→`py-4`, `pl-2`→`pl-8`, `pr-8`→`pr-32`, `gap-2`→`gap-8`, `-mx-1`→`-mx-4`, `my-1`→`my-4`, `right-2`→`right-8`, `scroll-my-1`→`scroll-my-4`, `±translate-x/y-1`→`±translate-x/y-4` | `text-sm`, `text-xs` | `shadow-md`, `shadow-xs` | `rounded-md`, `rounded-sm`, `ring-[3px] ring-ring/50`, `bg-input/30|50`, `dark:`, animazioni `zoom-*` e `slide-in-from-*` |
| Dialog / AlertDialog | `p-6`→`p-24`, `gap-4`→`gap-16`, `gap-2`→`gap-8`, `gap-1.5`→`gap-6`, `gap-x-6`→`gap-x-24`, `mb-2`→`mb-8`, `top-4`→`top-16`, `right-4`→`right-16`, `size-4`→`size-16`, `size-8`→`size-32`, `size-16`→`size-64` | `text-lg`, `text-sm` | `bg-black/50`, `shadow-lg`, `rounded-xs` | `rounded-lg`, `rounded-md`, animazioni `zoom-in-95`/`zoom-out-95` |
| Sheet | `p-4`→`p-16`, `gap-4`→`gap-16`, `gap-2`→`gap-8`, `gap-1.5`→`gap-6`, `top-4`→`top-16`, `right-4`→`right-16`, `size-4`→`size-16` | `text-sm` | `bg-black/50`, `shadow-lg`, `rounded-xs` | animazioni `slide-*` diverse da `slide-in-from-left`/`slide-out-to-left` |
| Command / Popover | `h-9`→`h-36`, `h-10`→`h-40`, `h-12`→`h-48`, `h-5`→`h-20`, `w-5`→`w-20`, `w-72`→`w-288`, `size-4`→`size-16`, `p-1`→`p-4`, `p-4`→`p-16`, `px-3`→`px-12`, `px-2`→`px-8`, `py-6`→`py-24`, `py-3`→`py-12`, `py-1.5`→`py-6`, `gap-2`→`gap-8`, `gap-1`→`gap-4`, `-mx-1`→`-mx-4`, `scroll-py-1`→`scroll-py-4` | `text-sm`, `text-xs` | `shadow-md`, `tracking-widest` | `rounded-md`, `rounded-sm`, animazioni `zoom-*` e `slide-*` |
| Sonner | `size-4`→`size-16` | — | — | i colori di sonner (`--normal-bg`, …) vanno puntati sui token del Toast |
| Table | `h-10`→`h-40`, `p-2`→`p-8`, `px-2`→`px-8`, `mt-4`→`mt-16` | `text-sm` | — | `bg-muted/50` (hover e righe selezionate: si usano `bg-viola-100` e la zebra `bg-crema`) |
| Checkbox | `size-4`→`size-16`, `size-3.5`→`size-14` | — | `shadow-xs` | `rounded-[4px]`, `ring-[3px] ring-ring/50`, `dark:` |
| Switch | `w-8`→`w-32`, `w-6`→`w-24`, `h-3.5`→`h-14`, `size-4`→`size-16`, `size-3`→`size-12` | — | `shadow-xs` | `rounded-full` (la levetta è quadrata), `ring-[3px] ring-ring/50`, `bg-input/80`, `dark:` |
| Badge | `px-2`→`px-8`, `py-0.5`→`py-2`, `gap-1`→`gap-4`, `size-3`→`size-12` | `text-xs` | `text-white` | `rounded-full`, `ring-[3px] ring-ring/50`, colori con `/NN`, `dark:` |
| Pagination | `size-9`→`size-36`, `size-4`→`size-16`, `px-2.5`→`px-10`, `pl-2.5`→`pl-10`, `pr-2.5`→`pr-10`, `gap-1`→`gap-4` | (dal Button) | (dal Button) | (dal Button) |

Come sostituire le classi:

- **Misure e spaziature.** Si usano i valori delle tabelle di [Componenti](#componenti). I campi
  hanno altezze fisse (`h-44`, `h-40`, `h-32`); per i bottoni l'altezza viene dal padding. Le
  icone dei componenti sono glifi di testo (▶ ◆ ★ ✕ ▾ ⌕): dove resta un'icona svg si usa
  `size-16`.
- **Testo.** `text-xs|sm|base|lg` non si tengono per inerzia: si scrive la dimensione della
  tabella. Per esempio i bottoni sono quasi tutti `text-md`, non `text-sm`.
- **Velo** (`bg-black/50`): `bg-velo`.
- **Testo bianco** (`text-white`): `text-bianco`.
- **Ombre** (`shadow-xs|md|lg`): le `shadow-pixel-*` delle tabelle, oppure nessuna ombra.
- **Angoli** (`rounded-*`): si tolgono. Con il tema darebbero comunque 0 px, ma il controllo
  automatico li segnala per tenere il codice pulito.
- **Focus** (`ring-[3px] ring-ring/50`):
  - nei campi: bordo `focus-visible:border-3 focus-visible:border-viola` e fondo bianco
    (variante `ricerca-focus`);
  - nei bottoni e nelle checkbox, che il disegno non mostra: proposta
    `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola`.
- **Colori con opacità** (`bg-primary/90`, `ring-destructive/20`, …) e **tema scuro**
  (`dark:`): si tolgono, perché lo stile C non ha né colori fuori palette né tema scuro. Il
  disegno non ha stati hover: se servono, si decidono con Paolo in 3.6c, sempre con i token.
- **Animazioni.** Si usano solo quelle del [prototipo](#prototipo): dissolvenza
  (`fade-in-0`/`fade-out-0`, `duration-120`) per il velo e il Dialog, `slide-in-from-left`
  (`duration-150`) per lo Sheet, niente animazione per il Combobox. Si tolgono `zoom-*` e gli
  altri `slide-*`; `duration-200|300|500` diventano 120 o 150.

### Controllo automatico

Da aggiungere in 3.6c come `new-bo/scripts/controlla-classi.sh` e da lanciare prima di
`bun run build`, per esempio come script `lint:classi`. Il controllo ha due parti.

1. **Classi mai valide nello stile C.** È un grep su `new-bo/src` che segnala:
   - i valori della scala standard che il disegno non usa mai: `*.5`, gli step `1`, `5`, `9`
     per padding, margini, gap e posizioni; `h|w|size` da 3 a 8;
   - i colori della palette di Tailwind e `black`/`white`;
   - `shadow-xs…2xl`, `rounded-*`, `tracking-tight|widest`, `max-w-sm|lg…`;
   - `zoom-*`, gli `slide-*` diversi da quelli verso sinistra, `dark:`, `ring-[3px]`,
     `ring-ring/50`, `duration-200|300|500`.
2. **Componenti non adattati.** Ogni file sotto `new-bo/src/components/ui/` deve contenere
   `// stile C: adattato secondo docs/ui.md`. Un componente appena aggiunto con `shadcn add` non
   ce l'ha e blocca la build. Serve per le classi che il grep non può distinguere da quelle
   valide: `p-6`, `gap-2`, `size-4`, `text-sm` esistono anche nello stile C, ma con un altro
   significato.

```bash
#!/usr/bin/env bash
# Controllo delle classi Tailwind nei componenti di new-bo (docs/ui.md, «Adattare i componenti shadcn»).
dir="${1:-new-bo/src}"
pattern='(^|[\s"'"'"'`:])(-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|size|h|w|min-h|min-w|max-h|max-w|top|right|bottom|left|inset|inset-x|inset-y|translate-x|translate-y|scroll-my|scroll-py)-([0-9]+\.5|1|5|9)|(h|w|size)-(3|4|5|6|7|8)|(bg|text|border|ring|fill|stroke|from|to|via|outline|shadow)-(black|white|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})(/[0-9]+)?|shadow-(2xs|xs|sm|md|lg|xl|2xl)|rounded(-(xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[[^]]*\]))?|tracking-(tighter|tight|widest)|(max-w|min-w)-(lg|sm|xs|xl|2xl)|zoom-(in|out)-[0-9]+|slide-(in-from|out-to)-(top|bottom|right)(-[0-9]+)?|dark:[^\s"'"'"'`]+|ring-\[3px\]|ring-ring/50|duration-(200|300|500))(?=$|[\s"'"'"'`])'
rg -n --pcre2 -o "$pattern" "$dir" -g '*.tsx' -g '*.ts'
status_classi=$?   # 0 = trovate classi vietate
mancanti=$(rg --files-without-match --fixed-strings 'stile C: adattato secondo docs/ui.md' "$dir/components/ui" -g '*.tsx' 2>/dev/null)
[ -n "$mancanti" ] && printf 'Componenti non adattati:\n%s\n' "$mancanti"
[ $status_classi -eq 1 ] && [ -z "$mancanti" ]
```

L'ho provato il 2026-11-16 in tutti e due i sensi:
- sui 14 sorgenti shadcn di questa sezione trova 179 classi da sostituire e blocca tutti i file,
  che non hanno l'intestazione;
- sulle 128 classi delle tabelle di [Componenti](#componenti), più le sostituzioni consigliate
  qui sopra, in un file con l'intestazione, non segnala nulla ed esce con 0;
- un Badge ripulito a mano ma senza intestazione viene bloccato. Il grep trova ancora `gap-1`,
  `py-0.5` e `size-3`.

Il controllo non vede i valori costruiti a runtime (template string con variabili). Per quelli
vale la regola: le classi si scrivono intere.

## Schermate

Per ogni schermata ci sono i formati in cui è disegnata, i componenti usati (ricavati dalle
istanze del file) e le funzioni coperte.

| Schermata | Formati | Componenti | Funzioni |
|---|---|---|---|
| Login | 390 · 1180 · 1440 | Dialog `retro`, Input `retro`, Button `retro` | F-AU-01 |
| Login · errore | 390 · 1180 · 1440 | come Login + Alert `destructive` | F-AU-01 (401), V-04 (429) |
| Menu (solo 390) | 390 | Sheet sopra l'elenco episodi, Barra app `mobile`, Avatar, Button | F-AU-02, F-AU-03, F-AU-04 |
| Elenco episodi | 390 · 1180 · 1440 | Barra app, Sidebar (1180, 1440), Button, Input, Select, Checkbox, Badge, Avatar, TableHeader e TableRow (1180, 1440), Card `scheda-episodio` (390), Pagination, PaginationLink | F-EP-01, F-EP-02, F-EP-03, F-EP-04, F-EP-08 (in blocco) |
| Modifica episodio | 390 · 1180 · 1440 | Barra app, Sidebar (1180, 1440), Button, Input, Textarea, Select, Switch, Badge, Avatar, Card, TableHeader e TableRow `associazioni` (1180, 1440) | F-EP-05, F-EP-07, F-EP-09, F-EP-10, F-EP-11, F-AS-03 |
| Modifica episodio · conferma eliminazione | 390 · 1180 · 1440 | come Modifica episodio + Dialog, Alert | F-EP-08 |
| Modifica episodio · scelta videogame | 390 · 1180 · 1440 | come Modifica episodio + Combobox, ComboboxItem, TableRow `nuova` | F-EP-09, F-VG-03 |
| Elenco videogame | 390 · 1180 · 1440 | Barra app, Sidebar (1180, 1440), Button, Input, Select, Checkbox, Avatar, TableHeader e TableRow (1180, 1440), Card `scheda-videogame` (390), Pagination, PaginationLink | F-VG-01, F-VG-02, F-VG-03, F-VG-07 (in blocco) |
| Nuovo videogame | 390 · 1180 · 1440 | Barra app, Sidebar (1180, 1440), Button, Input (`errore`; `slug` prima dell'invio), Textarea, Avatar, Alert `warning`, Toast, Card | F-VG-05 |
| Modifica videogame | 390 · 1180 · 1440 | Barra app, Sidebar (1180, 1440), Button, Input, Textarea, Avatar, Card, TableHeader e TableRow `episodi-citati` e Pagination `compatta` (1180, 1440) | F-VG-04, F-VG-06, F-VG-07, F-VG-08, F-AS-01 |
| Elenco utenti | 390 · 1180 · 1440 | Barra app, Sidebar (1180, 1440), Button, Input, Select, Checkbox, Badge (390), Avatar, TableHeader e TableRow (1180, 1440), Card `scheda-utente` (390), Pagination, PaginationLink | F-UT-01, F-UT-02, F-UT-06 (in blocco), F-AU-04 |
| Modifica utente | 390 · 1180 · 1440 | Barra app, Sidebar (1180, 1440), Button, Input, Switch, Avatar, Card | F-UT-03, F-UT-05, F-UT-06 |

Funzioni senza una schermata propria:
- **F-AU-05** (rivalidazione della sessione): si vede solo come ritorno al login dopo un 401.
- **F-AS-02** (dettaglio di un'associazione per id): esiste solo nell'API, `/bo` non lo usa.
- **F-EP-06 e F-UT-04:** sono le schermate non disegnate qui sotto.

A 390 le righe degli episodi citati in «Modifica videogame» sono frame semplici, non istanze di
TableRow: si comportano come le righe di `episodi-citati`, una per riga, con «▸».

## Comportamento responsive

I tre formati corrispondono ai breakpoint di default di Tailwind, che il blocco `@theme` non
azzera (approvati da Paolo):

| Formato del disegno | Larghezza | Prefisso |
|---|---|---|
| 390 | sotto 1024 px | nessuno (mobile first) |
| 1180 | da 1024 px (`lg`) | `lg:` |
| 1440 | da 1280 px (`xl`) | `xl:` |

Cosa cambia:

- **Navigazione.**
  - 390: Barra app `mobile` (56 px) con «≡», che apre lo **Sheet** da sinistra sopra un velo
    `bg-velo`.
  - 1180: Barra app `desktop` (64 px) e **Sidebar `rotaia`** (88 px, icone con l'etichetta
    sotto). Con il menu intero le colonne della tabella episodi non ci stanno.
  - 1440: **Sidebar `espansa`** (232 px).
- **Area principale.**
  - Desktop: a destra della Sidebar, con `bg-linear-to-b from-cielo to-rosa`, bordo sinistro
    di 3 px `inchiostro` e padding `pt-28 pb-40`, `px-32` a 1440 e `px-24` a 1180. È alta
    almeno quanto lo schermo meno la barra (836 px a 1440, 756 a 1180).
  - 390: padding `pt-16 px-16 pb-24` e `gap-18` tra i pannelli.
- **Elenchi.**
  - Desktop: tabella (TableHeader + TableRow) con la Pagination `desktop`.
  - 390: Card `scheda-*` con la Pagination `mobile`.
  - La ricerca è sempre visibile. Il filtro «Pubblicato» e «+ AGGIUNGI FILTRO» stanno accanto
    alla ricerca su desktop e in una riga sotto a 390, insieme a «ORDINA» (a 390 l'ordinamento
    non ha le intestazioni cliccabili).
- **Associazioni** (modifica episodio).
  - Desktop: una **tabella**, una riga per gioco, con TableHeader `associazioni`.
  - 390: una scheda bianca per associazione, con i campi in colonna e ognuno su una riga sua:
    videogame + ✕, istante, tipologia, speaker.
  - «+ AGGIUNGI VIDEOGAME» chiude il pannello in tutti i formati.
- **Form.** Su desktop i pannelli stanno in una griglia di due colonne, larghe 737 e 380 px a
  1440. Le tabelle stanno sotto la griglia, a tutta larghezza. A 390 c'è una colonna sola, in
  quest'ordine:

  | Schermata | Colonna sinistra (desktop) | Colonna destra (desktop) | Sotto la griglia | Ordine a 390 |
  |---|---|---|---|---|
  | Modifica episodio | DATI EPISODIO, DESCRIZIONI E NOTE | COVER, LINK | VIDEOGIOCHI CITATI (tabella) | dati, cover, link, videogiochi citati, descrizioni e note |
  | Nuovo videogame | GIOCO SU RAWG, DATI DEL GIOCO | QUEST LOG | — | errore (Toast), gioco su RAWG, quest log, dati del gioco |
  | Modifica videogame | DATI DEL GIOCO | COVER, DATI RAWG GIÀ PRESENTI, RAWG JSON | EPISODI IN CUI È CITATO (tabella) | cover, dati RAWG già presenti, dati del gioco, RAWG JSON, episodi citati |
  | Modifica utente | ACCOUNT, PERMESSI | REGOLE DEL GIOCO, REGISTRO | — | account, permessi, regole del gioco, registro |
- **Barra delle azioni** (`bg-inchiostro`).
  - Desktop: in fondo al contenuto, `py-12 px-16`, con ELIMINA a sinistra e ANNULLA + SALVA a
    destra. In «Modifica episodio», «Modifica videogame» e «Modifica utente» a destra ci sono
    ANNULLA · SALVA E CONTINUA · ▶ SALVA, con `gap-12`.
  - 390: **fissa in basso** (sticky), `pt-12 pb-20 px-16 gap-12`. ANNULLA è largo quanto il
    suo testo e SALVA occupa il resto. ELIMINA sta nel contenuto, in fondo all'ultimo pannello,
    come Button `destructive` a tutta larghezza. In «Modifica episodio», «Modifica videogame» e
    «Modifica utente» la barra ha due righe (`gap-12`): sopra SALVA E CONTINUA a tutta
    larghezza, sotto ANNULLA + SALVA come sopra.
- **Toast.**
  - Desktop: in alto a destra, 24 px dal bordo destro e 20 px sotto la barra app, largo
    420 px.
  - 390: nel flusso, in cima al contenuto, a tutta larghezza.
- **Dialog:** `default` (460 px) su desktop, `sm` (342 px) a 390, sempre centrato.
- **Combobox:** si apre sotto il campo videogame, largo 460 px su desktop e a tutta larghezza
  a 390.
- **Login:** stessa cornice `retro` centrata, 500 px su desktop e quasi tutta la larghezza a
  390. Il paesaggio (nuvole, erba, joypad) si adatta alla larghezza; nello stato d'errore a 390
  il joypad e le scintille sono nascosti per fare spazio all'Alert.
- **Sotto 390 (da 300 px, 3.6c.4c):** valgono le regole di 390, più poche correzioni con il prefisso `max-[390px]:` (da 390 in su non cambiano nulla): RETROBOTTEGA del login scala con la viewport da 32 fino a 22 px; «+ FILTRO» va a capo sotto il filtro; il selettore delle righe per pagina non si stringe; nella barra delle azioni ANNULLA ha `px-12` e SALVA/CREA `px-10 gap-8 tracking-wide`. I valori lunghi troncati con i puntini restano troncati, come a 390. A tutte le larghezze, nei titoli di pagina e nel testo delle conferme le parole lunghe (per esempio uno username) vanno a capo (`wrap-anywhere`).

## Schermate non disegnate

### Nuovo episodio (F-EP-06)

Stessa schermata di «Modifica episodio», con queste differenze:

- titolo «Nuovo episodio» e «◀ EPISODI» per tornare all'elenco; niente badge di stato
  nell'intestazione;
- valori iniziali: durata `0:30:00`, pubblicato spento (Switch `checked=false`), gli altri
  campi vuoti con il placeholder;
- cover: solo l'area per scegliere il PNG («Solo PNG · max 10 MB»), senza SOSTITUISCI e
  RIMUOVI. Il file si carica dopo il salvataggio (F-EP-10); se l'upload fallisce, l'episodio
  appena creato si cancella e il Toast mostra l'errore;
- associazioni: il pannello parte vuoto, con «+ AGGIUNGI VIDEOGAME». Una riga nuova ha
  istante `0:00:00`, speaker «Tutti» e tipologia «Chiacchiera libera» (F-EP-09);
- niente «✕ ELIMINA EPISODIO»;
- barra delle azioni: ANNULLA e «▶ CREA». Dopo il salvataggio si apre la modifica del nuovo
  episodio.

### «SALVA E CONTINUA» in Modifica episodio, Modifica videogame e Modifica utente

Miglioria fuori specifica decisa da Paolo (Fase 3.6c.2b per l'episodio, 3.6c.3a per il
videogame, 3.6c.3b per l'utente), solo nelle tre schermate di modifica: non c'è in «Nuovo
episodio», «Nuovo videogame» e «Nuovo utente», dove «▶ CREA» e «▶ CREA DA RAWG» aprono già la
modifica.

- Button `secondary` · `lg`, come ANNULLA; posizione nella [barra delle
  azioni](#comportamento-responsive), la stessa nelle tre schermate.
- Salva come «▶ SALVA» ma resta sulla pagina: il form si reimposta con i dati restituiti dal
  server, l'intestazione mostra il titolo salvato e il form torna «non modificato». Se durante
  l'invio si modifica il form, quelle modifiche restano (e il form resta «modificato»), da
  salvare con l'invio successivo.
  - Episodio: cover compresa; le associazioni nuove prendono il loro id e si riordinano per
    istante, la cover mostra il file caricato, l'intestazione anche lo stato. Un secondo invio
    senza modifiche non crea associazioni doppie né ricarica la cover.
  - Videogame: se il server ha interrogato RAWG (F-VG-06, record senza `rawg_json`), il form
    mostra i dati arrivati da RAWG.
  - Utente: il campo «Nuova password» torna vuoto, quindi un secondo invio senza modifiche non
    cambia la password.
- Riuscito: Toast `success` «CHECKPOINT · Modifiche salvate».
- Errore: come «▶ SALVA», Toast `destructive` e il form resta com'era.
- Durante l'invio il bottone premuto mostra «Attendi…». INVIO in un campo resta «▶ SALVA».

### Nuovo videogame dal form dell'episodio

Miglioria fuori specifica decisa da Paolo (Fase 3.6c.4a), al posto del popup di Django: si crea
un videogame senza lasciare «Modifica episodio» o «Nuovo episodio».

1. **Dove si apre.** Nel piede del Combobox della scelta videogame c'è «Il gioco non c'è?» con
   «+ CREALO QUI», anche quando l'elenco dice «Nessun videogame trovato.». Vale a 390, 1180 e
   1440 (a 390 nell'overlay di scelta), in «Modifica episodio» e in «Nuovo episodio». Da
   tastiera, con l'elenco aperto TAB dal campo porta a «+ CREALO QUI» del piede; ESC da lì chiude
   l'elenco e torna al campo.
2. **Il Dialog.** Modale grande sopra il velo `bg-velo`:
   - desktop: occupa la viewport con 32 px di margine per lato, `bg-crema border-3
     border-inchiostro shadow-pixel-xl shadow-viola`; a 390 tutto lo schermo, senza bordo;
   - testata alta 64 px (56 a 390) con «▶ NUOVO VIDEOGAME» (`text-md font-extrabold viola`, è
     il titolo del dialogo) e «✕» (40 × 40, `bg-bianco border-2`), separata da un bordo di 3 px;
   - il corpo scorre dentro il Dialog, con il fondo dell'area principale (`from-cielo
     to-rosa`) e i suoi padding;
   - dentro c'è il form di [Nuovo videogame](#schermate) così com'è, con i suoi pannelli e la
     sua barra delle azioni (ANNULLA, «▶ CREA DA RAWG»; a 390 fissa in fondo al Dialog); solo il
     terzo passo del QUEST LOG cambia: «Il videogame finisce nella riga dell'episodio, che resta
     da salvare.»;
   - all'apertura il focus va sullo slug;
   - lo slug parte dal testo cercato nel Combobox convertito in slug: minuscole, senza accenti,
     gli apostrofi spariscono (come negli slug di RAWG: «Assassin's Creed» → «assassins-creed»),
     ogni sequenza di spazi e altri simboli diventa un «-», niente «-» in testa e in coda. Testo
     vuoto → slug vuoto.
3. **Creazione riuscita.** Il Dialog si chiude, la riga dell'associazione da cui era partito ha
   il nuovo videogame già scelto e il focus torna sul suo campo videogame; Toast `success`
   «CHECKPOINT · Videogame creato: <titolo>». L'episodio non si salva: il form resta
   «modificato», con le modifiche fatte prima di aprire il Dialog.
4. **Errori** (RAWG, slug già usato): come in «Nuovo videogame», Toast `destructive` e slug
   rosso; il Dialog resta aperto. Il Toast sta sopra il Dialog e si chiude con «✕» senza chiudere
   il Dialog. Su desktop è nella posizione solita; a 390 sta in basso, 120 px sopra il bordo
   dello schermo (sopra la barra delle azioni), per non coprire lo slug da correggere.
5. **Chiusura senza creare.** ANNULLA, «✕», ESC o un clic sul velo chiudono il Dialog senza
   chiedere conferma e tolgono l'eventuale Toast d'errore; la riga resta com'era e il focus
   torna sul suo campo videogame. Mentre «▶ CREA DA RAWG» è in corso il Dialog non si chiude.

### Nuovo utente (F-UT-04)

Stessa schermata di «Modifica utente», con queste differenze:

- titolo «Nuovo utente»;
- PASSWORD * obbligatoria, senza il suggerimento «Lascia vuoto per non cambiarla»;
- permessi iniziali: staff e attivo accesi, superuser spento;
- niente pannello «REGISTRO» (ultimo accesso, iscritto dal) e niente «✕ ELIMINA UTENTE»;
- barra delle azioni: ANNULLA e «▶ CREA». Dopo il salvataggio si apre la modifica. Un
  username già usato dà nel Toast «Esiste già un utente con questo username».

### Cambia parola d'ordine (F-AU-06)

Indirizzo `/bo/password`, per ogni utente staff (anche non superuser). Si apre da
PAROLA D'ORDINE nella [Barra app](#barra-app-nessun-equivalente-shadcn) `desktop` (prima di ESCI)
e nello Sheet (sopra ESCI). Stessa griglia e stessa barra delle azioni di «Modifica utente», con
queste differenze:

- occhiello «▶ IL TUO ACCOUNT» al posto di «◀ UTENTI», titolo «Cambia parola d'ordine»;
- colonna sinistra: un solo pannello, «PAROLA D'ORDINE», con tre Input `password` obbligatori,
  in colonna: PAROLA D'ORDINE ATTUALE * (`autocomplete=current-password`), NUOVA PAROLA
  D'ORDINE * (`new-password`, placeholder «Almeno 8 caratteri») e RIPETI LA NUOVA *
  (`new-password`);
- colonna destra: «★ REGOLE DEL GIOCO» con «La nuova parola d'ordine deve avere almeno 8
  caratteri.» e «Qui resti dentro. Le altre sessioni aperte con il tuo account si chiudono: lì
  dovrai rientrare con la nuova.»; niente «REGISTRO» e niente «✕ ELIMINA»;
- a 390 (e sotto, con le regole di «Sotto 390»): pannello, regole, barra delle azioni;
- barra delle azioni: ANNULLA e «▶ SALVA», senza SALVA E CONTINUA. ANNULLA torna alla pagina
  precedente dell'app; se l'indirizzo è stato aperto direttamente, agli episodi.

Errori nel campo: Input `errore` (bordo rosso con `aria-invalid`) e sotto il messaggio in
`text-sm font-bold text-rosso`, collegato con `aria-describedby`. Il messaggio sparisce appena si
modifica il campo.

Prima della richiesta si controlla la nuova, nell'ordine:

- meno di 8 caratteri, contati come punti di codice: «Almeno 8 caratteri» sotto NUOVA PAROLA
  D'ORDINE, e nessuna richiesta. Il server conta i byte, quindi il controllo del client è sempre
  più severo (per esempio «àààà», 4 caratteri e 8 byte, si ferma qui);
- la nuova e la ripetuta non coincidono: «Non coincide con la nuova parola d'ordine» sotto
  RIPETI LA NUOVA, e nessuna richiesta.

Dopo la richiesta:

- password attuale sbagliata, riconosciuta dal messaggio del server («La password attuale non è
  corretta», BAD_USER_INPUT): sotto PAROLA D'ORDINE ATTUALE il testo dell'interfaccia «La parola
  d'ordine attuale non è corretta», con il focus sul campo. La sessione resta aperta;
- gli altri errori del server (per esempio RATE_LIMITED, o «Campo «password»: almeno 8
  caratteri», di riserva) nel Toast `destructive`.
- A successo: Toast `success` «CHECKPOINT» «Parola d'ordine cambiata», i tre campi tornano vuoti e
  si resta sulla pagina.

### Conferme di eliminazione

Tutte usano il Dialog di «Modifica episodio · conferma eliminazione», con lo stesso occhiello,
l'Alert «NON SI PUÒ ANNULLARE», ANNULLA con il focus iniziale e «✕ ELIMINA». **Regola dei
testi:** le entità collegate si chiamano sempre «collegamenti», mai «videogiochi» o «episodi»
da soli, e il testo dice cosa resta.

**Episodio** (F-EP-08), già disegnato, per riferimento:

> ▶ GAME OVER?
> **Eliminare l'episodio?**
> Stai per eliminare «Ep. 312 · Speciale retrogaming» e i suoi 3 collegamenti ai videogiochi
> citati. I videogiochi restano nel catalogo e il file della cover resta sul server.

**Videogame** (F-VG-07). Cancella il videogame e le sue associazioni; gli episodi restano.

> ▶ GAME OVER?
> **Eliminare il videogame?**
> Stai per eliminare «Chrono Trigger» e i suoi 4 collegamenti agli episodi in cui è citato.
> Gli episodi restano nell'archivio.

Il numero dei collegamenti è il totale della tabella «Episodi in cui è citato» (F-VG-08).
Con 0 collegamenti la frase finisce dopo il titolo.

**Utente** (F-UT-06). Cancella l'utente e le sue righe collegate in `django_admin_log`,
`auth_user_groups` e `auth_user_user_permissions`; nient'altro cambia.

> ▶ GAME OVER?
> **Eliminare l'utente?**
> Stai per eliminare l'utente «giulia.b» e i suoi collegamenti a registro, gruppi e permessi.
> Episodi e videogame restano come sono.

**Eliminare sé stessi** (deciso da Paolo). Il proprio utente non si può cancellare, e
l'interfaccia lo impedisce prima del server:
- in «Modifica utente» del proprio account, «✕ ELIMINA UTENTE» è
  [disattivato](#button--button), con il suggerimento «Non puoi cancellare te stesso», e il
  dialogo non si apre;
- nell'elenco utenti la propria riga [non ha la casella](#checkbox--checkbox), quindi non entra
  in un'eliminazione in blocco.

Il Toast d'errore resta come rete di sicurezza. Se il backend risponde 400 (per esempio con dati
non aggiornati), mostra «Non puoi cancellare te stesso».

**In blocco** (F-EP-08, F-VG-07, F-UT-06). Si apre da «✕ ELIMINA SELEZIONATI». Il numero è
quello della selezione. Dall'elenco non si sa quanti collegamenti hanno le righe selezionate,
quindi il testo dice «tutti i loro collegamenti».

> ▶ GAME OVER?
> **Eliminare 2 episodi?**
> Stai per eliminare 2 episodi e tutti i loro collegamenti ai videogiochi citati. I videogiochi
> restano nel catalogo e i file delle cover restano sul server.

> ▶ GAME OVER?
> **Eliminare 2 videogame?**
> Stai per eliminare 2 videogame e tutti i loro collegamenti agli episodi in cui sono citati.
> Gli episodi restano nell'archivio.

> ▶ GAME OVER?
> **Eliminare 2 utenti?**
> Stai per eliminare 2 utenti e tutti i loro collegamenti a registro, gruppi e permessi.
> Episodi e videogame restano come sono.

Con un solo elemento selezionato si usa il singolare («Eliminare 1 episodio?», «Stai per
eliminare 1 episodio e tutti i suoi collegamenti…»). Per gli utenti la selezione non può
comprendere il proprio utente, che non ha la casella. Se il backend risponde comunque 400 per
una riga, le altre si cancellano e il Toast mostra «Non puoi cancellare te stesso».

### Template dei minutaggi

Indirizzo `/bo/template`, **pubblico**: chiunque scarica il template Excel per segnare in quale
punto di un episodio si parla di ogni videogame, e lo manda allo staff, che lo importa nel form
dell'episodio. È sorella del login, quindi fuori dal guard delle pagine dello staff, e non chiama
`/api/graphql`.

Stessa composizione del Login: cielo, nuvole e prato, Dialog `retro` largo al massimo 640 px,
centrato in verticale da `lg`. Dentro:

- titolo «MINUTAGGI» e sotto «di «È uscito Joypad?»», come «RETROBOTTEGA» nel login;
- «Aiutaci a segnare in quale punto di un episodio si parla di ogni videogame.»;
- un elenco numerato di cinque passi: scaricare e aprire il file (Excel, LibreOffice Calc o
  Google Sheets); una riga per videogame, dal menu VIDEOGAME o, se manca, con il RAWG SLUG;
  l'ISTANTE come `1:02:03` o `12:30`; TIPOLOGIA e SPEAKER dal menu, vuoti valgono «Chiacchiera
  libera» e «Tutti»; salvare in .xlsx e mandarlo allo staff;
- Button `retro` · `xl` «▶ SCARICA IL TEMPLATE», a tutta larghezza.

Il file si genera nel browser solo al clic, mai all'apertura della pagina: prima chiede
l'elenco aggiornato dei videogame a `GET /api/template/videogame`, poi scarica
`minutaggi-joypad.xlsx`. Durante la generazione il bottone dice «Attendi…» con `aria-busy`. Se
l'elenco non arriva, sopra il bottone compare l'Alert `destructive` «Non riesco a scaricare
l'elenco dei videogame. Riprova tra poco.» e nessun file viene scaricato. Se invece non si
riesce a preparare il file, per esempio in una pagina aperta prima di un aggiornamento del sito,
l'Alert dice «Non riesco a preparare il file. Ricarica la pagina e riprova.». L'Alert sparisce al
clic successivo.

### Import dei minutaggi da Excel

In «Modifica episodio» e in «Nuovo episodio», sotto le righe di «Videogiochi citati», accanto a
«+ AGGIUNGI VIDEOGAME»: Button `dashed` «IMPORTA DA EXCEL». Il bottone è disegnato in
`new-bo.figcraft`, in tutte le cornici di «Modifica episodio» (frame «azioni associazioni»); i
Dialog dell'import no, e seguono questa sezione. Su desktop sta a destra, largo
quanto il testo, e «+ AGGIUNGI VIDEOGAME» prende il resto; a 390 i due bottoni sono uno sotto
l'altro, a tutta larghezza. Il clic apre la scelta di un file `.xlsx`, cioè un template dei
minutaggi compilato ([Template dei minutaggi](#template-dei-minutaggi)).

Il file sostituisce le righe di «Videogiochi citati», **senza salvare**: le righe importate sono
righe nuove come quelle di «+ AGGIUNGI VIDEOGAME», si modificano e si eliminano, e le scrive
SALVA (o CREA). I passi, in quest'ordine:

1. si legge e si controlla tutto il file, senza chiamate al server. Gli istanti si confrontano con
   la durata scritta in quel momento nel form;
2. se il form ha già delle righe, il Dialog di conferma, prima di qualsiasi chiamata al DB o a
   RAWG. ANNULLA chiude e non cambia niente;
3. si cercano i videogame nel DB; gli slug che non ci sono si creano da RAWG, una volta sola anche
   se sono su più righe. Durante questo passo un Dialog di avanzamento, senza azioni e che ESC non
   chiude, copre il form: «▶ IMPORT DA EXCEL», titolo «Attendi…», e «Cerco i videogame del file
   nel DB.» oppure «Creo i videogame nuovi da RAWG: 1 di 2.». Una richiesta a RAWG può durare
   fino a 15 secondi;
4. le righe nel form, nell'ordine del file, e il Toast `success` «3 righe importate, 1 videogame
   creato da RAWG: ricordati di salvare» (senza la parte su RAWG se non ne crea).

Tutto o niente: con un solo errore, in qualunque passo, compare il Dialog degli errori e il form
resta com'era. I videogame già creati da RAWG restano nel DB, e il Dialog lo dice. Se nel
frattempo si lascia la pagina, alla fine non compare niente. Con la sessione scaduta si torna al
login, come nel resto del `/bo`.

**Dialog di conferma** (Dialog di «Conferme di eliminazione», senza l'Alert «NON SI PUÒ
ANNULLARE»):
> ▶ IMPORT DA EXCEL
> **Sostituire le 2 associazioni presenti con le 3 del file?**
> Le righe di «Videogiochi citati» lasciano il posto a quelle del file. L'episodio non si salva
> finché non premi SALVA.

Azioni: ANNULLA (focus iniziale) e SOSTITUISCI (`destructive-pieno`). Al singolare: «Sostituire
l'associazione presente con quella del file?».

**Dialog degli errori:**
> ▶ IMPORT NON RIUSCITO
> **6 errori nel file** (oppure «Il file non si può importare» per un errore unico, come un file
> che non è un template o la durata del form vuota)
> Il form non è cambiato: correggi il file e riprova.

Sotto, l'elenco degli errori in un riquadro bianco con il bordo inchiostro, alto al massimo 240
px e con lo scorrimento: «**Riga 4:** istante non valido…», con il numero di riga del foglio,
cioè quello che si vede in Excel. Un'unica azione, CHIUDI, a tutta larghezza.

Quando il file non c'entra (il server non risponde, RAWG non risponde in tempo, una pagina
aperta prima di un aggiornamento del sito) il titolo è «Qualcosa è andato storto», il testo «Il
form non è cambiato.» e l'elenco ha il solo messaggio dell'errore, senza numero di riga. Solo lo
slug che RAWG non conosce è un errore di riga; gli altri errori di RAWG fermano l'import.

Limite noto: una cella con un errore di formula (`#N/A`, `#VALUE!`) si legge come vuota. Il
template non ha formule; chi ne usa deve sostituirle con i loro valori prima di importare.

## Prototipo

Il prototipo è nella pagina «Schermate · stile C» di `new-bo.figcraft`. Ha due flussi:

| Flusso | Parte da |
|---|---|
| «Desktop · 1440» | Login · 1440 |
| «Mobile · 390» | Login · 390 |

**Per avviarlo:**
1. Apri il file in FigCraft.
2. Apri il pannello Prototipo (Alt+9) e scegli il flusso.
3. Premi Presenta (Alt+Cmd+Invio, su Linux Ctrl+Alt+Invio).

Impostazioni: device «None» (ogni schermata alla sua misura), non responsive, scala
«Fit width» (le schermate alte scorrono); un clic a vuoto evidenzia le zone cliccabili.

**Transizioni:**
- navigazione: dissolvenza di 120 ms;
- Dialog: overlay centrato con velo `#3A2E5C` al 72 % (= `color/velo`);
- Sheet: entra da sinistra in 150 ms, con lo stesso velo;
- Combobox: compare subito sotto il campo.

**Interazioni sui componenti**, che valgono per tutte le istanze:
- Sidebar `espansa` → elenchi a 1440; Sidebar `rotaia` → elenchi a 1180;
- Barra app `desktop`: ESCI → Login · 1440 (anche dalle schermate a 1180);
- Barra app `mobile`: «≡» → Sheet in overlay. Nello Sheet le voci portano agli elenchi a 390,
  ESCI al Login · 390, «✕» chiude;
- Dialog: ANNULLA chiude l'overlay;
- ComboboxItem: chiude l'overlay;
- Toast: «✕» torna indietro (allo stato prima dell'invio);
- TableRow `associazioni`: il campo videogame apre la scelta del videogame.

**Interazioni sulle istanze**, che dipendono dal formato e sono collegate in tutti e tre:
- **Login:** ENTRA → elenco episodi.
- **Elenchi:**
  - la riga o scheda 312 (episodi), la prima riga (videogame, utenti) → la modifica;
  - «+ NUOVO EPISODIO» → modifica episodio e «+ NUOVO UTENTE» → modifica utente, perché le
    schermate «nuovo» non sono disegnate;
  - «+ NUOVO VIDEOGAME» → «Nuovo videogame · prima dell'invio».
- **Modifiche:** «◀ …», ANNULLA e SALVA → il loro elenco.
- **Modifica episodio:**
  - ELIMINA EPISODIO → overlay di conferma, dove ANNULLA chiude ed ELIMINA porta all'elenco
    episodi;
  - a 390 il campo videogame di un'associazione → overlay di scelta.
- **Nuovo videogame:** CREA DA RAWG → la schermata con il Toast d'errore.

Gli overlay e i frame «prima dell'invio» sono nella stessa pagina, sotto le schermate (righe
y = 12000 e 13500), e non hanno PNG.
