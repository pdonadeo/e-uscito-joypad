(* Associazioni episodio-videogame: colonne, FROM e query usate da GraphQL
   (src/graphql/dati.ml). Le scritture passano dall'episodio, che le possiede. *)

let columns =
  {|a.id, a.episodio_id, a.videogame_id,
    to_char(a.istante, 'HH24:MI:SS') AS istante, a.speaker, a.tipologia,
    v.titolo AS videogame_titolo, e.titolo AS episodio_titolo,
    e.episodio_numero, e.data_uscita, a.istante AS _istante|}

let from =
  {|FROM backoffice_associazioneepisodiovideogame a
    JOIN backoffice_episodio e ON e.id = a.episodio_id
    JOIN backoffice_videogame v ON v.id = a.videogame_id|}

let get_req =
  Caqti_request.Infix.(Caqti_type.int64 ->? Caqti_type.string)
    (Printf.sprintf "SELECT (to_jsonb(r) - '_istante')::text FROM (SELECT %s %s WHERE a.id = $1) r" columns from)

let id_filter f key =
  match List.assoc_opt key f with
  | None | Some `Null -> None
  | Some j -> Some (`Intlit (Int64.to_string (Input.int64_of_json key j)))
