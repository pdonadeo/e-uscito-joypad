// Rimuove i dati creati dai test: episodi "[E2E]…", videogame "e2e-…", utenti "e2e_…".
const { django } = require('./env');

module.exports = async () => {
  django(`
from django.contrib.auth.models import User
from backoffice.models import Episodio, Videogame, AssociazioneEpisodioVideogame
AssociazioneEpisodioVideogame.objects.filter(episodio__titolo__startswith="[E2E]").delete()
AssociazioneEpisodioVideogame.objects.filter(videogame__rawg_slug__startswith="e2e-").delete()
Episodio.objects.filter(titolo__startswith="[E2E]").delete()
Videogame.objects.filter(rawg_slug__startswith="e2e-").delete()
User.objects.filter(username__startswith="e2e_").delete()
`);
};
