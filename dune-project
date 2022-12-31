(lang dune 3.6)

(name e-uscito-joypad)

(using directory-targets 0.1)

(version 13)

(generate_opam_files true)

(license ISC)

(authors "Paolo Donadeo")

(maintainers "paolo@donadeo.net")

(homepage "https://github.com/pdonadeo/e-uscito-joypad")

(bug_reports "https://github.com/pdonadeo/e-uscito-joypad/issues")

(package
 (name e-uscito-joypad)
 (version 13)
 (synopsis "\195\136 uscito Joypad")
 (description
  "Semplice pagina di informazione per sapere se e quando \195\168 uscito\nJoypad, il podcast a tema videoludico di Matteo Bordone (Corri!),\nFrancesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta)")

 (depends
  (ocaml (= 4.14.1))
  (batteries (= 3.6.0))
  (timedesc (= 0.9.1))
  (cohttp-lwt-unix (= 5.0.0))
  (lambdasoup (= 0.7.3))
  (re2 (= v0.15.0))
  (dream (= 1.0.0~alpha4))
  (tyxml-ppx (= 4.5.0))
  (ppx_deriving_yojson (= 3.7.0))
  (caqti-driver-postgresql (= 1.9.1))
  (ppx_rapper_lwt (= 3.1.0))
  (decimal (= 0.3.0))
  (crunch (= 3.3.1))
  (dune (and :dev (= 3.6.1)))
  (utop (and :dev (= 2.10.0)))
  (merlin (and :dev (= 4.7-414)))
  (ocp-indent (and :dev (= 1.8.1)))
  (ocp-index (and :dev (= 1.3.4)))
  (ocamlformat (and :dev (= 0.24.1)))
  (ocaml-lsp-server (and :dev (= 1.14.2)))
  (odoc (and :dev (= 2.2.0)))
  (odig (and :dev (= 0.0.8)))
 )
)
