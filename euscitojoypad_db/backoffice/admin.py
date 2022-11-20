from django import forms
from django.contrib import admin
from django.db import models

from django.utils.html import format_html

from django_json_widget.widgets import JSONEditorWidget


from .models import Episodio, Videogame, AssociazioneEpisodioVideogame, DiscordMessage


class EpisodioAdminForm(forms.ModelForm):
    def clean_cover(self):
        data = self.cleaned_data["cover"]
        if data is None or type(data) == bool or data.name.lower().endswith(".png"):
            return data
        else:
            raise forms.ValidationError("Il file deve essere un'immagine PNG")


class AssociazioneEpisodioVideogameInline(admin.TabularInline):
    model = AssociazioneEpisodioVideogame
    extra = 3
    ordering = ["episodio__data_uscita", "istante"]


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
    filter_horizontal = ("giochi",)
    ordering = ("-data_uscita",)
    search_fields = ("episodio_numero", "titolo")
    list_per_page = 20
    list_display_links = ("episodio_numero", "titolo")
    inlines = [AssociazioneEpisodioVideogameInline]

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


@admin.register(Videogame)
class VideogameAdmin(admin.ModelAdmin):
    list_display = ("titolo", "rawg_slug")
    search_fields = ("titolo", "descrizione_raw", "rawg_slug")
    fields = (
        "rawg_slug",
        "titolo",
        "descrizione_raw",
        "descrizione_html",
        "cover",
        "rawg_json",
    )
    formfield_overrides = {
        models.JSONField: {
            "widget": JSONEditorWidget(
                width="75%", height="400px", options={"mode": "view", "modes": ["view", "tree", "code"]}
            )
        },
    }

    inlines = [AssociazioneEpisodioVideogameInline]


@admin.register(DiscordMessage)
class DiscordMessageAdmin(admin.ModelAdmin):
    list_display = ("ts", "guild_id", "channel_id", "message_id", "author_name", "consiglio", "url_messaggio")
    search_fields = ("author_name", "content")
    list_filter = ("consiglio",)
    date_hierarchy = "ts"

    formfield_overrides = {
        models.JSONField: {
            "widget": JSONEditorWidget(
                width="75%", height="400px", options={"mode": "view", "modes": ["view", "tree", "code"]}
            )
        },
    }

    def url_messaggio(self, instance):
        url = f"https://discord.com/channels/{instance.guild_id}/{instance.channel_id}/{instance.message_id}"
        return format_html(f'<a target="_blank" href="{url}">Apri in Discord</a>')

    url_messaggio.boolean = False
    url_messaggio.short_description = "URL"
