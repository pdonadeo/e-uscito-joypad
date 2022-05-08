from django.contrib import admin
from django.urls import path
from django.conf.urls.static import static

from django.conf import settings

urlpatterns = []

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


urlpatterns += [
    path("", admin.site.urls),
]
