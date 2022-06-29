from django.core.management.base import BaseCommand
from backoffice.models import Episodio


class Command(BaseCommand):
    help = 'Cancella tutte le descrizioni degli episodi'

    def handle(self, *args, **options):
        for ep in Episodio.objects.all():
            ep.descrizione_txt = None
            ep.descrizione_html = None
            ep.save()
