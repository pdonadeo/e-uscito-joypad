(* Client RAWG: GET {RAWG_API_URL}/games/{slug}?key=..., come il pre_save di
   Django (models.py: salva_dati_da_rawg). Ogni errore diventa un
   [Resp.Http_error] con un messaggio chiaro; la chiave non finisce nei log. *)

open Resp

type game = {
  titolo : string;
  descrizione_html : string option;
  descrizione_raw : string option;
  cover : string option;
  json : string;
}

let timeout_s = 15.0

let valid_slug s =
  s <> ""
  && String.length s <= 256
  && String.for_all
       (function
         | 'a' .. 'z' | 'A' .. 'Z' | '0' .. '9' | '-' | '_' -> true
         | _ -> false)
       s

let fetch slug =
  if not (valid_slug slug) then bad_request "Lo slug RAWG può contenere solo lettere, cifre, «-» e «_»";
  let uri =
    Uri.add_query_param'
      (Uri.of_string (Printf.sprintf "%s/games/%s" Settings.rawg_api_url slug))
      ("key", Settings.rawg_api_key)
  in
  let%lwt status, body =
    try%lwt
      Lwt_unix.with_timeout timeout_s (fun () ->
          let%lwt resp, body = Cohttp_lwt_unix.Client.get uri in
          let%lwt body = Cohttp_lwt.Body.to_string body in
          Lwt.return (Cohttp.Response.status resp |> Cohttp.Code.code_of_status, body))
    with
    | Lwt_unix.Timeout -> fail `Gateway_Timeout "RAWG non ha risposto in tempo"
    | exn ->
      log.error (fun m -> m "Errore di rete verso RAWG (%s): %s" slug (Printexc.to_string exn));
      fail `Bad_Gateway "Impossibile contattare RAWG"
  in
  if status = 404 then fail `Bad_Request (Printf.sprintf "Gioco «%s» non trovato su RAWG" slug);
  if status <> 200
  then begin
    log.error (fun m -> m "RAWG ha risposto %d per «%s»" status slug);
    fail `Bad_Gateway (Printf.sprintf "RAWG ha risposto con lo stato %d" status)
  end;
  let j = try Yojson.Safe.from_string body with Yojson.Json_error _ -> fail `Bad_Gateway "Risposta RAWG non valida" in
  let str_opt k =
    match Yojson.Safe.Util.member k j with
    | `String s -> Some s
    | _ -> None
  in
  match str_opt "name" with
  | None -> fail `Bad_Gateway "Risposta RAWG senza il campo «name»"
  | Some titolo ->
    Lwt.return
      {
        titolo;
        descrizione_html = str_opt "description";
        descrizione_raw = str_opt "description_raw";
        cover = str_opt "background_image";
        json = Yojson.Safe.to_string j;
      }
