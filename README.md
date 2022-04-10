# È uscito Joypad?

Sito simpatico scritto in OCaml and Dream: https://aantron.github.io/dream/
Una semplice pagina web per sapere se è uscito e quando l'ultimo episodio di Joypad, il podcast di Matteo Bordone, Alessandro Zampini e Francesco Fossetti

## Docker

Per buildare l'immagine Docker:

```bash
$ docker build -t gitlab.4sigma.it:5050/pdonadeo/e-uscito-joypad .
$ docker push gitlab.4sigma.it:5050/pdonadeo/e-uscito-joypad
```

Per eseguire l'immagine:
```bash
$ docker run --rm -it -p 3000:3000 gitlab.4sigma.it:5050/pdonadeo/e-uscito-joypad
```
