# È uscito Joypad?

Semplice pagina di informazione per sapere se e quando è uscito Joypad, il podcast a tema videoludico di Matteo Bordone (Corri!), Francesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta).

La pagina è pubblicata qui: https://www.euscitojoypad.it/

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
