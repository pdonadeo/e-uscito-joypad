(lang dune 3.0)

(name e-uscito-joypad)

(using directory-targets 0.1)

(version 8)

(generate_opam_files true)

(license ISC)

(authors "Paolo Donadeo")

(maintainers "paolo@donadeo.net")

(homepage "https://github.com/pdonadeo/e-uscito-joypad")

(bug_reports "https://github.com/pdonadeo/e-uscito-joypad/issues")

(package
 (name e-uscito-joypad)
 (version 8)
 (synopsis "\195\136 uscito Joypad")
 (description
  "Semplice pagina di informazione per sapere se e quando \195\168 uscito\nJoypad, il podcast a tema videoludico di Matteo Bordone (Corri!),\nFrancesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta)")

 (depends
  (ocaml (= 4.14.0))
  (batteries (= 3.5.1))
  (timedesc (= 0.9.0))
  (cohttp-lwt-unix (= 5.0.0))
  (lambdasoup (= 0.7.3))
  (re2 (= v0.15.0))
  (dream (= 1.0.0~alpha4))
  (tyxml-ppx (= 4.5.0))
  (ppx_deriving_yojson (= 3.7.0))
  (caqti-driver-postgresql (= 1.8.0))
  (ppx_rapper_lwt (= 3.1.0))
  (decimal (= 0.3.0))
  (crunch (= 3.3.1))
  (dune (and :dev (= 3.4.1)))
  (utop (and :dev (= 2.10.0)))
  (merlin (and :dev (= 4.6-414)))
  (ocp-indent (and :dev (= 1.8.1)))
  (ocp-index (and :dev (= 1.3.3)))
  (ocamlformat (and :dev (= 0.23.0)))
  (ocaml-lsp-server (and :dev (= 1.13.1)))
  (odoc (and :dev (= 2.1.1)))
  (odig (and :dev (= 0.0.8)))
 )
)
