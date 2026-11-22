(* Gestione utenti (solo superuser) sulla tabella Django auth_user, che resta
   l'unica fonte durante la convivenza. Le password sono scritte nel formato
   pbkdf2_sha256 di Django, quindi valgono anche in /legacy-bo.
   Il campo password non viene mai restituito. *)

open Resp
open Input

let columns =
  "u.id, u.username, u.first_name, u.last_name, u.email, u.is_staff, u.is_active, u.is_superuser, u.last_login, \
   u.date_joined"

let get_req =
  Caqti_request.Infix.(Caqti_type.int ->? Caqti_type.string)
    (Printf.sprintf "SELECT to_jsonb(r)::text FROM (SELECT %s FROM auth_user u WHERE u.id = $1) r" columns)

(* auth_user.id è integer, non bigint *)
let int_param req =
  let id = int64_param req "id" in
  if id > Int64.of_int32 Int32.max_int then not_found () else Int64.to_int id

let fetch_one req id =
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find_opt get_req id) in
  match%lwt or_fail r with
  | Some j -> Lwt.return j
  | None -> not_found ()

(* UnicodeUsernameValidator di Django: lettere, cifre e @ . + - _ *)
let valid_username s =
  String.for_all
    (function 'a' .. 'z' | 'A' .. 'Z' | '0' .. '9' | '@' | '.' | '+' | '-' | '_' -> true | c -> Char.code c >= 128)
    s

let valid_email s =
  match String.split_on_char '@' s with
  | [local; domain] -> local <> "" && String.contains domain '.' && not (String.contains s ' ')
  | _ -> false

let min_password_length = 8

let parse_payload ~require_password body =
  let o = fields body in
  let username = string_req ~max:150 o "username" in
  if not (valid_username username) then invalid "username" "solo lettere, cifre e @ . + - _";
  let email = Option.value (string_opt ~max:254 o "email") ~default:"" in
  if email <> "" && not (valid_email email) then invalid "email" "indirizzo non valido";
  let password =
    match field o "password" with
    | None | Some `Null | Some (`String "") ->
      if require_password then invalid "password" "obbligatoria" else None
    | Some (`String p) ->
      if String.length p < min_password_length
      then invalid "password" (Printf.sprintf "almeno %d caratteri" min_password_length)
      else Some p
    | Some _ -> invalid "password" "deve essere una stringa"
  in
  let first_name = Option.value (string_opt ~max:150 o "first_name") ~default:"" in
  let last_name = Option.value (string_opt ~max:150 o "last_name") ~default:"" in
  let flags =
    ( bool_def o "is_staff" ~default:true,
      bool_def o "is_active" ~default:true,
      bool_def o "is_superuser" ~default:false )
  in
  (username, email, first_name, last_name, flags, password)

let to_db_json (username, email, first_name, last_name, (is_staff, is_active, is_superuser), _) password_hash =
  `Assoc
    [
      ("username", `String username);
      ("email", `String email);
      ("first_name", `String first_name);
      ("last_name", `String last_name);
      ("is_staff", `Bool is_staff);
      ("is_active", `Bool is_active);
      ("is_superuser", `Bool is_superuser);
      ("password", j_str_opt password_hash);
    ]
  |> Yojson.Safe.to_string

let hash_password req = function
  | None -> Lwt.return_none
  | Some password ->
    let%lwt iterations = Auth.iterations_for_new_hash req in
    Lwt.map Option.some (Password.make ~password ~iterations)

let unique_msg = "Esiste già un utente con questo username"

let insert_req =
  Caqti_request.Infix.(Caqti_type.string ->! Caqti_type.int)
    {|INSERT INTO auth_user
        (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined)
      SELECT j->>'password', NULL, (j->>'is_superuser')::boolean, j->>'username', j->>'first_name',
             j->>'last_name', j->>'email', (j->>'is_staff')::boolean, (j->>'is_active')::boolean, now()
      FROM (SELECT $1::jsonb AS j) s
      RETURNING id|}

let update_req =
  Caqti_request.Infix.(Caqti_type.(t2 int string) ->? Caqti_type.int)
    {|UPDATE auth_user u SET
        username = j->>'username',
        email = j->>'email',
        first_name = j->>'first_name',
        last_name = j->>'last_name',
        is_staff = (j->>'is_staff')::boolean,
        is_active = (j->>'is_active')::boolean,
        is_superuser = (j->>'is_superuser')::boolean,
        password = coalesce(j->>'password', u.password)
      FROM (SELECT $2::jsonb AS j) s
      WHERE u.id = $1
      RETURNING u.id|}

let delete_req = Caqti_request.Infix.(Caqti_type.int ->. Caqti_type.unit) "DELETE FROM auth_user WHERE id = $1"
