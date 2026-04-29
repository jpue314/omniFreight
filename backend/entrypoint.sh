#!/bin/sh
set -e

echo "=== omniFreight startup ==="
echo "PORT=${PORT}"
echo "DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE}"

echo "--- Running migrations ---"
python manage.py migrate --no-input

echo "--- Starting gunicorn on 0.0.0.0:${PORT} ---"
exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT}" \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
