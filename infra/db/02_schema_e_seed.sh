#!/bin/bash
# initdb del Postgres di sviluppo, dopo 01_init_pg.sh: schema di partenza e seed.
#
# Gira solo su un volume vuoto, sul server temporaneo di initdb (socket locale, autenticazione
# trust), come PGUSER: le tabelle nascono di sua proprietà. L'entrypoint di Postgres esegue solo
# i file al primo livello di /docker-entrypoint-initdb.d, quindi migrazioni/ e seed/ non partono
# da sole.
#
# - Schema: la 0001 del runner. Al primo avvio il binario la trova senza registro e la registra
#   senza eseguirla, poi applica le migrazioni successive.
# - Seed: solo con DEBUG=True (senza distinguere maiuscole) e se il file c'è. In produzione
#   initdb non gira e il seed non c'è; questo controllo è una protezione in più.

set -e

DIR=/docker-entrypoint-initdb.d
SCHEMA="$DIR/migrazioni/0001_schema_di_partenza.sql"
SEED="$DIR/seed/seed_sviluppo.sql"

esegui() {
    psql -v ON_ERROR_STOP=1 --single-transaction --username "$PGUSER" --dbname "$PGDATABASE" -f "$1"
}

if [ -f "$SCHEMA" ]; then
    echo "02_schema_e_seed: carico lo schema da $SCHEMA"
    esegui "$SCHEMA"
else
    echo "02_schema_e_seed: $SCHEMA non c'è, niente schema (lo crea il binario all'avvio)"
fi

if [ "${DEBUG,,}" != "true" ]; then
    echo "02_schema_e_seed: DEBUG non è True, niente seed"
elif [ ! -f "$SEED" ]; then
    echo "02_schema_e_seed: $SEED non c'è, niente seed"
else
    echo "02_schema_e_seed: carico il seed da $SEED"
    esegui "$SEED"
fi
