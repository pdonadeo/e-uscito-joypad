from django import forms
from django.contrib import admin


from .models import Episodio  # , Videogame


class EpisodioAdminForm(forms.ModelForm):
    def clean_cover(self):
        data = self.cleaned_data["cover"]
        if data is None or type(data) == bool or data.name.lower().endswith(".png"):
            return data
        else:
            raise forms.ValidationError("Il file deve essere un'immagine PNG")


@admin.register(Episodio)
class EpisodioAdmin(admin.ModelAdmin):
    form = EpisodioAdminForm
    list_display = (
        "episodio_numero",
        "titolo",
        "data_uscita",
        "durata",
        "cover_presente",
        "url_audio",
        "url_post_ok",
        "url_video_ok",
    )
    ordering = ("-data_uscita",)
    search_fields = ("episodio_numero", "titolo")
    list_per_page = 20
    list_display_links = ("episodio_numero", "titolo")

    def cover_presente(self, instance):
        return instance.cover != None and instance.cover != ""

    cover_presente.boolean = True
    cover_presente.short_description = "Cover"

    def url_audio(self, instance):
        return instance.url != None and instance.url != ""

    url_audio.boolean = True
    url_audio.short_description = "URL audio"

    def url_post_ok(self, instance):
        return instance.url_post != None and instance.url_post != ""

    url_post_ok.boolean = True
    url_post_ok.short_description = "URL Post"

    def url_video_ok(self, instance):
        return instance.url_video != None and instance.url_video != ""

    url_video_ok.boolean = True
    url_video_ok.short_description = "URL video"


# @admin.register(Videogame)
# class VideogameAdmin(admin.ModelAdmin):
#    pass
