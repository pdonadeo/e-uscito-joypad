(* L'index.html di Vite, diviso una volta sola all'avvio intorno al marcatore: ogni pagina è
   prima ^ blocco <head> ^ dopo, quindi un marcatore dentro un valore non viene mai risostituito. *)

let marcatore = "<!-- euj:head -->"

let prima, dopo =
  let errore msg =
    prerr_endline ("ERRORE: " ^ msg);
    exit 1
  in
  match Static_filesystem.read "index.html" with
  | None -> errore "index.html manca nel filesystem statico (frontend/dist non compilato?)"
  | Some index -> (
    let n = String.length marcatore in
    let rec cerca i =
      if i + n > String.length index then None else if String.sub index i n = marcatore then Some i else cerca (i + 1)
    in
    match cerca 0 with
    | None -> errore ("index.html non contiene il marcatore " ^ marcatore)
    | Some i -> (String.sub index 0 i, String.sub index (i + n) (String.length index - i - n)))

let pagina_pubblica ~percorso dati = prima ^ Meta.blocco_head (`Pubblico (percorso, dati)) ^ dopo
let pagina_bo () = prima ^ Meta.blocco_head `Bo ^ dopo
