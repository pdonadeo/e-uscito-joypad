from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("backoffice", "0015_discordmessage"),
    ]

    operations = [
        migrations.DeleteModel(
            name="DiscordMessage",
        ),
        migrations.CreateModel(
            name="DiscordMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("guild_id", models.CharField(max_length=32, verbose_name="ID del server Discord")),
                ("channel_id", models.CharField(max_length=32, verbose_name="ID del canale")),
                ("message_id", models.CharField(max_length=32, verbose_name="ID del messaggio")),
                ("ts", models.DateTimeField(verbose_name="Timestamp del messaggio")),
                ("author_avatar", models.URLField(max_length=256, verbose_name="URL avatar autore")),
                ("author_name", models.CharField(max_length=256, verbose_name="Nome autore")),
                ("content", models.TextField(verbose_name="Contenuto")),
                ("consiglio", models.BooleanField(default=False, verbose_name="È un consiglio")),
            ],
            options={
                "verbose_name": "messaggio Discord",
                "verbose_name_plural": "messaggi Discord",
                "ordering": ["-ts"],
            },
        ),
        migrations.AddConstraint(
            model_name="discordmessage",
            constraint=models.UniqueConstraint(
                fields=("guild_id", "channel_id", "message_id"), name="unique_discord_message"
            ),
        ),
    ]
