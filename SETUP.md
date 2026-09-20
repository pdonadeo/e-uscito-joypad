# Installazione

Scompatta alla radice del repo. La struttura è già quella giusta:

```
CLAUDE.md                  → radice del repo (non dentro .claude/)
GOALS.md                   → radice, è il promemoria per te
scripts/readonly-bash.sh   → hook per i tre agent in sola lettura
.claude/agents/*.md        → gli otto agent
```

```bash
cd /percorso/del/progetto
git switch -c refactoring
unzip ~/Downloads/refactor-agents.zip
rm SETUP.md                    # oppure tienilo, fa lo stesso
chmod +x scripts/readonly-bash.sh
git add -A && git commit -m "Setup agent per il refactoring"
```

## Le quattro cose che fanno fallire il setup in silenzio

1. **`jq` deve essere installato** (`command -v jq`). Lo script hook lo usa, e
   senza fallisce *aperto*: lascia passare tutto invece di bloccare.
2. **`chmod +x`** sullo script. Senza, l'hook va in errore invece di bloccare.
3. **Avvia Claude Code dalla radice del repo**, perché il path dell'hook è
   relativo. In alternativa, nei tre agent in sola lettura
   (`ocaml-reader`, `django-archaeologist`, `refactor-reviewer`) sostituisci
   `./scripts/readonly-bash.sh` con `"$CLAUDE_PROJECT_DIR/scripts/readonly-bash.sh"`.
4. **Crea i file prima di avviare Claude Code.** Una sessione già aperta non si
   accorge di una directory `agents/` appena creata. Al primo avvio accetta la
   richiesta di fiducia sulla cartella, altrimenti gli hook nel frontmatter non
   girano.

Verifica che siano caricati: scrivi `@` nel prompt, devono comparire otto nomi.

## I primi tre passi

**1. Ricognizione, senza agent:**

```
Leggi CLAUDE.md, poi esplora il repo in sola lettura e dimmi:
1. come si avvia in locale ciascuno dei quattro componenti
2. quali comandi esistono già per build, test, lint, migrazioni
3. cosa manca per poter eseguire la fase 0

Aggiorna solo la sezione "Comandi" di CLAUDE.md con quello che trovi, e
elenca esplicitamente ciò che non sei riuscito a determinare. Non toccare
nient'altro.
```

**2. Collaudo dell'hook:**

```
@"ocaml-reader (agent)" elenca le route del router Dream, con file e riga
```

Interessa una cosa sola: che non riesca a scrivere. E che il report citi
`file.ml:riga` — senza citazioni sta improvvisando.

**3. Fase 0**, con la condizione `/goal` che trovi in `GOALS.md`.

## Gli otto agent

| Agent | Ruolo | Scrive? |
| --- | --- | --- |
| `safety-net` | Test di caratterizzazione, baseline visive | sì |
| `ocaml-reader` | Contratto dell'API Dream | **no** |
| `django-archaeologist` | Spec dell'admin Django | **no** |
| `django-auth-compat` | Login e password compatibili Django | sì |
| `frontend-migrator` | `frontend/` da JS a TS | sì |
| `data-entry-ui` | Nuova app di backoffice | sì |
| `go-api-builder` | API Go, sqlc + tern | sì |
| `refactor-reviewer` | Review indipendente | **no** |
