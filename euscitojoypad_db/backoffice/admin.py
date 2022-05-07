from django.contrib import admin


from .models import Episodio, Videogame


@admin.register(Episodio)
class EpisodioAdmin(admin.ModelAdmin):
    pass


#@admin.register(Videogame)
#class VideogameAdmin(admin.ModelAdmin):
#    pass
