# SOSTITUZIONE DI DJANGO IN UN SIDE-PROJECT

## 1. Descrizione dello stato del progetto
Questo progetto amatoriale consiste in un sito web per la community del podcast
Joypad, che si occupa di critica videoludica per giocatori maturi, dai 30 anni
in su.

Il sito è un semplice "monopagina" con l'elenco degli episodi, la sinossi ed una
immagine di copertina. A ciascun episodio sono associati i giochi di cui i tre
autori del podcast hanno parlato nella puntata, con il minutaggio esatto in cui
se ne è parlato, e chi ne ha parlato.

Esiste anche una piccola funzione di ricerca: il caso d'uso per cui è pensato è
questo. L'ascoltatore del podcast vuole sapere se si è mai parlato di un certo
gioco, e ne digita il nome. Una "tendina" di auto completamento appare con i
nomi dei giochi registrati che fanno match. Una volta selezionato il gioco
appare una selezione di episodi in cui se ne è parlato. L'idea è che se sento
parlare di un certo gioco, vado sul sito, lo cerco e, se lo trovo, ho un link
diretto alla puntata con il minutaggio.

Il backend è scritto in OCaml. Il frontend del sito pubblico è scritto in React
vanilla.

Per il *data entry* e la "gestione" del database c'è un'istanza di Django, del
quale viene utilizzato solo l'app *admin*, con qualche customizzazione ma
fondamentalmente vanilla. Chi fa data entry ascolta l'episodio e annota i giochi
di cui si parla, il minuto ed il secondo, chi ne parla, e cerca il gioco sul
database online RAWG, e annota nell'admin di Django lo *slug* del gioco su RAWG.
Al salvataggio del *game* Django recupera con le API gratuite di RAWG la
descrizione del gioco e una immagine, che vengono salvate nel database.

Davanti al backend c'è un NGINX che fa da reverse proxy e serve i contenuti
statici, sia quelli di Django (cover episodio) sia i bundle React.

Nel progetto c'è anche un bot Discord scritto in Go, ma è di fatto un progetto a
parte e non è oggetto di alcuna modifica. Il bot non va toccato senza mia
richiesta esplicita.

In tutto ci sono dunque 5 container Docker:
1. balancer: NGINX
2. postgresql: il DB
3. app: il backend OCaml
4. backoffice: l'admin Django
5. bot: il bot Discord da non toccare

Col tempo il backoffice Django ha mostrato dei limiti: per un *toy-project*
l'immagine Django col suo virtualenv risulta lento da compilare e pesante: i
salvataggi di una pagina sono lenti, da "web 1.0" e quindi è stato scritto da
Cloude Code un nuovo backoffice, in React, che si appoggia su nuovi endpoint
REST inseriti nel backend OCaml che quindi serve le chiamate del monopagina
pubblico ma anche le chiamate del nuovo backoffice in React. Il risultato è
estremamente veloce e neppure confrontabile con Django sotto ogni punto di vista.

Funzionalmente il nuovo backoffice è identico a quello che fa Django: un CRUD +
qualche filtro custom e la funzione di download di alcuni dati da RAWG, che ora
viene fatta in OCaml.

- Il nuovo backoffice viene servito in `/bo/`
- Il vecchio backoffice in Django è ancora presente in questa fase di transizione
ed è servito in `/legacy-bo/`

## 2. Obbiettivo

L'obbiettivo è eliminare Django, che serve solo per data entry ed il suo "peso"
non è giustificato nel 2026.

La scrittura del nuovo backoffice è stato un *proof of concept* per dimostrare
che è effettivamente possibile riscrivere il CRUD in OCaml e servire un frontend
molto più leggero.

Da questo punto di vista il nuovo backoffice è un successo.

Vogliamo però scrivere un altro backoffice, sempre con tecnologia *client*
(React) ma usando uno stack più evoluto e meno *vanilla* di quello implementato
da Claude Code alla prima iterazione.

