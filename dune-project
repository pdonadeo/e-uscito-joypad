(lang dune 2.9)

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
  "Semplice pagina di informazione per sapere se \195\168 uscito Joypad,\nil podcast a tema videoludico di Matteo Bordone, Alessandro Zampini e\nFrancesco Fossetti")
 (depends
  (dream
   (>= 1.0.0~alpha4))
  (batteries
   (>= 3.5.1))
  (timedesc
   (>= 0.6.0))
  (cohttp-lwt-unix
   (>= 5.0.0))
  (lambdasoup
   (>= 0.7.3))
  (re2
   (>= v0.15.0))))
