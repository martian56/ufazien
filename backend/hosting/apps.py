from django.apps import AppConfig
from django.conf import settings


class HostingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hosting'

    def ready(self):
        # Start the scheduler only when running the server (not during migrations/tests)
        if settings.DEBUG:
            try:
                from . import scheduler as hosting_scheduler
                from django_apscheduler.schedulers import DjangoScheduler

                scheduler = DjangoScheduler()
                hosting_scheduler.start_scheduler(scheduler)
                scheduler.start()
            except Exception:
                # avoid breaking migrations or other management commands
                pass
