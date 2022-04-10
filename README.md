# È uscito Joypad?

Una semplice pagina web per sapere se è uscito e quando l'ultimo episodio di Joypad, il podcast di Matteo Bordone, Alessandro Zampini e Francesco Fossetti.

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
