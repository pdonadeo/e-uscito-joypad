(* Runner delle migrazioni dello schema del DB.

   Gira all'avvio del binario, prima del loop Lwt e prima di aprire la porta, su
   una connessione dedicata (libreria postgresql, non il pool di Dream). Porta il
   DB all'ultima migrazione di infra/db/migrazioni/ (file NNNN_nome.sql
   incorporati nel binario), sotto pg_advisory_lock.

   Ogni migrazione gira tutta in una transazione: BEGIN, il testo del file con un
   solo exec (PQexec accetta più istruzioni), INSERT nel registro
   schema_migrations, COMMIT. Se qualcosa fallisce: ROLLBACK, e il DB resta com'era.
   Per questo nei file sono vietati BEGIN/COMMIT, CONCURRENTLY, VACUUM, i
   meta-comandi di psql, SET e i cambi di proprietario (lo controlla dune test).

   Codici d'uscita del binario, lontani da 2 (eccezione OCaml non catturata):
   - 10: DB non raggiungibile dopo 60 s, o connessione persa;
   - 11: schema non riconosciuto;
   - 12: migrazione fallita, con rollback;
   - 13: lock non ottenuto entro 60 s. *)

let src = Logs.Src.create "migrazioni" ~doc:"Migrazioni dello schema del DB"

module Log = (val Logs.src_log src : Logs.LOG)

(* Chiave di pg_advisory_lock: 0x45554A4D sono i byte ASCII di "EUJM" (e-uscito-joypad,
   migrazioni). tests/api/migrazioni.spec.js usa lo stesso valore. *)
let chiave_lock = 0x45554A4D
let attesa_massima = 60.

(* ---- File incorporati ---- *)

type migrazione = {
  versione : string; (* "0001" *)
  nome : string; (* "schema_di_partenza" *)
  sql : string;
}

let file_incorporati () = List.sort compare Sql_incorporati.file_list
let leggi_incorporato f = Sql_incorporati.read f

(* NNNN_nome.sql, con nome fatto di [a-z0-9_] *)
let nome_file_valido f =
  let n = String.length f in
  let cifra = function
    | '0' .. '9' -> true
    | _ -> false
  in
  let lettera = function
    | 'a' .. 'z' | '0' .. '9' | '_' -> true
    | _ -> false
  in
  n > 9
  && Filename.check_suffix f ".sql"
  && String.for_all cifra (String.sub f 0 4)
  && f.[4] = '_'
  && String.for_all lettera (String.sub f 5 (n - 9))

let migrazioni () =
  file_incorporati ()
  |> List.map (fun f ->
      if not (nome_file_valido f) then invalid_arg ("Migrazioni: nome di file non valido: " ^ f);
      let sql = Option.get (leggi_incorporato f) in
      { versione = String.sub f 0 4; nome = String.sub f 5 (String.length f - 9); sql })

(* ---- Funzioni pure ---- *)

type stato =
  | Vuoto
  | Esistente_senza_registro
  | Registrato
  | Non_riconosciuto of string

let tabelle_dei_dati =
  ["auth_user"; "backoffice_associazioneepisodiovideogame"; "backoffice_episodio"; "backoffice_videogame"]

let nome_di_stato = function
  | Vuoto -> "Vuoto"
  | Esistente_senza_registro -> "Esistente_senza_registro"
  | Registrato -> "Registrato"
  | Non_riconosciuto _ -> "Non_riconosciuto"

(* [registro]: None se schema_migrations non c'è, altrimenti le versioni registrate.
   [tabelle]: le tabelle dello schema public. Nel caso «produzione» (le 4 tabelle dei dati
   senza registro) le altre tabelle, per esempio quelle di Django, sono tollerate. *)
let classifica ~registro ~tabelle =
  let elenco = function
    | [] -> "nessuna"
    | l -> String.concat ", " (List.sort compare l)
  in
  match registro with
  | Some [] -> Non_riconosciuto "schema_migrations è vuota"
  | Some versioni when not (List.mem "0001" versioni) ->
    Non_riconosciuto (Printf.sprintf "schema_migrations senza 0001 (versioni: %s)" (elenco versioni))
  | Some _ -> Registrato
  | None when tabelle = [] -> Vuoto
  | None -> (
    match List.filter (fun t -> not (List.mem t tabelle)) tabelle_dei_dati with
    | [] -> Esistente_senza_registro
    | mancanti -> Non_riconosciuto (Printf.sprintf "mancano %s; tabelle trovate: %s" (elenco mancanti) (elenco tabelle))
    )

