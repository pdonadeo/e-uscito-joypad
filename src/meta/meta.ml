(* Risposta del giorno e blocco <head> delle pagine: logica pura, senza rete né orologio. *)

type ep_num =
  | Intero of int
  | Stringa of string
  | NonSpecificato
[@@deriving yojson]

type data = {
  ep_num : ep_num;
  title : string;
  date : Timedesc.Date.t;
}

type dati_ultima_puntata = {
  uscito : bool;
  giorni_fa : string;
  data_italiano : string;
  ep_num : ep_num;
  titolo : string;
  msg_risposta_no : string option;
}
[@@deriving yojson]

let soglia_uscito_giorni = 24
let soglia_lamentele_giorni = 48

(* [oggi] è la data corrente a Roma; [ultima] la puntata più recente nota, se c'è. *)
let decidi ~(oggi : Timedesc.Date.t) (ultima : data option) : dati_ultima_puntata =
  match ultima with
  | Some ultima ->
    let mese_corrente = Timedesc.Date.month oggi in
    let giorni_passati = Timedesc.Date.diff_days oggi ultima.date in
    let uscito = giorni_passati <= soglia_uscito_giorni in
    let giorni_fa = Utils.distanza giorni_passati in
    let data_italiano = Utils.string_of_date ultima.date in
    let msg_risposta_no =
      match giorni_passati with
      | _n when (not uscito) && (mese_corrente = 8 || mese_corrente = 9) ->
        Some "È finita la stagione di Joypad. Aspettiamo la prossima a Settembre."
      | n when (not uscito) && n <= soglia_lamentele_giorni ->
        Some "Però adesso non torturare Zampa, aspetta ancora qualche giorno…"
      | n when (not uscito) && n > soglia_lamentele_giorni ->
        Some "Mi duole ammetterlo ma è giunto il momento di protestare!"
      | _ -> None
    in
    { uscito; giorni_fa; data_italiano; ep_num = ultima.ep_num; titolo = ultima.title; msg_risposta_no }
  | None ->
    { uscito = false; giorni_fa = ""; data_italiano = ""; ep_num = NonSpecificato; titolo = ""; msg_risposta_no = None }

(* Title e description della pagina pubblica, in chiaro (l'escaping lo fa [blocco_head]). *)
let titolo_e_descrizione (d : dati_ultima_puntata) : string * string =
  (* nessuna puntata nota (né dal Post né dal DB): testo neutro, la description storica del sito *)
  if (not d.uscito) && d.giorni_fa = ""
  then
    ( "È uscito Joypad?",
      "Semplice pagina di informazione per sapere se e quando è uscito Joypad, il podcast a tema videoludico di Matteo \
       Bordone (Corri!), Francesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta)." )
  else if d.uscito
  then begin
    let n =
      match d.ep_num with
      | Intero i -> " numero " ^ string_of_int i
      | Stringa s -> " " ^ s
      | NonSpecificato -> ""
    in
    ( "Sì! È uscito l'episodio «" ^ d.titolo ^ "» — È uscito Joypad?",
      "Sì! È uscito " ^ d.giorni_fa ^ " l'episodio" ^ n ^ " di Joypad, dal titolo «" ^ d.titolo ^ "»." )
  end
  else begin
    let msg =
      match d.msg_risposta_no with
      | Some m -> " " ^ m
      | None -> ""
    in
    ( "No. L'ultimo episodio è uscito " ^ d.giorni_fa ^ " — È uscito Joypad?",
      "No. L'ultimo episodio di Joypad è uscito " ^ d.giorni_fa ^ ", " ^ d.data_italiano ^ "." ^ msg )
  end

let google_site_verification = "RVQl_YUzLnpzfD8LfW0RND3EgYD_grzfjKCwshqJ1Xg"
let titolo_bo = "Retrobottega di «È uscito Joypad?»"

(* Il blocco che sostituisce <!-- euj:head --> nell'index.html di Vite. Per il pubblico,
   [percorso] è il solo percorso della richiesta, senza query string. *)
let blocco_head (pagina : [`Pubblico of string * dati_ultima_puntata | `Bo]) : string =
  let e = Dream.html_escape in
  match pagina with
  | `Pubblico (percorso, dati) ->
    let titolo, descrizione = titolo_e_descrizione dati in
    String.concat
      "\n"
      [
        "<title>" ^ e titolo ^ "</title>";
        {|<meta name="description" content="|} ^ e descrizione ^ {|">|};
        {|<meta property="og:title" content="|} ^ e titolo ^ {|">|};
        {|<meta property="og:description" content="|} ^ e descrizione ^ {|">|};
        {|<meta property="og:type" content="website">|};
        {|<meta property="og:locale" content="it_IT">|};
        {|<meta property="og:url" content="|} ^ e (Settings.sito ^ percorso) ^ {|">|};
        {|<meta property="og:image" content="|} ^ e (Settings.sito ^ "/joypad-img.jpg") ^ {|">|};
        {|<meta name="robots" content="index, follow">|};
        {|<meta name="google-site-verification" content="|} ^ e google_site_verification ^ {|">|};
        {|<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">|};
        {|<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">|};
        {|<link rel="apple-touch-icon" sizes="180x180" href="/static/apple-touch-icon.png">|};
        {|<link rel="manifest" href="/site.webmanifest">|};
      ]
  | `Bo ->
    String.concat
      "\n"
      [
        "<title>" ^ e titolo_bo ^ "</title>";
        {|<meta name="robots" content="noindex, nofollow">|};
        {|<link rel="icon" type="image/svg+xml" href="/favicon-bo.svg">|};
      ]
