from django.db import models


class Episodio(models.Model):
    class Meta:
        verbose_name = "Episodio"
        verbose_name_plural = "Episodi"

    ts_created = models.DateTimeField(auto_now_add=True)
    ts = models.DateTimeField(auto_now=True)


class Videogame(models.Model):
    class Meta:
        verbose_name = "Videogame"
        verbose_name_plural = "Videogame"

    ts_created = models.DateTimeField(auto_now_add=True)
    ts = models.DateTimeField(auto_now=True)
