from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("backoffice", "0013_episodio_pubblicato"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                UPDATE backoffice_episodio
                SET pubblicato = TRUE
                WHERE pubblicato = FALSE;
            """,
            reverse_sql="""
                UPDATE backoffice_episodio
                SET pubblicato = FALSE
                WHERE pubblicato = TRUE;
            """,
        )
    ]
