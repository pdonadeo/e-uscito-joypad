[![Build Docker and push to registry](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image-dream.yml/badge.svg)](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image-dream.yml)

[![Build Docker and push to registry (Django)](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image-django.yml/badge.svg?branch=main)](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image-django.yml)

[![CodeQL](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/codeql-analysis.yml/badge.svg?branch=main)](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/codeql-analysis.yml)

# È uscito Joypad?

Semplice pagina di informazione per sapere se e quando è uscito Joypad, il podcast a tema videoludico di Matteo Bordone (Corri!), Francesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta).

La pagina è pubblicata qui: https://www.euscitojoypad.it/

Il sito contiene un motore di ricerca col quale è possibile inserire il titolo di un gioco e scoprire in quale episodio di Joypad se ne è parlato con il minuto esatto, per poter riascoltare la recensione.

## Come partecipare al progetto

Per ora siamo ancora in fase di discussione su cosa effettivamente vogliamo aggiungere al progetto. Le discussioni si tengono in pubblico, qui su GitHub nella [pagina Discussions](https://github.com/pdonadeo/e-uscito-joypad/discussions).

Ho attivato la pagina delle donazioni per sostenere eventuali costi di trascrizione degli episodi o di infrastruttura.

Per ora, tuttavia, **non servono fondi quindi aspettate a donare**.

## Come faccio girare il progetto sul mio PC?

Se tutto quello che vi interessa è far partire il progetto seguite le istruzioni per la prima shell qui sotto.

### Prima shell: database + API backend + backoffice + frontend (Docker Compose)

1. _(su OSX è indispensabile installare l'ultima versione di Docker e abilitare le ottimizzazioni)_

2. fai fork del progetto da GitHub: https://github.com/pdonadeo/e-uscito-joypad

3. clona il **tuo** repository:

   `git clone git@github.com:TuoUsernameGithub/e-uscito-joypad.git`

   `cd e-uscito-joypad`

4. esegui il backend: `docker-compose up --build -d`

   _(la prima volta potrebbe richiedere una decina di minuti)_

   _(su OSX il comando si chiama `docker compose` senza trattino)_

Questo farà partire un servizio sulla porta 5000. Per verificare che stia funzionando apri il browser su http://localhost:5000/

Per sviluppare il frontend, realizzato con [React](https://reactjs.org/), occorre far partire **una seconda shell**.

### Seconda shell: frontend (React)

Qui do per scontato che si conosca lo sviluppo in ambiente Javascript e siano già installati tool come [Yarn](https://yarnpkg.com/), [Node.js](https://nodejs.org/en/) e un editor adatto: io uso [Visual Studio Code](https://code.visualstudio.com/).

1. entra nella directory del frontend:

   `cd e-uscito-joypad/frontend/`

2. solo la prima volta: `yarn install` per installare tutte le dipendenze

3. `yarn dev` per far partire il server di sviluppo. Per verificare che stia funzionando vai col browser su http://localhost:3000/ .

A questo punto è possibile procedere col normale sviluppo del frontend, testando sulla porta 3000: il client React è configurato con un proxy che inoltra le chiamate API che arrivano sulla porta 3000 al backend che gira sulla 5000.

## Dettagli tecnici

### Linguaggio e framework

L'applicazione principale è scritta in [OCaml](https://ocaml.org/) utilizzando lo splendido framework web [Dream](https://aantron.github.io/dream/) di [Anton Bachin](https://github.com/aantron).

Il database utilizzato è [PostgreSQL](https://www.postgresql.org/).

### Backoffice

Per il _data entry_ di episodi e giochi occorre un [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) di accesso al database. È stato realizzato con [Django](https://www.djangoproject.com/) e, una volta fatto partire il progetto con `docker-compose`, è accessibile a questo indirizzo: http://localhost:5000/bo/

### Variabili d'ambiente per la configurazione del progetto

Le variabili di configurazione del progetto sono contenute nel file `compose_env_devel`. In particolare è poossibile modificare le password di accesso al backoffice, specialmente dell'utente `admin`.

**⚠️⚠️⚠️ FATE ATTENZIONE A NON COMMITTARE PASSWORD REALMENTE UTILIZZATE IN PRODUZIONE ⚠️⚠️⚠️**
