#!/bin/bash

set -e


if [[ -z "${DJANGO_SETTINGS_MODULE}" || ! -z "${SKIP_INIT}" ]]
then
    echo "DJANGO_SETTINGS_MODULE is not defined skip all entrypoint"
    exec "$@"
fi

echo ""
echo ""
echo "+-----------------------------------------------------------------------+"
echo "|                                                                       |"
echo "|               D O C K E R   E N T R Y   P O I N T                     |"
echo "|                                                                       |"
echo "+-----------------------------------------------------------------------+"

echo "Dockerentrypoint | Preflight | show startup environment"

echo "DJANGO_SUPERUSER_USERNAME:        $DJANGO_SUPERUSER_USERNAME"
echo "DJANGO_SUPERUSER_EMAIL:           $DJANGO_SUPERUSER_EMAIL"
echo "DJANGO_SUPERUSER_PASSWORD_BASE64: $DJANGO_SUPERUSER_PASSWORD"

echo "Dockerentrypoint | Django App --> START migrate"
/venv/bin/python manage.py migrate
echo "Dockerentrypoint | Django App -->   END migrate"

echo "Dockerentrypoint | Django App --> START collectstatic"
/venv/bin/python manage.py collectstatic --no-input
echo "Dockerentrypoint | Django App -->   END collectstatic"

echo "Dockerentrypoint | Django App --> chown -R joypad:joypad MEDIA/ STATIC/"
sudo chown -R joypad:joypad MEDIA/ STATIC/

echo "Dockerentrypoint | Django App --> Super User"

cat <<EOF | /venv/bin/python manage.py shell
from django.contrib.auth import get_user_model
import os

User = get_user_model()

django_superuser_username=os.environ['DJANGO_SUPERUSER_USERNAME']
django_superuser_password=os.environ['DJANGO_SUPERUSER_PASSWORD']


if User.objects.filter(username=django_superuser_username).exists():
    print(f"Django superuser {django_superuser_username} already exists, nothing to do")
else:
    print(f"Create Superuser: {django_superuser_username}")
    user=User.objects.create_user(django_superuser_username, password=django_superuser_password)
    user.is_superuser=True
    user.is_staff=True
    user.save()
EOF

echo "Dockerentrypoint | Django App --> END"
echo ""
echo ""
echo "#########################################################################"
echo ""
echo ""

exec "$@"
