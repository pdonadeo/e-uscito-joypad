(* Autenticazione dell'admin sugli utenti Django (tabella auth_user).

   - Login consentito a chi è is_active AND is_staff.
   - La sessione (cookie cifrato di Dream) contiene l'id utente e un'impronta
     dell'hash della password: cambiare password invalida le sessioni aperte.
   - A ogni richiesta l'utente viene riletto dal DB, così disattivarlo o
     togliergli is_staff ha effetto immediato. *)

open Resp

type user = {
  id : int;
  username : string;
  first_name : string;
  last_name : string;
  is_superuser : bool;
  password : string;
}

let user_type =
  let open Caqti_type in
  product (fun id username first_name last_name is_superuser password ->
      { id; username; first_name; last_name; is_superuser; password })
  @@ proj int (fun u -> u.id)
  @@ proj string (fun u -> u.username)
  @@ proj string (fun u -> u.first_name)
  @@ proj string (fun u -> u.last_name)
  @@ proj bool (fun u -> u.is_superuser)
  @@ proj string (fun u -> u.password)
  @@ proj_end

let user_columns = "id, username, first_name, last_name, is_superuser, password"

let find_enabled_by_id =
  Caqti_request.Infix.(Caqti_type.int ->? user_type)
    ("SELECT " ^ user_columns ^ " FROM auth_user WHERE id = $1 AND is_active AND is_staff")

let find_by_username =
  Caqti_request.Infix.(Caqti_type.string ->? Caqti_type.(t3 user_type bool bool))
    ("SELECT " ^ user_columns ^ ", is_active, is_staff FROM auth_user WHERE username = $1")

let set_password_req =
  Caqti_request.Infix.(Caqti_type.(t2 int string) ->. Caqti_type.unit) "UPDATE auth_user SET password = $2 WHERE id = $1"

let touch_last_login =
  Caqti_request.Infix.(Caqti_type.int ->. Caqti_type.unit) "UPDATE auth_user SET last_login = now() WHERE id = $1"

let max_iterations =
  Caqti_request.Infix.(Caqti_type.unit ->! Caqti_type.(option int))
    {|SELECT max(split_part(password, '$', 2)::int) FROM auth_user
      WHERE password ~ '^pbkdf2_sha256\$[0-9]+\$'|}

(* Iterazioni per i nuovi hash: le stesse degli hash esistenti più robusti. *)
let iterations_for_new_hash req =
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find max_iterations ()) in
  let%lwt m = or_fail r in
  Lwt.return (match m with Some n when n > 0 -> max n Password.default_iterations | _ -> Password.default_iterations)

let session_uid = "uid"
let session_pwh = "pwh"

let password_fingerprint pw = String.sub Digestif.SHA256.(to_hex (digest_string ("euj-session:" ^ pw))) 0 16

let user_field : user Dream.field = Dream.new_field ~name:"admin.user" ()

(* Da richiamare quando l'utente corrente cambia la propria password, per non
   invalidare la sua stessa sessione. *)
let set_session_password req hash = Dream.set_session_field req session_pwh (password_fingerprint hash)

let current_user req =
  match Dream.field req user_field with
  | Some u -> u
  | None -> fail `Unauthorized "Autenticazione richiesta"

let load_session_user req =
  match (Dream.session_field req session_uid, Dream.session_field req session_pwh) with
  | Some uid, Some pwh -> (
    match int_of_string_opt uid with
    | None -> Lwt.return_none
    | Some uid ->
      let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find_opt find_enabled_by_id uid) in
      let%lwt u = or_fail r in
      Lwt.return
        (match u with
        | Some u when Password.constant_time_equal (password_fingerprint u.password) pwh -> Some u
        | _ -> None))
  | _ -> Lwt.return_none

let require_staff : Dream.middleware =
 fun inner req ->
  handle
    (fun req ->
      match%lwt load_session_user req with
      | None -> fail `Unauthorized "Autenticazione richiesta"
      | Some u ->
        Dream.set_field req user_field u;
        inner req)
    req

