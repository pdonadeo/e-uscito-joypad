(* Test unitari di Meta: decisione SÌ/NO con una data di oggi fissa e resa del blocco <head>.
   Un controllo fallito fa uscire con un codice diverso da 0. *)

open Meta

let contiene ~sotto s =
  let n = String.length sotto
  and m = String.length s in
  let rec da i = i + n <= m && (String.sub s i n = sotto || da (i + 1)) in
  da 0

let verifica nome cond = if not cond then failwith ("test fallito: " ^ nome)

let uguale nome ~atteso valore =
  if atteso <> valore then failwith (Printf.sprintf "test fallito: %s\n  atteso:  %S\n  trovato: %S" nome atteso valore)

let data s = Timedesc.Date.of_iso8601_exn s
let puntata ?(ep_num = Intero 47) ?(title = "Quello con Elden Ring") d = Some { ep_num; title; date = data d }

(* ---- Decisione ---- *)

let oggi = data "2026-11-28"
let stagione = "È finita la stagione di Joypad. Aspettiamo la prossima a Settembre."
let attesa = "Però adesso non torturare Zampa, aspetta ancora qualche giorno…"
let protesta = "Mi duole ammetterlo ma è giunto il momento di protestare!"

let () =
  let d = decidi ~oggi (puntata "2026-11-28") in
  verifica "oggi: uscito" d.uscito;
  uguale "oggi: giorni_fa" ~atteso:"oggi" d.giorni_fa;
  uguale "oggi: data_italiano" ~atteso:"sabato 28 Novembre 2026" d.data_italiano;
  uguale "oggi: titolo" ~atteso:"Quello con Elden Ring" d.titolo;
  verifica "oggi: ep_num" (d.ep_num = Intero 47);
  verifica "oggi: nessun messaggio" (d.msg_risposta_no = None);
  uguale "ieri" ~atteso:"ieri" (decidi ~oggi (puntata "2026-11-27")).giorni_fa;
  uguale "l'altro ieri" ~atteso:"l'altro ieri" (decidi ~oggi (puntata "2026-11-26")).giorni_fa

(* soglia di 24 giorni: a 24 è uscito, a 25 no *)
let () =
  let d = decidi ~oggi (puntata "2026-11-04") in
  verifica "24 giorni: uscito" d.uscito;
  uguale "24 giorni: giorni_fa" ~atteso:"24 giorni fa" d.giorni_fa;
  verifica "24 giorni: nessun messaggio" (d.msg_risposta_no = None);
  let d = decidi ~oggi (puntata "2026-11-03") in
  verifica "25 giorni: non uscito" (not d.uscito);
  uguale "25 giorni: giorni_fa" ~atteso:"25 giorni fa" d.giorni_fa;
  verifica "25 giorni: attesa" (d.msg_risposta_no = Some attesa)

(* soglia di 48 giorni: a 48 si aspetta, a 49 si protesta *)
let () =
  verifica "48 giorni: attesa" ((decidi ~oggi (puntata "2026-10-11")).msg_risposta_no = Some attesa);
  let d = decidi ~oggi (puntata "2026-10-10") in
  verifica "49 giorni: non uscito" (not d.uscito);
  verifica "49 giorni: protesta" (d.msg_risposta_no = Some protesta)

(* ad agosto e settembre il NO parla della pausa estiva, qualunque sia la distanza *)
let () =
  let d = decidi ~oggi:(data "2026-08-20") (puntata "2026-06-30") in
  verifica "agosto: non uscito" (not d.uscito);
  verifica "agosto: stagione" (d.msg_risposta_no = Some stagione);
  let d = decidi ~oggi:(data "2026-09-10") (puntata "2026-08-10") in
  verifica "settembre: stagione" (d.msg_risposta_no = Some stagione);
  let d = decidi ~oggi:(data "2026-09-10") (puntata "2026-09-01") in
  verifica "settembre, uscito: nessun messaggio" (d.uscito && d.msg_risposta_no = None);
  verifica
    "ottobre: niente stagione"
    ((decidi ~oggi:(data "2026-10-30") (puntata "2026-10-01")).msg_risposta_no = Some attesa)

