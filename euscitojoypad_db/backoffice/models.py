import datetime

from statistics import mode
from django.db import models


class Episodio(models.Model):
    class Meta:
        verbose_name = "episodio"
        verbose_name_plural = "episodi"

    ts_created = models.DateTimeField(auto_now_add=True)
    ts = models.DateTimeField(auto_now=True)

    titolo = models.CharField(verbose_name="Titolo", max_length=256, null=False, blank=False, default="")
    episodio_numero = models.CharField(verbose_name="Numero", max_length=32, null=True, blank=True)
    data_uscita = models.DateField(
        verbose_name="Data uscita", blank=False, null=False, default=datetime.date(2019, 12, 15)
    )
    durata = models.DurationField(
        verbose_name="Durata", null=False, blank=False, default=datetime.timedelta(minutes=30)
    )

    def __str__(self):
        return f"Ep. {self.episodio_numero}, {self.titolo}"


class Videogame(models.Model):
    class Meta:
        verbose_name = "Videogame"
        verbose_name_plural = "Videogame"

    ts_created = models.DateTimeField(auto_now_add=True)
    ts = models.DateTimeField(auto_now=True)
