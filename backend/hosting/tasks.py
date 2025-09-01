import os
import uuid
import json
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Database, ActivityLog
from .models import Website

# Lazy imports for DB drivers
def _import_psycopg2():
    try:
        import psycopg2
        from psycopg2 import sql
        return psycopg2, sql
    except Exception:
        return None, None

def _import_pymysql():
    try:
        import pymysql
        return pymysql
    except Exception:
        return None


def sanitize_identifier(name: str) -> str:
    # Simple sanitizer: allow letters, numbers, underscore
    return ''.join(c for c in name if c.isalnum() or c == '_')[:63]


def generate_password() -> str:
    return uuid.uuid4().hex


def _bytes_to_mb(b: int) -> int:
    return int(b / 1024 / 1024)


def _get_website_dir_size(path: str) -> int:
    """Return size in bytes of files under path."""
    total = 0
    for root, dirs, files in os.walk(path):
        for f in files:
            try:
                fp = os.path.join(root, f)
                if os.path.islink(fp):
                    continue
                total += os.path.getsize(fp)
            except Exception:
                continue
    return total


def _get_remote_postgres_db_size(admin_conf: dict, dbname: str) -> int:
    psycopg2, sql = _import_psycopg2()
    if not psycopg2:
        raise RuntimeError('psycopg2 not installed')

    conn = psycopg2.connect(host=admin_conf.get('host'), port=int(admin_conf.get('port', 5433)), user=admin_conf.get('user'), password=admin_conf.get('password'), dbname=admin_conf.get('monitor_db', 'postgres'))
    cur = conn.cursor()
    cur.execute('SELECT pg_database_size(%s);', (dbname,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return int(row[0] if row and row[0] is not None else 0)


def _get_remote_mysql_db_size(admin_conf: dict, dbname: str) -> int:
    pymysql = _import_pymysql()
    if not pymysql:
        raise RuntimeError('pymysql not installed')

    conn = pymysql.connect(host=admin_conf.get('host'), port=int(admin_conf.get('port', 3306)), user=admin_conf.get('user'), password=admin_conf.get('password'))
    cur = conn.cursor()
    cur.execute("SELECT SUM(data_length + index_length) FROM information_schema.tables WHERE table_schema = %s", (dbname,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return int(row[0] if row and row[0] is not None else 0)


@shared_task(bind=True, default_retry_delay=10, max_retries=3)
def provision_database(self, database_id: str):
    """Provision a remote database and user for the given Database model id.

    - For postgres: connect to postgres.ufazien.com on port 5433 (no SSL), create database and role, grant privileges.
    - For mysql: connect to mysql.ufazien.com on default port, create database and user, grant privileges.
    """
    try:
        db = Database.objects.get(id=database_id)
    except Database.DoesNotExist:
        return

    # Prepare names and credentials
    db_name = sanitize_identifier(db.name or f'db_{db.id.hex[:8]}')
    username = db.username or sanitize_identifier(f'user_{uuid.uuid4().hex[:8]}')
    password = db.password or generate_password()

    try:
        if db.db_type == 'postgresql':
            psycopg2, sql = _import_psycopg2()
            if not psycopg2:
                raise RuntimeError('psycopg2 not installed')

            admin_conf = getattr(settings, 'DB_ADMIN', {}).get('postgresql', {})
            admin_host = admin_conf.get('host', 'postgres.ufazien.com')
            admin_port = int(admin_conf.get('port', 5433))
            admin_user = admin_conf.get('user')
            admin_password = admin_conf.get('password')

            conn = psycopg2.connect(host=admin_host, port=admin_port, user=admin_user, password=admin_password)
            conn.autocommit = True
            cur = conn.cursor()

            # Use safe identifiers
            cur.execute(sql.SQL("CREATE DATABASE {};").format(sql.Identifier(db_name)))
            cur.execute(sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s;").format(sql.Identifier(username)), [password])
            cur.execute(sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {};").format(sql.Identifier(db_name), sql.Identifier(username)))

            cur.close()
            conn.close()

        else:
            # Assume mysql
            pymysql = _import_pymysql()
            if not pymysql:
                raise RuntimeError('pymysql not installed')

            admin_conf = getattr(settings, 'DB_ADMIN', {}).get('mysql', {})
            admin_host = admin_conf.get('host', 'mysql.ufazien.com')
            admin_port = int(admin_conf.get('port', 3306))
            admin_user = admin_conf.get('user')
            admin_password = admin_conf.get('password')

            conn = pymysql.connect(host=admin_host, port=admin_port, user=admin_user, password=admin_password, autocommit=True)
            cur = conn.cursor()

            cur.execute(f"CREATE DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            cur.execute("CREATE USER %s@'%%' IDENTIFIED BY %s;", (username, password))
            cur.execute(f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO %s@'%%' ;", (username,))
            cur.execute("FLUSH PRIVILEGES;")

            cur.close()
            conn.close()

        # Success: update model
        db.username = username
        db.password = password
        db.status = 'active'
        db.connection_info = {
            'host': db.host,
            'port': db.port,
            'database': db_name,
            'username': username,
        }
        db.error_message = ''
        db.updated_at = timezone.now()
        db.save()

        ActivityLog.objects.create(
            user=db.user,
            action='database_provisioned',
            description=f'Provisioned database {db_name}',
            metadata={'database_id': str(db.id)}
        )

    except Exception as exc:
        # Update the DB record with error
        db.status = 'error'
        db.error_message = str(exc)
        db.updated_at = timezone.now()
        db.save()

        ActivityLog.objects.create(
            user=db.user,
            action='database_provisioning_failed',
            description=f'Provisioning failed for {db.name}: {str(exc)}',
            metadata={'database_id': str(db.id), 'error': str(exc)}
        )

        # Retry for transient errors
        try:
            raise self.retry(exc=exc)
        except Exception:
            # final failure
            return


@shared_task(bind=True, default_retry_delay=10, max_retries=3)
def delete_provisioned_database(self, database_id: str):
    """Delete a provisioned remote database and user, then remove local record on success."""
    try:
        db = Database.objects.get(id=database_id)
    except Database.DoesNotExist:
        return

    db_name = sanitize_identifier(db.name or f'db_{db.id.hex[:8]}')
    username = db.username

    try:
        if db.db_type == 'postgresql':
            psycopg2, sql = _import_psycopg2()
            if not psycopg2:
                raise RuntimeError('psycopg2 not installed')

            admin_conf = getattr(settings, 'DB_ADMIN', {}).get('postgresql', {})
            admin_host = admin_conf.get('host', 'postgres.ufazien.com')
            admin_port = int(admin_conf.get('port', 5433))
            admin_user = admin_conf.get('user')
            admin_password = admin_conf.get('password')

            conn = psycopg2.connect(host=admin_host, port=admin_port, user=admin_user, password=admin_password)
            conn.autocommit = True
            cur = conn.cursor()

            # Drop database and role safely
            cur.execute(sql.SQL("DROP DATABASE IF EXISTS {};").format(sql.Identifier(db_name)))
            if username:
                cur.execute(sql.SQL("DROP ROLE IF EXISTS {};").format(sql.Identifier(username)))

            cur.close()
            conn.close()

        else:
            pymysql = _import_pymysql()
            if not pymysql:
                raise RuntimeError('pymysql not installed')

            admin_conf = getattr(settings, 'DB_ADMIN', {}).get('mysql', {})
            admin_host = admin_conf.get('host', 'mysql.ufazien.com')
            admin_port = int(admin_conf.get('port', 3306))
            admin_user = admin_conf.get('user')
            admin_password = admin_conf.get('password')

            conn = pymysql.connect(host=admin_host, port=admin_port, user=admin_user, password=admin_password, autocommit=True)
            cur = conn.cursor()

            cur.execute(f"DROP DATABASE IF EXISTS `{db_name}`;")
            if username:
                try:
                    cur.execute("DROP USER %s@'%%';", (username,))
                except Exception:
                    # Some MySQL instance may require different host spec; try using '%' silently
                    pass
            cur.execute("FLUSH PRIVILEGES;")

            cur.close()
            conn.close()

        # Log and remove local record
        ActivityLog.objects.create(
            user=db.user,
            action='database_deleted_remote',
            description=f'Remote database {db_name} deleted',
            metadata={'database_id': str(db.id)}
        )

        # Remove local model instance
        db.delete()

    except Exception as exc:
        # Mark error on DB record and log
        db.status = 'error'
        db.error_message = str(exc)
        db.updated_at = timezone.now()
        db.save()

        ActivityLog.objects.create(
            user=db.user,
            action='database_deletion_failed',
            description=f'Failed to delete remote database {db.name}: {str(exc)}',
            metadata={'database_id': str(db.id), 'error': str(exc)}
        )

        try:
            raise self.retry(exc=exc)
        except Exception:
            return


@shared_task(bind=True)
def compute_storage_for_user(self, user_id: int):
    """Compute website file storage and remote DB sizes for a single user and update models."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    total_storage_mb = 0

    # Websites: compute directory sizes and update Website.storage_used_mb
    for website in Website.objects.filter(user=user):
        try:
            if website.domain and website.domain.name:
                subdomain = website.domain.name.split('.')[0]
            else:
                subdomain = website.name

            website_dir = f"/srv/hosting/{subdomain}"
            if os.path.exists(website_dir):
                bytes_size = _get_website_dir_size(website_dir)
                mb = _bytes_to_mb(bytes_size)
            else:
                mb = 0

            website.storage_used_mb = mb
            website.save(update_fields=['storage_used_mb', 'updated_at'])
            total_storage_mb += mb
        except Exception as exc:
            ActivityLog.objects.create(user=user, action='storage_compute_failed', description=f'Failed to compute website size for {website.name}: {str(exc)}', metadata={'website': website.name})

    # Databases: query remote admin for DB sizes and update Database.size_mb
    for db in Database.objects.filter(user=user):
        try:
            db_name = sanitize_identifier(db.name)
            admin_conf = getattr(settings, 'DB_ADMIN', {}).get(db.db_type, {})
            if db.db_type == 'postgresql':
                size_bytes = _get_remote_postgres_db_size(admin_conf, db_name)
            else:
                size_bytes = _get_remote_mysql_db_size(admin_conf, db_name)

            mb = _bytes_to_mb(size_bytes)
            db.size_mb = mb
            db.save(update_fields=['size_mb', 'updated_at'])
            total_storage_mb += mb
        except Exception as exc:
            ActivityLog.objects.create(user=user, action='storage_compute_failed', description=f'Failed to compute db size for {db.name}: {str(exc)}', metadata={'database': db.name})

    # Optionally log the total
    ActivityLog.objects.create(user=user, action='storage_computed', description=f'Computed storage: {total_storage_mb} MB', metadata={'total_storage_mb': total_storage_mb})
    return total_storage_mb


@shared_task(bind=True)
def compute_storage_for_all_users(self):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    for user in User.objects.all():
        try:
            # call as a Celery task for each user
            compute_storage_for_user.delay(user.id)
        except Exception:
            continue
