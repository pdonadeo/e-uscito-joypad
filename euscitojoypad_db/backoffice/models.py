import datetime
from http.client import ImproperConnectionState
import json
import urllib.request

from django import forms
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils.text import slugify

from django.conf import settings


class Videogame(models.Model):
    class Meta:
        verbose_name = "Videogame"
        verbose_name_plural = "Videogame"
        ordering = ["titolo"]

    ts_created = models.DateTimeField(auto_now_add=True)
    ts = models.DateTimeField(auto_now=True)
    titolo = models.CharField(
        verbose_name="Titolo", max_length=256, null=True, blank=True, help_text="NON COMPILARE MANUALMENTE"
    )
    descrizione_html = models.TextField(
        verbose_name="Descrizione (HTML)", null=True, blank=True, help_text="NON COMPILARE MANUALMENTE"
    )
    descrizione_raw = models.TextField(
        verbose_name="Descrizione (TXT)", null=True, blank=True, help_text="NON COMPILARE MANUALMENTE"
    )
    cover = models.URLField(verbose_name="Cover", null=True, blank=True, help_text="NON COMPILARE MANUALMENTE")
    rawg_slug = models.SlugField(
        max_length=256,
        null=False,
        blank=False,
        default=None,
        unique=True,
        verbose_name="RAWG slug",
        help_text="Campo obbligatorio, cerca il gioco su https://rawg.io/",
    )
    rawg_json = models.JSONField(null=True, blank=True, default=None, verbose_name="RAWG JSON data")

    def __str__(self):
        return f"{self.titolo}"


@receiver(pre_save, sender=Videogame)
def salva_dati_da_rawg(sender, instance, **kwargs):
    if instance.rawg_slug != None and instance.rawg_slug != "":
        if instance.rawg_json == None or instance.rawg_json == "":
            slug = instance.rawg_slug
            url = f"https://api.rawg.io/api/games/{slug}?key={settings.RAWG_API_KEY}"
            with urllib.request.urlopen(url) as f:
                data_j = f.read().decode("utf8")
                data = json.loads(data_j)

                instance.titolo = data["name"]
                instance.descrizione_html = data["description"]
                instance.descrizione_raw = data["description_raw"]
                instance.cover = data["background_image"]
                instance.rawg_json = data


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
    url = models.URLField(verbose_name="URL dell'episodio in formato audio", max_length=256, null=True, blank=True)
    url_post = models.URLField(
        verbose_name="URL del post che annuncia l'episodio", max_length=256, null=True, blank=True
    )
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
    giochi = models.ManyToManyField(
        Videogame,
        verbose_name="Titoli di videogiochi",
        related_name="episodi",
        blank=True,
        help_text="Titoli di cui si è parlato nell'episodio.",
        through="AssociazioneEpisodioVideogame",
    )

    def __str__(self):
        return f"Ep. {self.episodio_numero}, {self.titolo}"


class AssociazioneEpisodioVideogame(models.Model):
    class Meta:
        verbose_name = "associazione episodio/gioco"
        verbose_name_plural = "associazioni episodio/gioco"

    ts_created = models.DateTimeField(auto_now_add=True)
    ts = models.DateTimeField(auto_now=True)

    videogame = models.ForeignKey(Videogame, on_delete=models.CASCADE)
    episodio = models.ForeignKey(Episodio, on_delete=models.CASCADE)
    istante = models.DurationField(
        verbose_name="Istante citazione", null=True, blank=True, default=datetime.timedelta(minutes=0)
    )
    speaker = models.CharField(
        choices=[
            ("TUTT", "Tutti"),
            ("BORD", "Matteo Bordone (corri!)"),
            ("FOSS", "Francesco Fossetti (salta!)"),
            ("ZAMP", "Alessandro Zampini (spara!)"),
        ],
        verbose_name="Speaker",
        max_length=4,
        null=False,
        blank=False,
        default="TUTT",
    )
    tipologia = models.CharField(
        choices=[
            ("FREE", "Chiacchiera libera"),
            ("RECE", "Recensione"),
            ("CONS", "Consiglio"),
        ],
        verbose_name="Tipologia della citazione",
        max_length=4,
        null=False,
        blank=False,
        default="FREE",
    )

    def __str__(self):
        return f"Associazione ep. {self.episodio.episodio_numero} con «{self.videogame.titolo}»"
