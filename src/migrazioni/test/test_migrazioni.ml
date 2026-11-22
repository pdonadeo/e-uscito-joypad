(* Test unitari del runner delle migrazioni: file incorporati, invariante della transazione
   e funzioni pure. Un assert fallito fa uscire con un codice diverso da 0. *)

open Migrazioni

let contiene ~sotto s =
  let n = String.length sotto
  and m = String.length s in
  let rec da i = i + n <= m && (String.sub s i n = sotto || da (i + 1)) in
  da 0

(* ---- File incorporati ---- *)

let () =
  let file = file_incorporati () in
  assert (file <> []);
  List.iter (fun f -> if not (nome_file_valido f) then failwith ("nome non valido: " ^ f)) file;
  (* numeri consecutivi da 0001, nessun duplicato *)
  List.iteri
    (fun i f ->
      let atteso = Printf.sprintf "%04d" (i + 1) in
      if String.sub f 0 4 <> atteso then failwith (Printf.sprintf "atteso %s_…, trovato %s" atteso f))
    file;
  assert ((List.hd (migrazioni ())).versione = "0001");
  assert ((List.hd (migrazioni ())).nome = "schema_di_partenza")

(* Invariante della transazione (D3): ogni migrazione gira tutta in una transazione aperta dal
   runner. Le righe di commento -- si ignorano: il commento in testa a 0001 elenca proprio le
   parole vietate. *)
let vietate = ["begin"; "commit"; "rollback"; "end;"; "concurrently"; "vacuum"; "set "; "set_config("; "owner to"]

let () =
  List.iter
    (fun m ->
      String.split_on_char '\n' m.sql
      |> List.iteri (fun i riga ->
          let t = String.trim riga in
          let dove = Printf.sprintf "%s_%s.sql, riga %d" m.versione m.nome (i + 1) in
          if not (String.starts_with ~prefix:"--" t)
          then begin
            if String.starts_with ~prefix:"\\" t then failwith ("meta-comando di psql in " ^ dove);
            let minuscola = String.lowercase_ascii riga in
            List.iter
              (fun v -> if contiene ~sotto:v minuscola then failwith (Printf.sprintf "«%s» vietato in %s" v dove))
              vietate
          end))
    (migrazioni ())

(* Il controllo trova davvero le parole vietate (in maiuscolo) e ignora i commenti. *)
let () =
  assert (contiene ~sotto:"begin" (String.lowercase_ascii "  BEGIN;"));
  assert (not (contiene ~sotto:"vacuum" "select 1"))

(* ---- Nomi dei file ---- *)

let () =
  assert (nome_file_valido "0001_schema_di_partenza.sql");
  assert (nome_file_valido "0012_x.sql");
  assert (not (nome_file_valido "001_x.sql"));
  assert (not (nome_file_valido "0001-x.sql"));
  assert (not (nome_file_valido "0001_.sql"));
  assert (not (nome_file_valido "0001_Maiuscole.sql"));
  assert (not (nome_file_valido "0001_x.txt"))

(* ---- riga_di ---- *)

