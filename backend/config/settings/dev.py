from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Relax password validation in dev
AUTH_PASSWORD_VALIDATORS = []

CORS_ALLOW_ALL_ORIGINS = True