(* Riga (da 1) del carattere in posizione [posizione] di [sql]. Come STATEMENT_POSITION di
   Postgres, la posizione conta i caratteri (non i byte) dall'inizio del testo, partendo da 1. *)
let riga_di ~sql ~posizione =
  let n = String.length sql in
  let rec scorri i caratteri riga =
    if i >= n
    then None
    else
      let d = String.get_utf_8_uchar sql i in
      let caratteri = caratteri + 1 in
      if caratteri = posizione
      then Some riga
      else scorri (i + Uchar.utf_decode_length d) caratteri (if sql.[i] = '\n' then riga + 1 else riga)
  in
  if posizione < 1 then None else scorri 0 0 1

(* Stringa di connessione per libpq: chiave='valore' separati da spazi, con l'escape di \ e '.
   Non si usa l'URI di Settings: è costruito senza codifica e libpq leggerebbe male una
   password con %, #, ?, @ o /. *)
let conninfo ~host ~port ~user ~password ~dbname =
  let quota v =
    let b = Buffer.create (String.length v + 2) in
    Buffer.add_char b '\'';
    String.iter
      (fun c ->
        if c = '\\' || c = '\'' then Buffer.add_char b '\\';
        Buffer.add_char b c)
      v;
    Buffer.add_char b '\'';
    Buffer.contents b
  in
  [
    ("host", host);
    ("port", string_of_int port);
    ("user", user);
    ("password", password);
    ("dbname", dbname);
    ("connect_timeout", "5");
  ]
  |> List.map (fun (k, v) -> k ^ "=" ^ quota v)
  |> String.concat " "

(* ---- Esecuzione di una migrazione ---- *)

type errore = {
  migrazione : string; (* "0001_schema_di_partenza" *)
  sqlstate : string; (* "" se Postgres non l'ha dato *)
  riga : int option;
  messaggio : string;
}

let testo_errore e =
  Printf.sprintf
    "ERRORE in %s (SQLSTATE %s, %s): %s"
    e.migrazione
    (if e.sqlstate = "" then "sconosciuto" else e.sqlstate)
    (match e.riga with
    | Some r -> Printf.sprintf "riga %d" r
    | None -> "riga sconosciuta")
    e.messaggio

let log_errore e = Log.err (fun m -> m "migrazioni: %s" (testo_errore e))
let ok = Postgresql.[Command_ok; Tuples_ok]

let crea_registro =
  "CREATE TABLE IF NOT EXISTS schema_migrations (versione text PRIMARY KEY, nome text NOT NULL, applicata_il \
   timestamptz NOT NULL DEFAULT now(), eseguita boolean NOT NULL)"

(* Una migrazione nella sua transazione: BEGIN, registro (creato se manca, nella stessa
   transazione della prima migrazione), testo (solo se [eseguita]), INSERT, COMMIT. In caso di
   errore: ROLLBACK e l'errore. Le eccezioni della libreria diventano un [Error] senza SQLSTATE:
   chi chiama distingue la connessione persa con [conn#status]. *)
let applica_testo (conn : Postgresql.connection) ~versione ~nome ~sql ~eseguita =
  let migrazione = versione ^ "_" ^ nome in
  let rollback () = try ignore (conn#exec "ROLLBACK") with Postgresql.Error _ -> () in
  try
    ignore (conn#exec ~expect:ok "BEGIN");
    ignore (conn#exec ~expect:ok crea_registro);
    let esito =
      if not eseguita
      then Ok ()
      else
        (* senza ~expect: con ~expect la libreria solleva Unexpected_status e il result,
           con i campi dell'errore, si perde *)
        let res = conn#exec sql in
        match res#status with
        | Postgresql.Command_ok | Postgresql.Tuples_ok -> Ok ()
        | stato ->
          let campo f = res#error_field f in
          let messaggio =
            match (campo Postgresql.Error_field.MESSAGE_PRIMARY, String.trim res#error) with
            | "", "" -> "stato " ^ Postgresql.result_status stato
            | "", m | m, _ -> m
          in
          let riga =
            match int_of_string_opt (campo Postgresql.Error_field.STATEMENT_POSITION) with
            | Some posizione -> riga_di ~sql ~posizione
            | None -> None
          in
          Error { migrazione; sqlstate = campo Postgresql.Error_field.SQLSTATE; riga; messaggio }
    in
    match esito with
    | Error _ as e ->
      rollback ();
      e
    | Ok () ->
      ignore
        (conn#exec
           ~expect:[Postgresql.Command_ok]
           ~params:[|versione; nome; string_of_bool eseguita|]
           "INSERT INTO schema_migrations (versione, nome, eseguita) VALUES ($1, $2, $3)");
      ignore (conn#exec ~expect:[Postgresql.Command_ok] "COMMIT");
      Ok ()
  with Postgresql.Error e ->
    rollback ();
    Error { migrazione; sqlstate = ""; riga = None; messaggio = Postgresql.string_of_error e }

(* ---- Runner ---- *)

let rec dormi s = try Unix.sleepf s with Unix.Unix_error (Unix.EINTR, _, _) -> dormi s

let esci codice fmt =
  Printf.ksprintf
    (fun msg ->
      Log.err (fun m -> m "migrazioni: %s" msg);
      exit codice)
    fmt

let connetti conninfo =
  let scadenza = Unix.gettimeofday () +. attesa_massima in
  let rec tenta primo =
    match new Postgresql.connection ~conninfo () with
    | conn -> conn
    | exception Postgresql.Error e ->
      let errore = Postgresql.string_of_error e in
      if Unix.gettimeofday () >= scadenza
      then esci 10 "DB non raggiungibile dopo %.0f s: %s" attesa_massima errore
      else begin
        if primo then Log.warn (fun m -> m "migrazioni: DB non raggiungibile, ritento ogni secondo: %s" errore);
        dormi 1.;
        tenta false
      end
  in
  tenta true

let esegui ~conninfo =
  let conn = connetti conninfo in
  conn#set_notice_processing `Quiet;
  (* SQL fallito → [codice]; connessione persa → 10. Nessuna eccezione esce da qui. *)
  let protetto codice f =
    try f () with
    | Postgresql.Error e ->
      let persa = try conn#status = Postgresql.Bad with _ -> true in
      esci (if persa then 10 else codice) "%s" (Postgresql.string_of_error e)
    | Unix.Unix_error (err, fn, _) -> esci 10 "%s: %s" fn (Unix.error_message err)
  in
  let fallita e =
    log_errore e;
    exit (if conn#status = Postgresql.Bad then 10 else 12)
  in
  let lock = [|string_of_int chiave_lock|] in
  (* 1. lock *)
  protetto 13 (fun () ->
      let scadenza = Unix.gettimeofday () +. attesa_massima in
      let rec tenta primo =
        let res = conn#exec ~expect:[Postgresql.Tuples_ok] ~params:lock "SELECT pg_try_advisory_lock($1::bigint)" in
        if res#getvalue 0 0 <> "t"
        then begin
          if primo then Log.info (fun m -> m "migrazioni: attendo il lock (altro processo in corso)");
          if Unix.gettimeofday () >= scadenza then esci 13 "lock non ottenuto entro %.0f s" attesa_massima;
          dormi 1.;
          tenta false
        end
      in
      tenta true);
  (* 2. stato del DB *)
  let registro, tabelle =
    protetto 12 (fun () ->
        let valori q =
          let r = conn#exec ~expect:[Postgresql.Tuples_ok] q in
          List.init r#ntuples (fun i -> r#getvalue i 0)
        in
        let c'e_registro = valori "SELECT to_regclass('public.schema_migrations') IS NOT NULL" = ["t"] in
        let tabelle = valori "SELECT tablename::text FROM pg_tables WHERE schemaname = 'public' ORDER BY 1" in
        let registro =
          if c'e_registro then Some (valori "SELECT versione FROM schema_migrations ORDER BY 1") else None
        in
        (registro, tabelle))
  in
  let stato = classifica ~registro ~tabelle in
  (match stato with
  | Non_riconosciuto motivo -> esci 11 "schema non riconosciuto: %s" motivo
  | _ -> Log.info (fun m -> m "migrazioni: stato del DB: %s" (nome_di_stato stato)));
  (* 3. registrazione di 0001 senza eseguirla (DB nato da Django, come la produzione) *)
  let tutte = migrazioni () in
  let registrate =
    match stato with
    | Esistente_senza_registro -> (
      let m = List.find (fun m -> m.versione = "0001") tutte in
      match protetto 12 (fun () -> applica_testo conn ~versione:m.versione ~nome:m.nome ~sql:"" ~eseguita:false) with
      | Ok () ->
        Log.info (fun f -> f "migrazioni: %s_%s registrata senza eseguirla" m.versione m.nome);
        ["0001"]
      | Error e -> fallita e)
    | _ -> Option.value registro ~default:[]
  in
  (* 4. migrazioni non registrate, in ordine *)
  let da_applicare = List.filter (fun m -> not (List.mem m.versione registrate)) tutte in
  if da_applicare = [] then Log.info (fun f -> f "migrazioni: nessuna migrazione da applicare");
  List.iter
    (fun m ->
      Log.info (fun f -> f "migrazioni: applico %s_%s" m.versione m.nome);
      let inizio = Unix.gettimeofday () in
      match protetto 12 (fun () -> applica_testo conn ~versione:m.versione ~nome:m.nome ~sql:m.sql ~eseguita:true) with
      | Ok () ->
        let ms = int_of_float ((Unix.gettimeofday () -. inizio) *. 1000.) in
        Log.info (fun f -> f "migrazioni: %s_%s applicata in %d ms" m.versione m.nome ms)
      | Error e -> fallita e)
    da_applicare;
  (* 5. fine *)
  protetto 12 (fun () ->
      ignore (conn#exec ~expect:[Postgresql.Tuples_ok] ~params:lock "SELECT pg_advisory_unlock($1::bigint)"));
  conn#finish
