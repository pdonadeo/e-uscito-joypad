#!/usr/bin/env bash
# Prova del rilascio su una copia della produzione (via-django, Fase 8).
#
#   scripts/prova-dump-produzione.sh [--immagine <ref> | --binario <percorso>] <file.dump>
#
# Carica il dump (pg_dump -Fc) in un PostgreSQL usa e getta, senza dati su disco, e mette a
# confronto tre server:
#   3912  l'immagine in produzione oggi (sha-100d7e5) sul dump intatto;
#   3911  la versione nuova sul dump, che il runner migra (0001 registrata, 0002 applicata);
#   3913  la versione nuova su un DB vuoto, che il runner crea da zero.
# La versione nuova è --immagine (il modo del deploy: l'immagine che va in produzione) oppure
# --binario (default _build/default/src/e_uscito_joypad.exe, solo durante lo sviluppo).
#
# Ogni controllo scrive una riga OK o FALLITO. Né lo schermo né il log contengono righe di dati:
# solo conteggi, esiti, nomi di tabelle e di migrazioni, URL, status HTTP, dimensioni e hash.
# Il log va in dump-prod/prova-<data>.log, con permessi 600.
#
# Uscita: 0 se tutti i controlli sono OK; 1 se almeno uno è FALLITO; 2 se lo script rifiuta di
# partire (dump con permessi diversi da 600, suite API in corso, porte o nomi occupati).

set -uo pipefail
umask 077

RADICE=$(cd "$(dirname "$0")/.." && pwd)
IMMAGINE_VECCHIA=ghcr.io/pdonadeo/e-uscito-joypad:sha-100d7e5
IMMAGINE_PG=postgres:15-alpine
RETE=euj-prova-dump
PG=euj-prova-dump-pg
CONTENITORI=("$PG" euj-prova-dump-vecchia euj-prova-dump-nuova euj-prova-dump-da-zero)
PORTA_PG=55432
PORTA_NUOVA=3911
PORTA_VECCHIA=3912
PORTA_DA_ZERO=3913
PORTE_SUITE=(3901 3902)
TABELLE=(auth_user backoffice_associazioneepisodiovideogame backoffice_episodio backoffice_videogame)
RUOLO=django_db_user
# Superuser temporaneo per la prova di cancellazione: primo vettore di tests/api/vettori-hash.json
# (hash generato con Django 6.1.3; dati di prova, non di produzione).
VETTORE_PASSWORD='Joypad-2026!'
VETTORE_HASH='pbkdf2_sha256$1500000$yhLnIquxfBdDv6NmpbyUCT$8ySOWfSIkaL0KDYDduuiKxNqWXEpwRuKSxu0LJ+dUzI='

uso() {
  echo "uso: $0 [--immagine <ref> | --binario <percorso>] <file.dump>" >&2
  exit 2
}

IMMAGINE= BINARIO= DUMP=
while [ $# -gt 0 ]; do
  case $1 in
    --immagine) [ $# -ge 2 ] || uso; IMMAGINE=$2; shift 2 ;;
    --binario) [ $# -ge 2 ] || uso; BINARIO=$2; shift 2 ;;
    -*) uso ;;
    *) [ -z "$DUMP" ] || uso; DUMP=$1; shift ;;
  esac
done
[ -n "$DUMP" ] || uso
[ -n "$IMMAGINE" ] && [ -n "$BINARIO" ] && uso
[ -z "$IMMAGINE" ] && [ -z "$BINARIO" ] && BINARIO=$RADICE/_build/default/src/e_uscito_joypad.exe

mkdir -p "$RADICE/dump-prod"
LOG=$RADICE/dump-prod/prova-$(date +%Y%m%d-%H%M%S).log
: > "$LOG"
chmod 600 "$LOG"

di() { printf '%s\n' "$*" | tee -a "$LOG"; }
rifiuta() {
  di "RIFIUTO: $*"
  exit 2
}

# ---- Rifiuti: niente è ancora avviato ----

in_ascolto() { (exec 3<> "/dev/tcp/127.0.0.1/$1") 2> /dev/null; }

[ -f "$DUMP" ] || rifiuta "$DUMP non è un file"
permessi=$(stat -c %a "$DUMP")
[ "$permessi" = 600 ] || rifiuta "$DUMP ha permessi $permessi: devono essere esattamente 600 (chmod 600 $DUMP)"
for p in "${PORTE_SUITE[@]}"; do
  in_ascolto "$p" && rifiuta "qualcosa ascolta su $p: la suite API sembra in corso, riprova quando è finita"
