import datetime

from statistics import mode
from django import forms
from django.db import models
from django.utils.text import slugify


def user_directory_path(instance, filename):
    filename = filename.lower()
    if not filename.endswith(".png"):
        raise forms.ValidationError("Il file deve essere un'immagine PNG")
    fname = ".".join(filename.split(".")[:-1])  # remove extension
    fname = slugify(fname.lower())
    fname = f"covers/episodi-{instance.episodio_numero}-{fname}.png"
    return fname


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
    url = models.URLField(verbose_name="URL", max_length=256, null=True, blank=True)
    url_video = models.URLField(
        verbose_name="URL video",
        max_length=256,
        null=True,
        blank=True,
        help_text="URL al contenuto video dell'episodio. Opzionale.",
    )
    cover = models.ImageField(
        verbose_name="Cover",
        null=True,
        blank=True,
        upload_to=user_directory_path,
        help_text="""Cover dell'episodio. ATTENZIONE: l'immagine deve essere caricata in formato
                     PNG e dimensione 256x256px, non viene fatto il resize.""",
    )

    def __str__(self):
        return f"Ep. {self.episodio_numero}, {self.titolo}"


# class Videogame(models.Model):
#    class Meta:
#        verbose_name = "Videogame"
#        verbose_name_plural = "Videogame"
#
#    ts_created = models.DateTimeField(auto_now_add=True)
#    ts = models.DateTimeField(auto_now=True)
