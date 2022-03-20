# È uscito Joypad?

Sito simpatico scritto in OCaml and Dream: https://aantron.github.io/dream/

## Docker

Per buildare l'immagine Docker:

```bash
$ docker build -t gitlab.4sigma.it:5050/pdonadeo/e-uscito-joypad .
$ docker push gitlab.4sigma.it:5050/pdonadeo/e-uscito-joypad
```

Per eseguire l'immagine:
```bash
$ docker run -e ULTIMA_PUNTATA=2022-03-19 --rm -it -p 8000:8000 gitlab.4sigma.it:5050/pdonadeo/e-uscito-joypad
```
