(* Hash delle password compatibile con Django: "pbkdf2_sha256$<iter>$<salt>$<base64>".

   PBKDF2-HMAC-SHA256 è implementato qui invece di usare [Kdf.Pbkdf]: i contesti
   HMAC interno ed esterno sono precalcolati una volta, così ogni iterazione costa
   due compressioni SHA-256 invece di quattro (1,5M iterazioni: ~0,9 s contro
   ~1,6 s). Il calcolo gira in un Domain separato per non bloccare Lwt. *)

module H = Digestif.SHA256

let algorithm = "pbkdf2_sha256"
let default_iterations = 1_500_000

let pbkdf2_sha256 ~password ~salt ~iterations =
  let block = 64 in
  let key = if String.length password > block then H.(to_raw_string (digest_string password)) else password in
  let pad c =
    String.init block (fun i -> Char.chr (c lxor if i < String.length key then Char.code key.[i] else 0))
  in
  let ictx = H.feed_string H.empty (pad 0x36) and octx = H.feed_string H.empty (pad 0x5c) in
  let prf msg = H.(to_raw_string (get (feed_string octx (to_raw_string (get (feed_string ictx msg)))))) in
  (* dk_len = 32 = output SHA-256: basta il primo blocco (indice 1). *)
  let u = ref (prf (salt ^ "\000\000\000\001")) in
  let acc = Bytes.of_string !u in
  for _ = 2 to iterations do
    u := prf !u;
    for i = 0 to 31 do
      Bytes.unsafe_set acc i
        (Char.unsafe_chr (Char.code (Bytes.unsafe_get acc i) lxor Char.code (String.unsafe_get !u i)))
    done
  done;
  Bytes.to_string acc

let encode ~iterations ~salt dk =
  Printf.sprintf "%s$%d$%s$%s" algorithm iterations salt (Base64.encode_exn dk)

type parsed = { iterations : int; salt : string; hash : string }

let parse encoded =
  match String.split_on_char '$' encoded with
  | [alg; iter; salt; hash] when alg = algorithm -> (
    match int_of_string_opt iter with
    | Some iterations when iterations > 0 && salt <> "" && hash <> "" -> Some { iterations; salt; hash }
    | _ -> None)
  | _ -> None

let iterations_of encoded = Option.map (fun p -> p.iterations) (parse encoded)

let constant_time_equal a b =
  String.length a = String.length b
  &&
  let r = ref 0 in
  String.iteri (fun i c -> r := !r lor (Char.code c lxor Char.code b.[i])) a;
  !r = 0

(* Al massimo [max_running] hash in calcolo e [max_waiting] in coda: oltre si
   risponde 429. Il processo serve anche il sito pubblico, e ogni hash costa
   ~0,9 s di CPU: senza limite una raffica di login anonimi lo saturerebbe. *)
let max_running = 2
let max_waiting = 8
let running = ref 0
let waiting : unit Lwt.u Queue.t = Queue.create ()

let release () =
  match Queue.take_opt waiting with
  | Some w -> Lwt.wakeup_later w () (* lo slot passa direttamente a chi aspetta *)
  | None -> decr running

let with_slot f =
  let run () = Lwt.finalize f (fun () -> release (); Lwt.return_unit) in
  if !running < max_running
  then begin
    incr running;
    run ()
  end
  else if Queue.length waiting >= max_waiting
  then Resp.fail `Too_Many_Requests "Troppe richieste di login, riprova tra poco"
  else begin
    let p, w = Lwt.wait () in
    Queue.push w waiting;
    Lwt.bind p run
  end

(* Il calcolo gira in un Domain a parte: un systhread di Lwt_preemptive da solo
   terrebbe il runtime lock del dominio principale e rallenterebbe il loop Lwt
   che serve il sito pubblico. Il systhread si limita ad attendere (Domain.join
   rilascia il lock). *)
let compute ~password ~salt ~iterations =
  with_slot (fun () ->
      Lwt_preemptive.detach
        (fun () -> Domain.join (Domain.spawn (fun () -> pbkdf2_sha256 ~password ~salt ~iterations)))
        ())

(* Consuma lo stesso tempo di una verifica reale: usato quando l'utente non
   esiste o l'hash non è leggibile, per non rivelarlo con i tempi di risposta
   (come fa Django). *)
let dummy_verify ~iterations =
  let%lwt _ = compute ~password:"" ~salt:"dummy-salt" ~iterations in
  Lwt.return false

(* Verifica [password] contro un hash Django. Gli algoritmi diversi da
   pbkdf2_sha256 (argon2, bcrypt, hash inutilizzabili "!...") non sono
   supportati e danno false, dopo un calcolo fittizio di [dummy_iterations]. *)
let verify ~dummy_iterations ~password encoded =
  match parse encoded with
  | None -> dummy_verify ~iterations:dummy_iterations
  | Some p ->
    let%lwt dk = compute ~password ~salt:p.salt ~iterations:p.iterations in
    Lwt.return (constant_time_equal (Base64.encode_exn dk) p.hash)

(* Salt come quello di Django: 22 caratteri alfanumerici (~131 bit). *)
let random_salt () =
  let alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" in
  let n = String.length alphabet in
  let b = Buffer.create 22 in
  while Buffer.length b < 22 do
    String.iter
      (fun c ->
        (* rejection sampling: 248 = 4 * 62, nessun bias *)
        let v = Char.code c in
        if v < 248 && Buffer.length b < 22 then Buffer.add_char b alphabet.[v mod n])
      (Dream.random 32)
  done;
  Buffer.contents b

let make ~password ~iterations =
  let salt = random_salt () in
  let%lwt dk = compute ~password ~salt ~iterations in
  Lwt.return (encode ~iterations ~salt dk)
