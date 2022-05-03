[![Build Docker and push to registry](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image.yml/badge.svg)](https://github.com/pdonadeo/e-uscito-joypad/actions/workflows/docker-image.yml)

# È uscito Joypad?

Semplice pagina di informazione per sapere se e quando è uscito Joypad, il podcast a tema videoludico di Matteo Bordone (Corri!), Francesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta).

La pagina è pubblicata qui: https://www.euscitojoypad.it/

## Come partecipare al progetto

Per ora siamo ancora in fase di discussione su cosa effettivamente vogliamo aggiungere al progetto. Le discussioni si tengono in pubblico, qui su GitHub nella [pagina Discussions](https://github.com/pdonadeo/e-uscito-joypad/discussions).

Ho attivato la pagina delle donazioni per sostenere eventuali costi di trascrizione degli episodi o di infrastruttura.

Per ora, tuttavia, **non servono fondi quindi aspettate a donare**.

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