let require_superuser : Dream.middleware =
 fun inner req ->
  handle
    (fun req ->
      let u = current_user req in
      if u.is_superuser then inner req else fail `Forbidden "Operazione riservata ai superuser")
    req

let me_json u =
  let full_name = String.trim (u.first_name ^ " " ^ u.last_name) in
  `Assoc
    [
      ("id", `Int u.id);
      ("username", `String u.username);
      ("fullName", `String (if full_name = "" then u.username else full_name));
      ("is_superuser", `Bool u.is_superuser);
    ]

let login req =
  let%lwt body = json_body req in
  let o = Input.fields body in
  let username = match Input.field o "username" with Some (`String s) -> s | _ -> "" in
  let password = match Input.field o "password" with Some (`String s) -> s | _ -> "" in
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find_opt find_by_username username) in
  let%lwt found = or_fail r in
  let%lwt target = iterations_for_new_hash req in
  let%lwt ok, user =
    match found with
    | None ->
      let%lwt _ = Password.dummy_verify ~iterations:target in
      Lwt.return (false, None)
    | Some (u, is_active, is_staff) ->
      let%lwt valid = Password.verify ~dummy_iterations:target ~password u.password in
      Lwt.return (valid && is_active && is_staff, Some u)
  in
  match (ok, user) with
  | true, Some u ->
    (* come must_update di Django: gli hash con meno iterazioni vengono
       ricalcolati, così i tempi non distinguono più gli utenti vecchi *)
    let%lwt u =
      match Password.iterations_of u.password with
      | Some n when n < target ->
        let%lwt hash = Password.make ~password ~iterations:target in
        let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.exec set_password_req (u.id, hash)) in
        let%lwt () = or_fail r in
        Lwt.return { u with password = hash }
      | _ -> Lwt.return u
    in
    let%lwt () = Dream.invalidate_session req in
    let%lwt () = Dream.set_session_field req session_uid (string_of_int u.id) in
    let%lwt () = set_session_password req u.password in
    let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.exec touch_last_login u.id) in
    let%lwt () = or_fail r in
    log.info (fun m -> m ~request:req "Login admin: %s" u.username);
    json_of_yojson (me_json u)
  | _ ->
    log.warning (fun m -> m ~request:req "Login admin fallito per «%s»" username);
    fail `Unauthorized "Credenziali non valide o utente non abilitato"

let logout req =
  let%lwt () = Dream.invalidate_session req in
  json "{}"

let me req = json_of_yojson (me_json (current_user req))

(* Controllo Origin/Referer per /api/bo, attivo anche con DEBUG=True.

   - Se c'è Origin (o, in sua assenza, Referer) il suo host deve coincidere con
     quello dell'header Host, oppure l'origin deve essere in BO_ALLOWED_ORIGINS.
     Si confronta solo il nome host: dietro nginx l'header Host perde la porta.
   - Per i metodi che modificano dati almeno uno dei due header è obbligatorio
     (i browser li inviano sempre sulle fetch POST/PUT/DELETE). *)
let origin_of_uri u =
  match (Uri.scheme u, Uri.host u) with
  | Some s, Some h -> Some (match Uri.port u with Some p -> Printf.sprintf "%s://%s:%d" s h p | None -> s ^ "://" ^ h)
  | _ -> None

let host_name h =
  (* "example.com:8080" -> "example.com"; "[::1]:8080" -> "[::1]" *)
  match String.rindex_opt h ':' with
  | Some i when not (String.contains (String.sub h i (String.length h - i)) ']') -> String.sub h 0 i
  | _ -> h

let source_allowed req source =
  let u = Uri.of_string source in
  let allowed_explicitly =
    match origin_of_uri u with Some o -> List.mem o Settings.bo_allowed_origins | None -> false
  in
  let same_host =
    match (Uri.host u, Dream.header req "Host") with
    | Some h, Some host ->
      let norm s = String.lowercase_ascii s in
      let h = if String.contains h ':' && h.[0] <> '[' then "[" ^ h ^ "]" else h in
      norm h = norm (host_name host)
    | _ -> false
  in
  allowed_explicitly || same_host

let origin_check : Dream.middleware =
 fun inner req ->
  let source =
    match Dream.header req "Origin" with
    | Some "null" | None -> Dream.header req "Referer"
    | Some o -> Some o
  in
  let unsafe = match Dream.method_ req with `GET | `HEAD | `OPTIONS -> false | _ -> true in
  match source with
  | Some s when source_allowed req s -> inner req
  | Some s ->
    log.warning (fun m -> m ~request:req "Origin/Referer non consentito: %s" s);
    error_json `Forbidden "Origine della richiesta non consentita"
  | None when unsafe ->
    log.warning (fun m -> m ~request:req "Origin e Referer assenti su richiesta %s" (Dream.method_to_string (Dream.method_ req)));
    error_json `Forbidden "Origine della richiesta non verificabile"
  | None -> inner req

(* Fuori da DEBUG il sito è dietro HTTPS: il cookie di sessione deve avere
   l'attributo Secure, che Dream mette solo se vede TLS direttamente. *)
let secure_cookie : Dream.middleware =
 fun inner req ->
  let%lwt resp = inner req in
  if not Settings.debug
  then begin
    let cookies = Dream.headers resp "Set-Cookie" in
    if cookies <> []
    then begin
      Dream.drop_header resp "Set-Cookie";
      List.iter
        (fun c ->
          let has_secure =
            List.exists
              (fun a -> String.lowercase_ascii (String.trim a) = "secure")
              (String.split_on_char ';' c)
          in
          Dream.add_header resp "Set-Cookie" (if has_secure then c else c ^ "; Secure"))
        cookies
    end
  end;
  Lwt.return resp
