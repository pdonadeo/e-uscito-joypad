#!/bin/bash

set -e

cat << SQL_INIT_SCRIPT > /tmp/02_setup_cluster.sql
CREATE USER $PGUSER with
    NOSUPERUSER
    CREATEDB
    NOCREATEROLE
    LOGIN
    encrypted password '$PGPASSWORD';

CREATE DATABASE $PGDATABASE;

ALTER DATABASE $PGDATABASE OWNER TO $PGUSER;
SQL_INIT_SCRIPT

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /tmp/02_setup_cluster.sql
