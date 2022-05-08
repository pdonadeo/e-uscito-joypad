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
    list_display = ("episodio_numero", "titolo", "data_uscita", "durata")
    ordering = ("-data_uscita",)
    search_fields = ("episodio_numero", "titolo")


# @admin.register(Videogame)
# class VideogameAdmin(admin.ModelAdmin):
#    pass
