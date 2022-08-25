module type DB = Caqti_lwt.CONNECTION

module Common = Db_common

module Django = struct
  module Episodio = Django__episodio
  module Videogame = Django__videogame
  module Associazione_episodio_videogame = Django__associazioneepisodiovideogame
end
