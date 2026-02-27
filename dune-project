(lang dune 3.20)

(name e-uscito-joypad)

(using directory-targets 0.1)

(version 40)

(generate_opam_files true)

(license ISC)

(authors "Paolo Donadeo")

(maintainers "paolo@donadeo.net")

(homepage "https://github.com/pdonadeo/e-uscito-joypad")

(bug_reports "https://github.com/pdonadeo/e-uscito-joypad/issues")

(package
 (name e-uscito-joypad)
 (version 40)
 (synopsis "È uscito Joypad")
 (description
  "Semplice pagina di informazione per sapere se e quando è uscito\nJoypad, il podcast a tema videoludico di Matteo Bordone (Corri!),\nFrancesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta)")
 (depends
  (ocaml
   (= 5.3.0))
  (batteries
   (= 3.10.0))
  (timedesc
   (= 3.1.0))
  (cohttp-lwt-unix
   (= 6.1.1))
  (lambdasoup
   (= 1.1.1))
  (re2
   (= v0.17.0))
  (dream
   (= 1.0.0~alpha8))
  (tyxml-ppx
   (= 4.6.0))
  (ppx_deriving_yojson
   (= 3.9.1))
  (caqti-driver-postgresql
   (= 2.2.4))
  (decimal
   (= 1.0.2))
  (crunch
   (= 4.0.0))
  (dune
   (and
    :dev
    (= 3.20.2)))
  (utop
   (and
    :dev
    (= 2.16.0)))
  (merlin
   (and
    :dev
    (= 5.6-503)))
  (ocp-indent
   (and
    :dev
    (= 1.9.0)))
  (ocp-index
   (and
    :dev
    (= 1.4.0)))
  (ocamlformat
   (and
    :dev
    (= 0.28.1)))
  (ocaml-lsp-server
   (and
    :dev
    (= 1.23.1)))
  (odoc
   (and
    :dev
    (= 3.1.0)))
  (odig
   (and
    :dev
    (= 0.1.0)))))
