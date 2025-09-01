from django_apscheduler.jobstores import DjangoJobStore
from apscheduler.triggers.interval import IntervalTrigger
from django_apscheduler.models import DjangoJobExecution
from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)


def compute_storage_job():
    """Wrapper that calls the management command to compute storage."""
    try:
        call_command('compute_storage')
    except Exception as exc:
        logger.exception('compute_storage job failed: %s', exc)


def start_scheduler(scheduler):
    """Register job store and jobs."""
    scheduler.add_jobstore(DjangoJobStore(), 'default')

    # remove old job executions (optional cleanup)
    DjangoJobExecution.objects.delete_old_job_executions(7)

    # schedule compute_storage every 10 minutes
    scheduler.add_job(
        compute_storage_job,
        trigger=IntervalTrigger(minutes=10),
        id='compute_storage_every_10m',
        replace_existing=True,
        max_instances=1,
    )

    logger.info('Scheduler started: compute_storage_every_10m')
