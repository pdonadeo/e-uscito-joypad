(* Pezzi condivisi dagli elenchi di GraphQL (Dati.run_list in src/graphql/dati.ml):
   direzione dell'ordinamento, massimo di righe per pagina, filtro di ricerca e
   richiesta Caqti con i filtri in JSON ($1::jsonb), LIMIT ($2) e OFFSET ($3).
   Il nome viene dalla REST di react-admin, che non c'è più. *)

type dir = Asc | Desc

let max_page = 1000

let q_filter (filter : Input.obj) =
  match List.assoc_opt "q" filter with
  | Some (`String s) when String.trim s <> "" -> Some (`String (Input.like_pattern (String.trim s)))
  | _ -> None

(* Costruisce l'oggetto JSON dei filtri passato come $1 alla query. *)
let filter_json (l : (string * Yojson.Safe.t option) list) : string =
  `Assoc (List.filter_map (fun (k, v) -> Option.map (fun v -> (k, v)) v) l) |> Yojson.Safe.to_string

(* Una richiesta preparata per ogni testo SQL: il testo dipende solo da risorsa,
   campo di ordinamento e direzione, quindi la cache resta piccola. *)
let list_req =
  let cache = Hashtbl.create 16 in
  fun sql ->
    match Hashtbl.find_opt cache sql with
    | Some r -> r
    | None ->
      let r = Caqti_request.Infix.(Caqti_type.(t3 string (option int) int) ->! Caqti_type.(t2 int64 string)) sql in
      Hashtbl.replace cache sql r;
      r
