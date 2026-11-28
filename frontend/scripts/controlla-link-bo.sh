#!/usr/bin/env bash
# Il bo non naviga verso le pagine pubbliche con il router (piano nuovo-frontend, Fase 1, passo 4):
# tra pubblico e bo si passa solo con <a href>, cioè con una ricarica completa, perché i meta del
# <head> li inietta Dream. Qui si cerca, in src/routes/bo/ e src/components/ (tranne
# components/pubblico/), ogni `to: '…'`, `to="…"` o `to={'…'}` con un percorso fuori da /bo,
# compreso `to: '/'`.
dir="${1:-frontend/src}"
pattern='\bto(:\s*|=\{?\s*)['"'"'"`]/(?!bo(/|['"'"'"`]))'
grep -rnP --include='*.tsx' --include='*.ts' --exclude-dir=pubblico "$pattern" "$dir/routes/bo" "$dir/components"
status=$?   # 0 = trovati link vietati
[ $status -eq 0 ] && echo 'Link del router dal bo verso pagine pubbliche: usare <a href>.'
[ $status -eq 1 ]