let () =
  let sql = "abc\ndef\nghi" in
  assert (riga_di ~sql ~posizione:1 = Some 1);
  assert (riga_di ~sql ~posizione:3 = Some 1);
  assert (riga_di ~sql ~posizione:4 = Some 1) (* il \n stesso *);
  assert (riga_di ~sql ~posizione:5 = Some 2);
  assert (riga_di ~sql ~posizione:9 = Some 3) (* prima lettera dell'ultima riga *);
  assert (riga_di ~sql ~posizione:11 = Some 3) (* ultimo carattere *);
  assert (riga_di ~sql ~posizione:12 = None) (* oltre la fine *);
  assert (riga_di ~sql ~posizione:0 = None);
  (* caratteri UTF-8 di 2 byte (è) e di 3 byte (€) prima della posizione: contano uno *)
  let sql = "è€\nxé\n€€€ y" in
  assert (riga_di ~sql ~posizione:2 = Some 1);
  assert (riga_di ~sql ~posizione:4 = Some 2) (* x *);
  assert (riga_di ~sql ~posizione:5 = Some 2) (* é *);
  assert (riga_di ~sql ~posizione:11 = Some 3) (* y *);
  assert (riga_di ~sql ~posizione:12 = None)

(* ---- conninfo ---- *)

let () =
  let c = conninfo ~host:"db.example" ~port:5432 ~user:"utente" ~password:"p%a#s?s@w'o\\r d" ~dbname:"euj" in
  assert (
    c = "host='db.example' port='5432' user='utente' password='p%a#s?s@w\\'o\\\\r d' dbname='euj' connect_timeout='5'")

(* ---- testo_errore ---- *)

let () =
  let e =
    {
      migrazione = "0002_via_tabelle_django";
      sqlstate = "2BP01";
      riga = Some 8;
      messaggio = "cannot drop desired object(s) because other objects depend on them";
      dettaglio = "view sessioni_e2e depends on table django_session";
      suggerimento = "Use DROP ... CASCADE to drop the dependent objects too.";
    }
  in
  let inizio =
    "ERRORE in 0002_via_tabelle_django (SQLSTATE 2BP01, riga 8): cannot drop desired object(s) because other objects \
     depend on them"
  in
  (* con DETAIL e HINT *)
  assert (
    testo_errore e
    = inizio
      ^ " — DETAIL: view sessioni_e2e depends on table django_session — HINT: Use DROP ... CASCADE to drop the \
         dependent objects too.");
  (* solo DETAIL *)
  assert (
    testo_errore { e with suggerimento = "" } = inizio ^ " — DETAIL: view sessioni_e2e depends on table django_session");
  (* senza nessuno dei due: il formato di prima *)
  assert (testo_errore { e with dettaglio = ""; suggerimento = "" } = inizio);
  (* a capo nel DETAIL (anche in coda): «; » e nessuna riga vuota *)
  let t =
    testo_errore { e with dettaglio = "view a depends on table x\nview b depends on table x\n"; suggerimento = "" }
  in
  assert (t = inizio ^ " — DETAIL: view a depends on table x; view b depends on table x");
  assert (not (String.contains t '\n'));
  (* senza SQLSTATE né riga *)
  assert (
    testo_errore { e with sqlstate = ""; riga = None; dettaglio = ""; suggerimento = "" }
    = "ERRORE in 0002_via_tabelle_django (SQLSTATE sconosciuto, riga sconosciuta): cannot drop desired object(s) \
       because other objects depend on them")

(* ---- classifica ---- *)

let quattro = tabelle_dei_dati

let django =
  quattro
  @ [
      "auth_group";
      "auth_group_permissions";
      "auth_permission";
      "backoffice_discordmessage";
      "django_content_type";
      "django_migrations";
    ]

let non_riconosciuto = function
  | Non_riconosciuto _ -> true
  | _ -> false

let () =
  assert (classifica ~registro:None ~tabelle:[] = Vuoto);
  assert (classifica ~registro:None ~tabelle:quattro = Esistente_senza_registro);
  assert (classifica ~registro:None ~tabelle:django = Esistente_senza_registro);
  assert (classifica ~registro:None ~tabelle:(List.rev django) = Esistente_senza_registro);
  assert (non_riconosciuto (classifica ~registro:None ~tabelle:["backoffice_episodio"]));
  assert (non_riconosciuto (classifica ~registro:None ~tabelle:["backoffice_episodio"; "auth_user"]));
  assert (non_riconosciuto (classifica ~registro:None ~tabelle:(List.tl quattro)));
  assert (non_riconosciuto (classifica ~registro:None ~tabelle:["altra"]));
  assert (classifica ~registro:(Some ["0001"]) ~tabelle:("schema_migrations" :: quattro) = Registrato);
  assert (classifica ~registro:(Some ["0001"; "0002"]) ~tabelle:["schema_migrations"] = Registrato);
  assert (non_riconosciuto (classifica ~registro:(Some []) ~tabelle:("schema_migrations" :: quattro)));
  assert (non_riconosciuto (classifica ~registro:(Some ["0002"]) ~tabelle:("schema_migrations" :: quattro)));
  (* il motivo elenca le tabelle trovate *)
  match classifica ~registro:None ~tabelle:["backoffice_episodio"] with
  | Non_riconosciuto motivo ->
    assert (contiene ~sotto:"tabelle trovate: backoffice_episodio" motivo);
    assert (contiene ~sotto:"auth_user" motivo)
  | _ -> assert false

let () = print_endline "test_migrazioni: tutti i controlli passati"
