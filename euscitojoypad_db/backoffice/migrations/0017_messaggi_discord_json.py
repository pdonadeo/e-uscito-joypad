from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("backoffice", "0016_modifica_messaggi_discord"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""TRUNCATE backoffice_discordmessage""",
            reverse_sql=""""""
        ),
        migrations.RemoveField(
            model_name="discordmessage",
            name="content",
        ),
        migrations.AddField(
            model_name="discordmessage",
            name="content",
            field=models.JSONField(default=dict, verbose_name="Discord message raw content"),
        ),
    ]
