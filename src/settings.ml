open Utils

type seconds = float

(* Costanti del progetto *)
let monitor_period_sec : seconds = 60.0 *. 10.0
let joypad_page = "https://www.ilpost.it/podcasts/joypad/"

(* Opzioni di questo server REST *)
let listen_address = getenv ~default:"0.0.0.0" ~f:Fun.id "REST_LISTEN_ADDRESS"
let listen_port = getenv ~default:3000 ~f:int_of_string "REST_LISTEN_PORT"

let debug =
  getenv
    ~default:true
    ~f:(fun v ->
      match String.lowercase_ascii v with
      | "true" -> true
      | "false" -> false
      | _ -> true)
    "DEBUG"

let media_url = getenv ~default:"" ~f:Fun.id "MEDIA_URL"
let gc_period_sec : seconds = getenv ~default:(3600.0 *. 24.0) ~f:float_of_string "GC_PERIOD_SEC"

(* Connessione a PostgreSQL *)
let pghost = getenv ~default:"localhost" ~f:Fun.id "PGHOST"
let pgport = getenv ~default:5432 ~f:int_of_string "PGPORT"
let pguser = getenv ~default:"" ~f:Fun.id "PGUSER"
let pgpassword = getenv ~default:"" ~f:Fun.id "PGPASSWORD"
let pgdatabase = getenv ~default:"" ~f:Fun.id "PGDATABASE"
let django_connection_string = spf "postgresql://%s:%s@%s:%d/%s" pguser pgpassword pghost pgport pgdatabase

(* Admin (/bo e /api/bo) *)

(* Segreto per cifrare i cookie di sessione. Obbligatorio con DEBUG=False
   (controllato all'avvio); in debug, se manca, Dream ne genera uno casuale. *)
let dream_secret =
  getenv ~default:None ~f:(fun v -> if String.trim v = "" then None else Some (String.trim v)) "DREAM_SECRET"

(* Directory dei file caricati (cover): la stessa MEDIA di Django. *)
let media_root = getenv ~default:"/media" ~f:Fun.id "MEDIA_ROOT"

(* Variabile condivisa con Django (settings.py: RAWG_API_KEY). *)
let rawg_api_key = getenv ~default:"" ~f:Fun.id "RAWG_API_KEY"
let rawg_api_url = getenv ~default:"https://api.rawg.io/api" ~f:Fun.id "RAWG_API_URL"

(* Origin aggiuntive accettate da /api/bo oltre a quella dell'host, separate
   da virgola (es. "http://localhost:3000" per il dev server di Vite). *)
let bo_allowed_origins =
  getenv ~default:[]
    ~f:(fun v -> String.split_on_char ',' v |> List.map String.trim |> List.filter (fun s -> s <> ""))
    "BO_ALLOWED_ORIGINS"
