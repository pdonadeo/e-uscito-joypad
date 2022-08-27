import django.contrib.postgres.indexes
from django.contrib.postgres.operations import TrigramExtension, UnaccentExtension, BtreeGinExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("backoffice", "0011_episodio_descrizione_html_episodio_descrizione_txt"),
    ]

    operations = [
        UnaccentExtension(),
        TrigramExtension(),
        BtreeGinExtension(),
        migrations.AddIndex(
            model_name="videogame",
            index=django.contrib.postgres.indexes.GinIndex(fields=["titolo"], name="backoffice__titolo_53ff7e_gin"),
        ),
    ]