done
for p in $PORTA_PG $PORTA_NUOVA $PORTA_VECCHIA $PORTA_DA_ZERO; do
  in_ascolto "$p" && rifiuta "la porta $p è occupata"
done
for c in "${CONTENITORI[@]}"; do
  docker container inspect "$c" > /dev/null 2>&1 && rifiuta "il container $c esiste già (docker rm -fv $c)"
done
docker network inspect "$RETE" > /dev/null 2>&1 && rifiuta "la rete $RETE esiste già (docker network rm $RETE)"
if [ -n "$BINARIO" ]; then
  [ -x "$BINARIO" ] || rifiuta "$BINARIO non è un eseguibile"
else
  docker image inspect "$IMMAGINE" > /dev/null 2>&1 || rifiuta "l'immagine $IMMAGINE non c'è in locale (docker pull $IMMAGINE)"
fi
docker image inspect "$IMMAGINE_VECCHIA" > /dev/null 2>&1 \
  || rifiuta "l'immagine $IMMAGINE_VECCHIA non c'è in locale (docker pull $IMMAGINE_VECCHIA)"

# ---- Pulizia, sempre: anche dopo un errore o un Ctrl-C ----

TMP=$(mktemp -d)
VOLUMI_PRIMA=$(docker volume ls -qf dangling=true | sort)
PID_BINARI=()
FALLITI=0

pulizia() {
  local rc=$?
  trap - EXIT INT TERM
  for pid in "${PID_BINARI[@]}"; do kill "$pid" 2> /dev/null; done
  for pid in "${PID_BINARI[@]}"; do wait "$pid" 2> /dev/null; done
  docker rm -fv "${CONTENITORI[@]}" > /dev/null 2>&1
  docker network rm "$RETE" > /dev/null 2>&1
  rm -rf "$TMP"
  local nuovi
  nuovi=$(comm -13 <(printf '%s\n' "$VOLUMI_PRIMA") <(docker volume ls -qf dangling=true | sort) | grep -v '^$')
  if [ -n "$nuovi" ]; then
    di "FALLITO  niente dati su disco: volumi nuovi rimasti: $(printf '%s' "$nuovi" | paste -sd ' ')"
    [ "$rc" -eq 0 ] && rc=1
  else
    di "OK       niente dati su disco: nessun volume nuovo, container e rete tolti"
  fi
  di "log: $LOG"
  exit "$rc"
}
trap pulizia EXIT
trap 'di "interrotto"; exit 130' INT
trap 'di "terminato"; exit 143' TERM

esito() { # OK|FALLITO descrizione
  if [ "$1" = OK ]; then di "OK       $2"; else di "FALLITO  $2"; FALLITI=$((FALLITI + 1)); fi
}
controlla() { # descrizione atteso trovato
  if [ "$2" = "$3" ]; then esito OK "$1"; else esito FALLITO "$1 (atteso: $2; trovato: $3)"; fi
}
interrompi() {
  esito FALLITO "$1"
  di "ESITO: interrotto dopo un errore di preparazione"
  exit 1
}

