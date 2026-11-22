#!/usr/bin/env bash
# Confronta lo schema delle 4 tabelle dei dati e le estensioni di due DB.
#
#   scripts/confronta-schema.sh <container1> <db1> <container2> <db2>
#
# Per ciascun lato usa il pg_dump di quel container. I due lati possono stare
# in container diversi o nello stesso.
#
# Uscita: 0 se schema ed estensioni coincidono; 1 se ci sono differenze
# (stampate a schermo con diff -u); 2 se il confronto non si può fare.

set -uo pipefail

if [ $# -ne 4 ]; then
  echo "uso: $0 <container1> <db1> <container2> <db2>" >&2
  exit 2
fi

c1=$1 db1=$2 c2=$3 db2=$4
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

schema() { # container db file
  docker exec "$1" pg_dump -U postgres -s --no-owner --no-privileges \
    -t backoffice_episodio -t backoffice_videogame \
    -t backoffice_associazioneepisodiovideogame -t auth_user "$2" > "$3.grezzo" \
    || { echo "errore: pg_dump di $2 in $1 fallito" >&2; exit 2; }
  grep -vE '^--|^$|^\\(un)?restrict|^SET ' "$3.grezzo" > "$3"
}

estensioni() { # container db file
  docker exec "$1" psql -X -A -t -v ON_ERROR_STOP=1 -U postgres -d "$2" \
    -c 'SELECT extname, extversion FROM pg_extension ORDER BY 1' > "$3" \
    || { echo "errore: lettura delle estensioni di $2 in $1 fallita" >&2; exit 2; }
}

schema "$c1" "$db1" "$tmp/schema1"
schema "$c2" "$db2" "$tmp/schema2"
estensioni "$c1" "$db1" "$tmp/estensioni1"
estensioni "$c2" "$db2" "$tmp/estensioni2"

esito=0

echo "== schema delle 4 tabelle: $c1/$db1 contro $c2/$db2"
if diff -u --label "$c1/$db1" --label "$c2/$db2" "$tmp/schema1" "$tmp/schema2"; then
  echo "nessuna differenza ($(grep -c '^CREATE TABLE' "$tmp/schema1") tabelle, $(wc -l < "$tmp/schema1") righe confrontate)"
else
  esito=1
fi

echo "== estensioni (nome|versione)"
if diff -u --label "$c1/$db1" --label "$c2/$db2" "$tmp/estensioni1" "$tmp/estensioni2"; then
  echo "nessuna differenza: $(paste -sd ' ' "$tmp/estensioni1")"
else
  esito=1
fi

if [ $esito -eq 0 ]; then echo "ESITO: schemi uguali"; else echo "ESITO: schemi DIVERSI"; fi
exit $esito
