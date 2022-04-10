(lang dune 3.0)

(name e-uscito-joypad)

(version 2)

(generate_opam_files true)

(license ISC)

(authors "Paolo Donadeo")

(maintainers "paolo@donadeo.net")

(homepage "https://github.com/pdonadeo/e-uscito-joypad")

(bug_reports "https://github.com/pdonadeo/e-uscito-joypad/issues")

(package
 (name e-uscito-joypad)
 (version 2)
 (synopsis "\195\136 uscito Joypad")
 (description
  "Semplice pagina di informazione per sapere se e quando \195\168 uscito\nJoypad, il podcast a tema videoludico di Matteo Bordone (Corri!),\nFrancesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta)")

 (depends
  (ocaml (= 4.14.0))
  (ocaml-lsp-server (>= 1.10.6))
  (batteries (>= 3.5.1))
  (utop (>= 2.9.1))
  (dune (>= 3.0.3))
  (dream (>= 1.0.0~alpha4))
  (timedesc (>= 0.6.0))
  (cohttp-lwt-unix (>= 5.0.0))
  (lambdasoup (>= 0.7.3))
  (re2 (>= v0.15.0))
 )
)