casuale() { head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
SU_PASSWORD=$(casuale 32)
RUOLO_PASSWORD=$(casuale 32)
SEGRETO=$(casuale 48)

# psql come superuser sul Postgres usa e getta; output senza intestazioni, campi separati da |
q() { docker exec -i "$PG" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$1" -c "$2"; }

di "== prova sul dump: $(basename "$DUMP") ($(stat -c %s "$DUMP") byte, sha256 $(sha256sum "$DUMP" | cut -c1-16))"
if [ -n "$IMMAGINE" ]; then di "versione nuova: immagine $IMMAGINE"; else di "versione nuova: binario $BINARIO"; fi
di "versione in produzione: $IMMAGINE_VECCHIA"

# ---- Postgres usa e getta ----

docker network create "$RETE" > /dev/null || interrompi "creazione della rete $RETE"
docker run -d --name "$PG" --network "$RETE" -p "127.0.0.1:$PORTA_PG:5432" \
  --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD="$SU_PASSWORD" "$IMMAGINE_PG" > /dev/null \
  || interrompi "avvio del Postgres usa e getta"
for _ in $(seq 1 90); do
  q postgres 'SELECT 1' > /dev/null 2>&1 && docker exec "$PG" pg_isready -q -h 127.0.0.1 && break
  sleep 1
done
q postgres 'SELECT 1' > /dev/null 2>&1 || interrompi "il Postgres usa e getta non risponde"
q postgres "CREATE ROLE $RUOLO NOSUPERUSER CREATEDB NOCREATEROLE LOGIN PASSWORD '$RUOLO_PASSWORD'" > /dev/null \
  || interrompi "creazione del ruolo $RUOLO"
for db in euj_intatto euj_migrato euj_da_zero; do
  q postgres "CREATE DATABASE $db OWNER $RUOLO" > /dev/null || interrompi "creazione del DB $db"
done
for db in euj_intatto euj_migrato; do
  # Gli errori di pg_restore possono citare righe del dump: non si stampano, si conta solo
  # l'uscita. Per i dettagli si rifà il restore a mano.
  docker exec -i "$PG" pg_restore -U postgres --exit-on-error -d "$db" < "$DUMP" > /dev/null 2> "$TMP/restore.err"
  rc=$?
  [ $rc -eq 0 ] || interrompi "restore in $db (pg_restore è uscito con $rc, $(wc -l < "$TMP/restore.err") righe di errore non mostrate)"
  esito OK "restore in $db, proprietari conservati"
done

# ---- Conteggi prima della migrazione ----

conteggi() { # db
  local t
  for t in "${TABELLE[@]}"; do printf '%s=%s ' "$t" "$(q "$1" "SELECT count(*) FROM $t")"; done
}
CONTEGGI_PRIMA=$(conteggi euj_migrato)
di "conteggi in euj_migrato prima della migrazione: $CONTEGGI_PRIMA"

# ---- Tre server, con lo stesso ambiente esplicito ----

MEDIA=$TMP/media
mkdir -p "$MEDIA"
chmod 755 "$TMP" "$MEDIA"
AMBIENTE=(DEBUG=False "DREAM_SECRET=$SEGRETO" MEDIA_URL=bo/files/ TZ=Europe/Rome GC_PERIOD_SEC=3600 RAWG_API_KEY=
  "PGUSER=$RUOLO" "PGPASSWORD=$RUOLO_PASSWORD")

avvia_contenitore() { # nome porta db immagine
  local e=()
  local v
  for v in "${AMBIENTE[@]}" MEDIA_ROOT=/media REST_LISTEN_ADDRESS=0.0.0.0 REST_LISTEN_PORT=3000 \
    "PGHOST=$PG" PGPORT=5432 "PGDATABASE=$3"; do e+=(-e "$v"); done
  docker run -d --name "$1" --network "$RETE" -p "127.0.0.1:$2:3000" -v "$MEDIA:/media" "${e[@]}" "$4" > /dev/null
}
avvia_binario() { # nome porta db
  env -i HOME="$TMP" PATH=/usr/bin:/bin "${AMBIENTE[@]}" "MEDIA_ROOT=$MEDIA" REST_LISTEN_ADDRESS=127.0.0.1 \
    "REST_LISTEN_PORT=$2" PGHOST=127.0.0.1 "PGPORT=$PORTA_PG" "PGDATABASE=$3" "$BINARIO" > "$TMP/$1.log" 2>&1 &
  PID_BINARI+=($!)
}
log_server() { # nome
  if [ -n "$BINARIO" ] && [ "$1" != euj-prova-dump-vecchia ]; then cat "$TMP/$1.log" 2> /dev/null; else docker logs "$1" 2>&1; fi
}
# Le righe del runner, senza il DETAIL e l'HINT di Postgres (possono citare valori)
righe_runner() { log_server "$1" | grep -o 'migrazioni: .*' | sed 's/ — DETAIL: .*//'; }

attendi_server() { # nome porta
  local i
  for i in $(seq 1 120); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$2/api/last-episodes/1/0")" = 200 ] && return 0
    sleep 1
  done
  return 1
}

avvia_contenitore euj-prova-dump-vecchia $PORTA_VECCHIA euj_intatto "$IMMAGINE_VECCHIA" \
  || interrompi "avvio di $IMMAGINE_VECCHIA"
if [ -n "$IMMAGINE" ]; then
  avvia_contenitore euj-prova-dump-nuova $PORTA_NUOVA euj_migrato "$IMMAGINE" || interrompi "avvio della versione nuova"
else
  avvia_binario euj-prova-dump-nuova $PORTA_NUOVA euj_migrato
fi
# Il DB vuoto parte dopo: così euj_migrato e euj_da_zero non si contendono niente nei log.
for s in "euj-prova-dump-vecchia $PORTA_VECCHIA" "euj-prova-dump-nuova $PORTA_NUOVA"; do
  set -- $s
  if ! attendi_server "$1" "$2"; then
    righe_runner "$1" | tee -a "$LOG"
    interrompi "$1 non risponde su $2 entro 120 s"
  fi
done
if [ -n "$IMMAGINE" ]; then
  avvia_contenitore euj-prova-dump-da-zero $PORTA_DA_ZERO euj_da_zero "$IMMAGINE" || interrompi "avvio su euj_da_zero"
else
  avvia_binario euj-prova-dump-da-zero $PORTA_DA_ZERO euj_da_zero
fi
if ! attendi_server euj-prova-dump-da-zero $PORTA_DA_ZERO; then
  righe_runner euj-prova-dump-da-zero | tee -a "$LOG"
  interrompi "euj-prova-dump-da-zero non risponde su $PORTA_DA_ZERO entro 120 s"
fi
di "server pronti: $PORTA_VECCHIA (produzione, euj_intatto), $PORTA_NUOVA (nuova, euj_migrato), $PORTA_DA_ZERO (nuova, euj_da_zero)"

# ---- Controlli ----

di "== migrazione di euj_migrato"
righe_runner euj-prova-dump-nuova | tee -a "$LOG"
log_nuova=$(righe_runner euj-prova-dump-nuova)
if grep -q '0001_schema_di_partenza registrata senza eseguirla' <<< "$log_nuova" \
  && grep -q 'applico 0002_via_tabelle_django' <<< "$log_nuova"; then
  esito OK "log del runner: 0001 registrata senza eseguirla, 0002 applicata"
else
  esito FALLITO "log del runner: mancano «0001_schema_di_partenza registrata senza eseguirla» o «applico 0002_via_tabelle_django»"
fi
controlla "schema_migrations di euj_migrato = {0001 f, 0002 t}" "0001|f,0002|t" \
  "$(q euj_migrato "SELECT string_agg(versione || '|' || eseguita::text::char, ',' ORDER BY versione) FROM schema_migrations")"
controlla "tabelle in public = le 4 dei dati + schema_migrations" \
  "$(printf '%s\n' "${TABELLE[@]}" schema_migrations | sort | paste -sd ,)" \
  "$(q euj_migrato "SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables WHERE schemaname = 'public'")"
controlla "conteggi uguali a prima della migrazione" "$CONTEGGI_PRIMA" "$(conteggi euj_migrato)"
controlla "nessuna FK verso auth_user" 0 \
  "$(q euj_migrato "SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.auth_user'::regclass")"
controlla "schema_migrations di euj_da_zero = {0001 t, 0002 t} (migrato dal runner)" "0001|t,0002|t" \
  "$(q euj_da_zero "SELECT string_agg(versione || '|' || eseguita::text::char, ',' ORDER BY versione) FROM schema_migrations")"

di "== schema: euj_migrato contro euj_da_zero"
"$RADICE/scripts/confronta-schema.sh" "$PG" euj_migrato "$PG" euj_da_zero 2>&1 | tee -a "$LOG"
if [ "${PIPESTATUS[0]}" -eq 0 ]; then esito OK "schema identico (4 tabelle ed estensioni)"; else esito FALLITO "schema identico (4 tabelle ed estensioni)"; fi

di "== cancellazione utente su $PORTA_NUOVA"
ORIGINE=http://127.0.0.1:$PORTA_NUOVA
SUPER=prova_dump_su_$(casuale 8)
PROVA=prova_dump_utente_$(casuale 8)
gql() { # cookie corpo-json -> stampa il corpo della risposta
  curl -s -H 'Content-Type: application/json' -H "Origin: $ORIGINE" ${1:+-H "Cookie: $1"} \
    --data "$2" "$ORIGINE/api/graphql"
}
codici() { grep -o '"code":"[A-Z_]*"' <<< "$1" | paste -sd ' '; }
cancellazione() {
  q euj_migrato "INSERT INTO auth_user (password, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined) VALUES ('$VETTORE_HASH', true, '$SUPER', '', '', '', true, true, now())" > /dev/null \
    || { esito FALLITO "cancellazione utente: inserimento del superuser temporaneo"; return; }
  local intestazioni=$TMP/login.h cookie risposta id
  curl -s -D "$intestazioni" -o /dev/null -H 'Content-Type: application/json' -H "Origin: $ORIGINE" \
    --data "{\"query\":\"mutation(\$c: CredenzialiInput!) { login(credenziali: \$c) { id } }\",\"variables\":{\"c\":{\"username\":\"$SUPER\",\"password\":\"$VETTORE_PASSWORD\"}}}" \
    "$ORIGINE/api/graphql"
  cookie=$(grep -i '^set-cookie: dream.session=' "$intestazioni" | head -1 | sed -E 's/^[^:]*: *([^;]*).*/\1/' | tr -d '\r')
  [ -n "$cookie" ] || { esito FALLITO "cancellazione utente: login del superuser temporaneo (nessun cookie di sessione)"; return; }
  risposta=$(gql "$cookie" "{\"query\":\"mutation { creaUtente(dati: {username: \\\"$PROVA\\\", password: \\\"$(casuale 20)\\\", is_staff: true, is_active: true, is_superuser: false}) { id } }\"}")
  id=$(grep -o '"creaUtente":{"id":[0-9]*' <<< "$risposta" | grep -o '[0-9]*$')
  [ -n "$id" ] || { esito FALLITO "cancellazione utente: creaUtente ($(codici "$risposta"))"; return; }
  risposta=$(gql "$cookie" "{\"query\":\"mutation { eliminaUtente(id: $id) { id } }\"}")
  grep -q "\"eliminaUtente\":{\"id\":$id}" <<< "$risposta" \
    || { esito FALLITO "cancellazione utente: eliminaUtente ($(codici "$risposta"))"; return; }
  controlla "cancellazione utente: creaUtente, eliminaUtente, poi la SELECT non lo trova" 0 \
    "$(q euj_migrato "SELECT count(*) FROM auth_user WHERE username = '$PROVA'")"
}
cancellazione
q euj_migrato "DELETE FROM auth_user WHERE username = '$SUPER'" > /dev/null

di "== API pubbliche: $PORTA_VECCHIA (produzione) contro $PORTA_NUOVA (nuova)"
scarica() { # porta percorso file -> stampa status|content-type
  : > "$3"
  : > "$3.h"
  curl -s -D "$3.h" -o "$3" "http://127.0.0.1:$1$2" > /dev/null
  printf '%s|%s' "$(head -1 "$3.h" | awk '{print $2}')" \
    "$(grep -i '^content-type:' "$3.h" | head -1 | cut -d: -f2- | tr -d ' \r')"
}
# I 500 della REST (Rest.decorator) riportano nel corpo l'URI di connessione al DB, che cambia
# tra i due server (host, porta, nome del DB): si sostituisce con un segnaposto fisso. È l'unica
# normalizzazione.
senza_uri() { sed -E 's#postgresql://[^>"[:space:]]*#postgresql://URI-DEL-DB#g' "$1" > "$1.n"; }
confronta() { # percorso [tentativi]
  local tentativi=${2:-1} n a b
  for n in $(seq 1 "$tentativi"); do
    a=$(scarica $PORTA_VECCHIA "$1" "$TMP/vecchia")
    b=$(scarica $PORTA_NUOVA "$1" "$TMP/nuova")
    if [ "$a" = "$b" ] && cmp -s "$TMP/vecchia" "$TMP/nuova"; then
      esito OK "$1 ($a, $(stat -c %s "$TMP/nuova") byte, sha256 $(sha256sum < "$TMP/nuova" | cut -c1-16))"
      return
    fi
    senza_uri "$TMP/vecchia"
    senza_uri "$TMP/nuova"
    if [ "$a" = "$b" ] && cmp -s "$TMP/vecchia.n" "$TMP/nuova.n"; then
      esito OK "$1 ($a, corpo uguale dopo aver tolto l'URI del DB)"
      return
    fi
    [ "$n" -lt "$tentativi" ] && sleep 10
  done
  esito FALLITO "$1 (produzione: $a, $(stat -c %s "$TMP/vecchia") byte; nuova: $b, $(stat -c %s "$TMP/nuova") byte)"
}
confronta /api/last-episodes/10/0
confronta /api/last-episodes/1000/0
for t in zelda mario pok%C3%A9mon a; do
  confronta "/api/search-game/$t"
  confronta "/api/search-game-title/$t"
done
for id in $(q euj_intatto 'SELECT id FROM backoffice_videogame ORDER BY id LIMIT 5'); do
  confronta "/api/episodes-by-game-id/$id"
done
confronta /sitemap.xml
# dipende dal monitor che legge ilpost.it: fino a 3 tentativi a 10 s
confronta /api/ultima-puntata 3

if [ "$FALLITI" -eq 0 ]; then
  di "ESITO: tutti i controlli OK"
  exit 0
fi
di "ESITO: $FALLITI controlli FALLITO"
exit 1
