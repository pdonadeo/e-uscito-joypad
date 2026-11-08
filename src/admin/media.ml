(* Upload delle cover degli episodi in MEDIA_ROOT, con le stesse regole di
   Django (models.py: user_directory_path):
   - solo PNG (estensione e magic bytes);
   - nome "covers/episodi-<numero>-<slug del nome file>.png";
   - se il file esiste già, suffisso casuale "_xxxxxxx" come get_available_name;
   - il percorso salvato in DB è relativo a MEDIA_ROOT (colonna varchar(100)). *)

open Resp

let max_bytes = 10 * 1024 * 1024
let max_db_path = 100
let png_magic = "\x89PNG\r\n\x1a\n"

let too_large () = fail `Payload_Too_Large "File troppo grande (massimo 10 MB)"

let is_multipart req =
  match Dream.header req "Content-Type" with
  | Some ct ->
    let ct = String.lowercase_ascii ct in
    String.length ct >= 19 && String.sub ct 0 19 = "multipart/form-data"
  | None -> false

(* Legge in streaming la parte "file" del multipart, con limite di dimensione. *)
let read_upload req =
  if not (is_multipart req) then bad_request "Atteso un upload multipart/form-data con il campo «file»";
  (match Option.bind (Dream.header req "Content-Length") int_of_string_opt with
  | Some n when n > max_bytes + 65536 -> too_large ()
  | _ -> ());
  let rec read_part buf =
    match%lwt Dream.upload_part req with
    | None -> Lwt.return_unit
    | Some chunk ->
      if Buffer.length buf + String.length chunk > max_bytes then too_large ();
      Buffer.add_string buf chunk;
      read_part buf
  in
  let rec loop found =
    match%lwt Dream.upload req with
    | None -> Lwt.return found
    | Some (name, filename, _headers) ->
      let buf = Buffer.create 65536 in
      let%lwt () = read_part buf in
      let found =
        match (found, name) with
        | None, Some "file" -> Some (Option.value filename ~default:"", Buffer.contents buf)
        | _ -> found
      in
      loop found
  in
  match%lwt loop None with
  | None -> bad_request "Campo «file» mancante"
  | Some (_, "") -> bad_request "File vuoto"
  | Some f -> Lwt.return f

(* slugify di Django ridotto all'ASCII: minuscole, [a-z0-9_-], spazi e
   trattini consecutivi diventano un solo "-". *)
let slugify s =
  let b = Buffer.create (String.length s) in
  let pending_dash = ref false in
  String.iter
    (fun c ->
      match Char.lowercase_ascii c with
      | ('a' .. 'z' | '0' .. '9' | '_') as c ->
        if !pending_dash && Buffer.length b > 0 then Buffer.add_char b '-';
        pending_dash := false;
        Buffer.add_char b c
      | ' ' | '\t' | '-' -> pending_dash := true
      | _ -> ())
    s;
  Buffer.contents b

let random_suffix () =
  let alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" in
  String.map (fun c -> alphabet.[Char.code c mod String.length alphabet]) (Dream.random 7)

let truncate n s = if String.length s > n then String.sub s 0 n else s

let cover_name ~episodio_numero ~filename =
  let lower = String.lowercase_ascii (Filename.basename filename) in
  if not (Filename.check_suffix lower ".png") then bad_request "Il file deve essere un'immagine PNG";
  let base = slugify (Filename.chop_suffix lower ".png") in
  let num = slugify (Option.value episodio_numero ~default:"None") in
  let prefix = Printf.sprintf "covers/episodi-%s-" num in
  (* spazio per prefisso, eventuale "_xxxxxxx" e ".png" *)
  let room = max 1 (max_db_path - String.length prefix - 8 - 4) in
  let base = truncate room (if base = "" then "cover" else base) in
  (prefix ^ base, ".png")

let rec mkdir_p dir =
  if not (Sys.file_exists dir)
  then begin
    mkdir_p (Filename.dirname dir);
    try Unix.mkdir dir 0o755 with Unix.Unix_error (Unix.EEXIST, _, _) -> ()
  end

let write_exclusive path data =
  let%lwt fd = Lwt_unix.openfile path [Unix.O_WRONLY; Unix.O_CREAT; Unix.O_EXCL; Unix.O_CLOEXEC] 0o644 in
  Lwt.finalize
    (fun () ->
      let%lwt () = Lwt_unix.fchmod fd 0o644 in
      let rec write off =
        if off >= String.length data
        then Lwt.return_unit
        else
          let%lwt n = Lwt_unix.write_string fd data off (String.length data - off) in
          write (off + n)
      in
      write 0)
    (fun () -> Lwt_unix.close fd)

(* Salva la cover e restituisce il percorso relativo da scrivere in DB. *)
let save_cover ~episodio_numero ~filename data =
  let root, ext = cover_name ~episodio_numero ~filename in
  if String.length data < 8 || String.sub data 0 8 <> png_magic then bad_request "Il file deve essere un'immagine PNG";
  if Settings.media_root = "" then fail `Internal_Server_Error "MEDIA_ROOT non configurata";
  (try mkdir_p (Filename.concat Settings.media_root "covers")
   with Unix.Unix_error (e, _, _) ->
     log.error (fun m -> m "Impossibile creare la directory delle cover: %s" (Unix.error_message e));
     fail `Internal_Server_Error "Impossibile salvare il file");
  let rec attempt n rel =
    let path = Filename.concat Settings.media_root rel in
    try%lwt
      let%lwt () = write_exclusive path data in
      Lwt.return rel
    with
    | Unix.Unix_error (Unix.EEXIST, _, _) when n < 20 -> attempt (n + 1) (root ^ "_" ^ random_suffix () ^ ext)
    | Unix.Unix_error (e, _, _) ->
      log.error (fun m -> m "Scrittura di %s fallita: %s" path (Unix.error_message e));
      fail `Internal_Server_Error "Impossibile salvare il file"
  in
  attempt 0 (root ^ ext)

let remove rel =
  try%lwt Lwt_unix.unlink (Filename.concat Settings.media_root rel) with Unix.Unix_error _ -> Lwt.return_unit
