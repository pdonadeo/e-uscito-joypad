# Generated by Django 4.0.4 on 2022-05-07 20:55

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('backoffice', '0001_initial'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Episodio',
        ),
        migrations.DeleteModel(
            name='Videogame',
        ),
    ]