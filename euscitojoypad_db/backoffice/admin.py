from django.contrib import admin


from .models import Episodio, Videogame


@admin.register(Episodio)
class EpisodioAdmin(admin.ModelAdmin):
    list_display = ("episodio_numero", "titolo", "data_uscita", "durata")
    ordering = ("-data_uscita",)
    search_fields = ("episodio_numero", "titolo")


#@admin.register(Videogame)
#class VideogameAdmin(admin.ModelAdmin):
#    pass
