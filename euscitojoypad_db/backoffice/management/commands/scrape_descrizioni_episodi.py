import os
import urllib

from bs4 import BeautifulSoup as bs

from django.core.management.base import BaseCommand
from backoffice.models import Episodio


def scrape(url):
    local_filename, headers = urllib.request.urlretrieve(url)
    html = open(local_filename).read()
    os.unlink(local_filename)
    soup = bs(html, "html.parser")
    content = soup.find("div", {"id": "singleBody"})

    for s in content.select("script"):
        s.extract()

    for s in content.select("amp-embed"):
        s.extract()

    for s in soup.find_all("div", attrs={"data-mp3": True}):
        s.extract()

    for s in soup.find_all("div", attrs={"class": "intelligence"}):
        s.extract()

    for s in soup.find_all("div", attrs={"class": "adv_inread"}):
        s.extract()

    # Primo paragrafo
    try:
        primo_p = content.find_all("p")[0]
        primo_testo = primo_p.getText()
        if primo_testo.strip().startswith("Joypad è il posto in cui Matteo Bordone"):

            primo_p.extract()
    except:
        print(f"Eccezione mentre scaricavo {url}")

    txt = content.getText(" ", strip=True).strip()
    html = str(content.prettify()).strip()
    return (txt, html)


class Command(BaseCommand):
    help = 'Scarica da "Il Post" le descrizioni degli episodi'

    def handle(self, *args, **options):
        for ep in Episodio.objects.all().order_by("-data_uscita"):
            if ep.descrizione_txt == None or ep.descrizione_txt.strip() == "":
                print(f"Scraping episodio {ep.episodio_numero}: «{ep.titolo}»… ", end="")
                txt, html = scrape(ep.url_post)
                ep.descrizione_txt = txt
                ep.descrizione_html = html
                ep.save()
                print("Fatto!")
        print("FATTO TUTTO!")