let () =
  let d = decidi ~oggi None in
  verifica
    "nessuna puntata"
    ((not d.uscito) && d.giorni_fa = "" && d.ep_num = NonSpecificato && d.msg_risposta_no = None)

(* il JSON di /api/ultima-puntata non cambia forma *)
let () =
  let d = decidi ~oggi (puntata "2026-11-27") in
  uguale
    "json"
    ~atteso:
      {|{"uscito":true,"giorni_fa":"ieri","data_italiano":"venerdì 27 Novembre 2026","ep_num":["Intero",47],"titolo":"Quello con Elden Ring","msg_risposta_no":null}|}
    (dati_ultima_puntata_to_yojson d |> Yojson.Safe.to_string)

(* ---- Resa ---- *)

let si =
  {
    uscito = true;
    giorni_fa = "ieri";
    data_italiano = "venerdì 27 Novembre 2026";
    ep_num = Intero 47;
    titolo = "Quello con Elden Ring";
    msg_risposta_no = None;
  }

let no msg =
  {
    uscito = false;
    giorni_fa = "30 giorni fa";
    data_italiano = "mercoledì 29 Ottobre 2026";
    ep_num = Intero 46;
    titolo = "Quello vecchio";
    msg_risposta_no = msg;
  }

let pubblico ?(percorso = "/") dati = blocco_head (`Pubblico (percorso, dati))

let () =
  let t, d = titolo_e_descrizione si in
  uguale "SÌ: title" ~atteso:"Sì! È uscito l'episodio «Quello con Elden Ring» — È uscito Joypad?" t;
  uguale
    "SÌ: description"
    ~atteso:"Sì! È uscito ieri l'episodio numero 47 di Joypad, dal titolo «Quello con Elden Ring»."
    d;
  let _, d = titolo_e_descrizione { si with ep_num = Stringa "speciale" } in
  uguale
    "SÌ: numero stringa"
    ~atteso:"Sì! È uscito ieri l'episodio speciale di Joypad, dal titolo «Quello con Elden Ring»."
    d;
  let _, d = titolo_e_descrizione { si with ep_num = NonSpecificato } in
  uguale
    "SÌ: numero non specificato"
    ~atteso:"Sì! È uscito ieri l'episodio di Joypad, dal titolo «Quello con Elden Ring»."
    d

let () =
  let t, d = titolo_e_descrizione (no None) in
  uguale "NO: title" ~atteso:"No. L'ultimo episodio è uscito 30 giorni fa — È uscito Joypad?" t;
  uguale
    "NO senza messaggio"
    ~atteso:"No. L'ultimo episodio di Joypad è uscito 30 giorni fa, mercoledì 29 Ottobre 2026."
    d;
  let _, d = titolo_e_descrizione (no (Some attesa)) in
  uguale
    "NO con messaggio normale"
    ~atteso:("No. L'ultimo episodio di Joypad è uscito 30 giorni fa, mercoledì 29 Ottobre 2026. " ^ attesa)
    d;
  let _, d = titolo_e_descrizione (no (Some stagione)) in
  uguale
    "NO con messaggio di agosto/settembre"
    ~atteso:("No. L'ultimo episodio di Joypad è uscito 30 giorni fa, mercoledì 29 Ottobre 2026. " ^ stagione)
    d

let () =
  let h = pubblico ~percorso:"/se-ne-parla-qui/1/x" si in
  List.iter
    (fun sotto -> verifica ("SÌ: blocco contiene " ^ sotto) (contiene ~sotto h))
    [
      "<title>Sì! È uscito l&#x27;episodio «Quello con Elden Ring» — È uscito Joypad?</title>";
      {|<meta name="description" content="Sì! È uscito ieri l&#x27;episodio numero 47 di Joypad, dal titolo «Quello con Elden Ring».">|};
      {|<meta property="og:title" content="Sì! È uscito l&#x27;episodio «Quello con Elden Ring» — È uscito Joypad?">|};
      {|<meta property="og:description" content="Sì! |};
      {|<meta property="og:type" content="website">|};
      {|<meta property="og:locale" content="it_IT">|};
      {|<meta property="og:url" content="https://www.euscitojoypad.it/se-ne-parla-qui/1/x">|};
      {|<meta property="og:image" content="https://www.euscitojoypad.it/joypad-img.jpg">|};
      {|<meta name="robots" content="index, follow">|};
      {|<meta name="google-site-verification" content="RVQl_YUzLnpzfD8LfW0RND3EgYD_grzfjKCwshqJ1Xg">|};
      {|<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">|};
      {|<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">|};
      {|<link rel="apple-touch-icon" sizes="180x180" href="/static/apple-touch-icon.png">|};
      {|<link rel="manifest" href="/site.webmanifest">|};
    ];
  verifica "SÌ: niente noindex" (not (contiene ~sotto:"noindex" h))

(* nessuna puntata nota: testo neutro, niente «uscito  —» né «, .» *)
let () =
  let t, d = titolo_e_descrizione (decidi ~oggi None) in
  uguale "nessuna puntata: title" ~atteso:"È uscito Joypad?" t;
  uguale
    "nessuna puntata: description"
    ~atteso:
      "Semplice pagina di informazione per sapere se e quando è uscito Joypad, il podcast a tema videoludico di Matteo \
       Bordone (Corri!), Francesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta)."
    d;
  let h = pubblico (decidi ~oggi None) in
  verifica "nessuna puntata: <title>" (contiene ~sotto:"<title>È uscito Joypad?</title>" h);
  verifica "nessuna puntata: niente «, .»" (not (contiene ~sotto:", ." h))

let () =
  let h = pubblico (no (Some protesta)) in
  verifica
    "NO: title"
    (contiene ~sotto:"<title>No. L&#x27;ultimo episodio è uscito 30 giorni fa — È uscito Joypad?</title>" h);
  verifica "NO: description col messaggio" (contiene ~sotto:(protesta ^ {|">|}) h);
  verifica
    "NO: og:url della home"
    (contiene ~sotto:{|<meta property="og:url" content="https://www.euscitojoypad.it/">|} h)

(* escaping: nessun valore esce dall'attributo o dal <title> *)
let () =
  let h = pubblico ~percorso:{|/x"y|} { si with titolo = {|A <b> & "C"|} } in
  verifica "escape nel title" (contiene ~sotto:"«A &lt;b&gt; &amp; &quot;C&quot;» — È uscito Joypad?</title>" h);
  verifica "escape nella description" (contiene ~sotto:{|dal titolo «A &lt;b&gt; &amp; &quot;C&quot;».">|} h);
  verifica "escape nell'og:url" (contiene ~sotto:{|content="https://www.euscitojoypad.it/x&quot;y">|} h);
  verifica "niente <b> grezzo" (not (contiene ~sotto:"<b>" h));
  verifica "niente & grezzo" (not (contiene ~sotto:"& " h))

let () =
  let h = blocco_head `Bo in
  verifica "bo: title" (contiene ~sotto:"<title>Retrobottega di «È uscito Joypad?»</title>" h);
  verifica "bo: noindex" (contiene ~sotto:{|<meta name="robots" content="noindex, nofollow">|} h);
  verifica "bo: favicon svg" (contiene ~sotto:{|<link rel="icon" type="image/svg+xml" href="/favicon-bo.svg">|} h);
  verifica "bo: nessun og:" (not (contiene ~sotto:"og:" h));
  verifica "bo: nessuna description" (not (contiene ~sotto:"description" h))

let () = print_endline "test_meta: tutto ok"
