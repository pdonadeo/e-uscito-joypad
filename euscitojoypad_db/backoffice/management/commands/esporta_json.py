import json

from django.core.management.base import BaseCommand, CommandError
from backoffice.models import Episodio


class Command(BaseCommand):
    help = "Esporta il database in formato JSON"

    def handle(self, *args, **options):
        episodi = []
        for ep in Episodio.objects.all():
            ep_j = {}
            ep_j["titolo"] = ep.titolo
            ep_j["episodio_numero"] = ep.episodio_numero
            ep_j["data_uscita"] = ep.data_uscita.isoformat()
            ep_j["durata"] = ep.durata.total_seconds()
            ep_j["url"] = ep.url
            ep_j["url_post"] = ep.url_post
            ep_j["url_video"] = ep.url_video
            if ep.cover:
                ep_j["cover"] = f"https://db.euscitojoypad.it{ep.cover.url}"
            else:
                ep_j["cover"] = None
            episodi.append(ep_j)
        with open("db_data.json", "w") as f:
            json.dump(
                {
                    "episodi": episodi,
                },
                f,
            )
        self.stdout.write(self.style.SUCCESS("Esportazione completata"))
