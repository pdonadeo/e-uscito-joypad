import json

from django.core.management.base import BaseCommand, CommandError
from backoffice.models import Episodio, Videogame

from backoffice.models import SPEAKER_CHOICES_DICT, TIPOLOGIA_CHOICES_DICT


class Command(BaseCommand):
    help = "Esporta il database in formato JSON"

    def handle(self, *args, **options):
        episodi = []
        for ep in Episodio.objects.all().order_by("data_uscita"):
            ep_j = {}
            ep_j["titolo"] = ep.titolo
            ep_j["episodio_numero"] = ep.episodio_numero
            ep_j["data_uscita"] = ep.data_uscita.isoformat()
            ep_j["descrizione_txt"] = ep.descrizione_txt
            ep_j["descrizione_html"] = ep.descrizione_html
            ep_j["durata"] = ep.durata.total_seconds()
            ep_j["url"] = ep.url
            ep_j["url_post"] = ep.url_post
            ep_j["url_video"] = ep.url_video
            if ep.cover:
                ep_j["cover"] = ep.cover.url
            else:
                ep_j["cover"] = None

            giochi = []
            for assoc in ep.associazioneepisodiovideogame_set.all().order_by("istante"):
                gioco = assoc.videogame
                gioco_j = {
                    "titolo": gioco.titolo,
                    "descrizione_txt": gioco.descrizione_raw,
                    "descrizione_html": gioco.descrizione_html,
                    "cover": gioco.cover,
                    "istante": assoc.istante.total_seconds(),
                    "speaker": SPEAKER_CHOICES_DICT[assoc.speaker],
                    "tipologia": TIPOLOGIA_CHOICES_DICT[assoc.tipologia],
                }
                giochi.append(gioco_j)

            ep_j["giochi"] = giochi
            episodi.append(ep_j)

        giochi = []
        for gioco in Videogame.objects.all().order_by("rawg_slug"):
            gioco_j = {
                "titolo": gioco.titolo,
                "descrizione_txt": gioco.descrizione_raw,
                "descrizione_html": gioco.descrizione_html,
                "cover": gioco.cover,
                "rawg_slug": gioco.rawg_slug,
            }
            giochi.append(gioco_j)

        with open("db_data.json", "w") as f:
            json.dump(
                {
                    "episodi": episodi,
                    "giochi": giochi,
                },
                f,
            )
        self.stdout.write(self.style.SUCCESS("Esportazione completata"))
