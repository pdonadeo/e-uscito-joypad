#!/usr/bin/env bash
# Controllo delle classi Tailwind nei componenti di new-bo (docs/ui.md, «Adattare i componenti shadcn»).
# Lo script di ui.md usa `rg --pcre2`: qui lo stesso pattern passa a `grep -P` (GNU grep),
# perché ripgrep non c'è nell'immagine oven/bun dello stage Docker.
dir="${1:-new-bo/src}"
pattern='(^|[\s"'"'"'`:])(-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|size|h|w|min-h|min-w|max-h|max-w|top|right|bottom|left|inset|inset-x|inset-y|translate-x|translate-y|scroll-my|scroll-py)-([0-9]+\.5|1|5|9)|(h|w|size)-(3|4|5|6|7|8)|(bg|text|border|ring|fill|stroke|from|to|via|outline|shadow)-(black|white|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})(/[0-9]+)?|shadow-(2xs|xs|sm|md|lg|xl|2xl)|rounded(-(xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[[^]]*\]))?|tracking-(tighter|tight|widest)|(max-w|min-w)-(lg|sm|xs|xl|2xl)|zoom-(in|out)-[0-9]+|slide-(in-from|out-to)-(top|bottom|right)(-[0-9]+)?|dark:[^\s"'"'"'`]+|ring-\[3px\]|ring-ring/50|duration-(200|300|500))(?=$|[\s"'"'"'`])'
grep -rnoP --include='*.tsx' --include='*.ts' "$pattern" "$dir"
status_classi=$?   # 0 = trovate classi vietate
mancanti=$(grep -rLF --include='*.tsx' 'stile C: adattato secondo docs/ui.md' "$dir/components/ui" 2>/dev/null)
[ -n "$mancanti" ] && printf 'Componenti non adattati:\n%s\n' "$mancanti"
[ $status_classi -eq 1 ] && [ -z "$mancanti" ]
