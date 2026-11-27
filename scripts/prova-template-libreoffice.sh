#!/usr/bin/env bash
# Andata e ritorno del template dei minutaggi in LibreOffice (Fase 5 dell'import Excel, T7).
#
#   scripts/prova-template-libreoffice.sh
#
# Prende la fixture generata valido-slug.xlsx (new-bo/scripts/genera-fixture-excel.ts), la fa
# aprire e risalvare in .xlsx da LibreOffice senza interfaccia, e scrive il risultato in
# tests/api/fixture/import-excel/libreoffice.xlsx, che si committa. Il file risalvato ha la
# struttura che produce LibreOffice (stili, stringhe, convalide riscritte a modo suo): i test
# (importa.test.ts e l'e2e dell'import) controllano che si importi come l'originale.
#
# Usa un profilo di LibreOffice temporaneo, così non disturba un LibreOffice già aperto.
set -euo pipefail

radice="$(cd "$(dirname "$0")/.." && pwd)"
cartella="$radice/tests/api/fixture/import-excel"
sorgente="$cartella/valido-slug.xlsx"
destinazione="$cartella/libreoffice.xlsx"

command -v soffice >/dev/null || { echo "soffice non trovato: serve LibreOffice" >&2; exit 1; }
[ -f "$sorgente" ] || { echo "manca $sorgente: lancia prima new-bo/scripts/genera-fixture-excel.ts" >&2; exit 1; }

lavoro="$(mktemp -d)"
trap 'rm -rf "$lavoro"' EXIT

soffice -env:UserInstallation="file://$lavoro/profilo" --headless --calc \
  --convert-to "xlsx:Calc MS Excel 2007 XML" --outdir "$lavoro/uscita" "$sorgente" >/dev/null

mv "$lavoro/uscita/valido-slug.xlsx" "$destinazione"
echo "scritto $destinazione ($(soffice --version | head -1))"
