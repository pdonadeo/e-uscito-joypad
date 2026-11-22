(* Eseguibile di prova per il caso «errore di sintassi» di tests/api/migrazioni.spec.js.

   Un file incorporato non si può rompere, quindi questo programma passa a
   Migrazioni.applica_testo (la stessa funzione che il runner usa per ogni file) una
   migrazione 9999_prova di 4 righe, con un errore di sintassi alla riga 3 preceduto da
   caratteri UTF-8 di più byte. Legge le variabili PG*. Esce con 12 e scrive l'errore nello
   stesso formato del runner; esce con 1 se la migrazione non fallisce. *)

let sql = "-- migrazione di prova: «è» e «€» prima dell'errore\nSELECT 'più' AS uno;\nSELEC 2;\nSELECT 3;\n"

let () =
  Logs.set_reporter (Logs.format_reporter ());
  Logs.set_level (Some Logs.Info);
  let env k ~default = Option.value (Sys.getenv_opt k) ~default in
  let conninfo =
    Migrazioni.conninfo
      ~host:(env "PGHOST" ~default:"localhost")
      ~port:(int_of_string (env "PGPORT" ~default:"5432"))
      ~user:(env "PGUSER" ~default:"")
      ~password:(env "PGPASSWORD" ~default:"")
      ~dbname:(env "PGDATABASE" ~default:"")
  in
  let conn = new Postgresql.connection ~conninfo () in
  conn#set_notice_processing `Quiet;
  match Migrazioni.applica_testo conn ~versione:"9999" ~nome:"prova" ~sql ~eseguita:true with
  | Ok () ->
    prerr_endline "prova_sintassi: la migrazione 9999_prova doveva fallire";
    exit 1
  | Error e ->
    Migrazioni.log_errore e;
    exit 12
