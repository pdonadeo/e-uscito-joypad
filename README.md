[![Build Docker and push to registry](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image-dream.yml/badge.svg)](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image-dream.yml)

# È uscito Joypad?

Semplice pagina di informazione per sapere se e quando è uscito Joypad, il podcast a tema videoludico di Matteo Bordone (Corri!), Francesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta).

La pagina è pubblicata qui: https://www.euscitojoypad.it/

## Come partecipare al progetto

Per ora siamo ancora in fase di discussione su cosa effettivamente vogliamo aggiungere al progetto. Le discussioni si tengono in pubblico, qui su GitHub nella [pagina Discussions](https://github.com/pdonadeo/e-uscito-joypad/discussions).

Ho attivato la pagina delle donazioni per sostenere eventuali costi di trascrizione degli episodi o di infrastruttura.

Per ora, tuttavia, **non servono fondi quindi aspettate a donare**.

## Sviluppare in frontend in React

Per sviluppare il frontend, realizzato con [React](https://reactjs.org/), occorre far partire **due shell**, la prima per eseguire il backend e la seconda per sviluppare il frontend.

### Prima shell: backend (Docker)

1. (su OSX è indispensabile installare l'ultima versione di Docker e abilitare le ottimizzazioni)
2. fai fork del progetto da GitHub: https://github.com/pdonadeo/e-uscito-joypad
3. entra nella directory del progetto:

   `git clone git@github.com:TuoUsername/e-uscito-joypad.git`

   `cd e-uscito-joypad`

4. build dell'immagine: `docker build -t e-uscito-joypad .`

   *(la prima volta potrebbe richiedere una decina di minuti)*
5. esegui il backend: `docker run --rm -it -p 3000:3000 e-uscito-joypad`

Questo farà partire un servizio sulla porta 3000. Per verificare che stia funzionando apri il browser su http://localhost:3000/

### Seconda shell: frontend (React)

Qui do per scontato che si conosca lo sviluppo in ambiente Javascript e siano già installati tool come [Yarn](https://yarnpkg.com/), [Node.js](https://nodejs.org/en/) e un editor adatto: io uso [Visual Studio Code](https://code.visualstudio.com/).

1. entra nella directory del frontend:

   `cd e-uscito-joypad/frontend/`

2. solo la prima volta: `yarn install` per installare tutte le dipendenze
3. `yarn start` per far partire il server di sviluppo. Attenzione: Yarn si lamenterà che la porta di default (3000) è già occupata ed è vero perché il backend ascolta proprio su quella porta. Domanderà se usarne un'altra, rispondere **Y**. Si metterà in ascolto sulla prima porta disponibile, tipicamente 3001. Per verificare che stia funzionando vai col browser su http://localhost:3001/ .

A questo punto è possibile procedere col normale sviluppo del frontend, testando sulla porta 3001 anziché la 3000. A parte il numero della porta non cambia nulla rispetto al normale workflow.

## Dettagli tecnici

### Linguaggio e framework

L'applicazione è scritta in [OCaml](https://ocaml.org/) utilizzando lo splendido web framework [Dream](https://aantron.github.io/dream/) di [Anton Bachin](https://github.com/aantron).

### Docker

Se non sapete cosa siano OCaml o Dream potete fare una build di Docker *senza sapere né leggere né scrivere*:

```bash
$ docker build -t e-uscito-joypad .
```

Per eseguire l'immagine:
```bash
$ docker run --rm -it -p 3000:3000 e-uscito-joypad
```

Poi apri il browser su http://localhost:3000/