Vogliamo usare per il nuovo backoffice:
- React + Typescript
- GraphQL
- TanStack: https://tanstack.com/
- Tailwind CSS
- shadcn/ui: https://ui.shadcn.com/
- Bun: https://bun.sh/
- FigCraft: https://figcraft.org/ per il design delle pagine

## 3. Piano di esecuzione
Si procede una fase alla volta; ogni fase finisce con la mia approvazione.

### 3.1 Analisi
La prima cosa da fare è analizzare il codice presente per comprendere quali
sono le funzionalità dell'admin di Django implementate nel nuovo backoffice.
Ovviamente il backoffice non deve riprodurre *tutto* quello che fa l'admin di
Django in generale, e tanto meno quello che fa Django ma prendere `admin.py`
specifico di questo progetto e riprodurre le stesse funzionalità configurate.
Scrivere un documento di specifica di tutto quello che c'è nell'admin per gli
step successivi.

Output di questa fase: `docs/analisi.md`

### 3.2 Perimetro
Come detto l'obbiettivo è eliminare Django. In una prima fase tuttavia rimane
per un periodo in cui chi fa data entry possa provare i nuovi backoffice e, se
qualcosa non funziona, avere comunque un "failsafe".

- Django è attualmente servito su `/legacy-bo/` e rimane così
- il backoffice "naive" è servito su `/bo/` e rimane così
- il nuovo backoffice di cui stiamo discutendo verrà servito su `/new-bo/`

I bundle del nuovo backoffice vengono serviti nello stesso modo in cui oggi
viene servito il backoffice "naive".

GraphQL viene aggiunto agli endpoint REST e non li sostituisce, almeno finché
esiste il backoffice "naive".

Spegnere Django è out of scope, verrà fatto in un'altra sessione di lavoro.

Per questa ragione l'autenticazione sul nuovo backoffice usa le tabelle di
Django ed è compatibile con Django stesso, come fa già il backoffice "naive".

Il codice di Django, il backoffice "naive" e gli endpoint REST non si
modificano.

Il bot Discord è completamente out of scope e non si modifica.

### 3.3 Schema GraphQL
Scrittura di uno schema GraphQL che sarà il principale contratto tra backend
in OCaml e frontend.

Output di questa fase: `docs/schema.graphql`

### 3.4 UI
Creazione di una UI "cute" e "molto nerd" (si tratta pur sempre di un podcast
di videogiochi)
  1. verificare il collegamento con MCP di FigCraft
  2. costruire una UI completa che svolga i compiti che svolgeva l'admin di Django
  3. sottoporre a validazione mia, con loop di modifiche "visual"
  4. nel progetto usare componenti di shadcn/ui
  5. le pagine devono essere fruibili da desktop e mobile (telefoni verticali e
     tablet orizzontali)
  6. generare una specifica "in qualche modo" per gli step successivi. Non
     conosco questo work flow perché non sono un grafico o un experto UI/UX, non
     so se da FigCraft / Figma e strumenti del genere si produce del codice,
     dell'HTML o cosa.

Output di questa fase: `docs/` in una qualche forma che in questo momento non
conosco, per esempio un file progetto di FigCraft? Non ne sono certo.


### 3.5 Test
Scrivere almeno un test per ogni query e mutation dello schema, più i casi di
autenticazione, prima di scrivere il codice frontend e backend.


### 3.6 Sviluppo
Due agent in team iniziano lo sviluppo di frontend e backend, usando i documenti
di specifica e lo schema GraphQL scritti in precedenza.


### 3.7 Verifica
Una volta che lo sviluppo di front e back sono completati occorre verificare il
contratto:
 - ogni funzione di admin.py elencata nell'analisi è presente nel nuovo backoffice
 - il sito pubblico e /bo/ funzionano come prima;
 - i test Playwright esistenti passano, oltre a quelli nuovi per /new-bo/.
