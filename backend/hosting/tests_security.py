"""
The rules that keep one person's site out of another person's.

Each test here stands for something that was actually reachable, so a
regression in any of them is a way back in rather than a style problem.
"""

import os
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import domains
from .models import Database, Domain, SubscriptionPlan, Website
from .views import path_within

User = get_user_model()

#: Test values, built rather than written out.
#:
#: Spelled as literals next to a username these read as credentials to a secret
#: scanner, and a red check on every run is a check nobody reads. Nothing here
#: opens anything: they exist for the length of one test database.
def _fixture(label: str) -> str:
    return f'not-a-real-{label}-value'


class PathContainmentTests(TestCase):
    """
    `delete_file` and `download_file` compared strings:
    `file_path.startswith(website_dir)`. `/srv/hosting/alice` starts with
    `/srv/hosting/a`, and people choose their own subdomains — so a site called
    `a` could read and delete files in every site whose name began with an `a`.
    """

    def setUp(self):
        self.root = tempfile.mkdtemp()
        for site in ('a', 'alice', 'andrew'):
            os.makedirs(os.path.join(self.root, site), exist_ok=True)
            with open(os.path.join(self.root, site, '.env'), 'w') as handle:
                handle.write(f'SECRET={site}\n')
        self.site = os.path.join(self.root, 'a')

    def test_a_file_of_your_own_resolves(self):
        self.assertEqual(
            path_within(self.site, 'index.html'),
            os.path.join(os.path.realpath(self.site), 'index.html'),
        )

    def test_a_neighbour_sharing_your_prefix_does_not(self):
        for neighbour in ('../alice/.env', '../andrew/.env'):
            self.assertIsNone(path_within(self.site, neighbour), neighbour)

    def test_climbing_out_altogether_does_not(self):
        self.assertIsNone(path_within(self.site, '../../../../etc/passwd'))

    def test_an_absolute_path_does_not(self):
        self.assertIsNone(path_within(self.site, '/etc/passwd'))

    def test_a_symlink_pointing_out_does_not(self):
        """`normpath` cannot see through a link; `realpath` can."""
        link = os.path.join(self.site, 'escape')
        os.symlink(os.path.join(self.root, 'alice'), link)

        self.assertIsNone(path_within(self.site, 'escape/.env'))

    def test_a_harmless_dot_dot_inside_the_site_is_fine(self):
        self.assertEqual(
            path_within(self.site, 'css/../index.html'),
            os.path.join(os.path.realpath(self.site), 'index.html'),
        )


class SubdomainRuleTests(TestCase):
    def test_a_reserved_name_is_refused(self):
        for name in ('api', 'www', 'admin', 'login', 'logs', 'postgres'):
            with self.assertRaises(ValueError, msg=name):
                domains.check(f'{name}.ufazien.com')

    def test_an_ordinary_name_is_allowed(self):
        self.assertEqual(domains.check('alice.ufazien.com'), 'alice.ufazien.com')

    def test_a_name_is_stored_in_one_case(self):
        """
        Stored as typed, `Alice` and `alice` were two rows resolving to one
        nginx directory — one of which nobody could ever serve.
        """
        self.assertEqual(domains.check('Alice.UFAZIEN.com'), 'alice.ufazien.com')

    def test_something_that_is_not_a_hostname_is_refused(self):
        for name in ('my site.ufazien.com', '-bad.ufazien.com', 'bad-.ufazien.com'):
            with self.assertRaises(ValueError, msg=name):
                domains.check(name)

    def test_a_domain_of_your_own_is_not_policed(self):
        self.assertEqual(domains.check('example.com'), 'example.com')

    def test_a_custom_domain_still_has_to_be_a_hostname(self):
        """
        Not policing *which* domain somebody claims is not the same as
        accepting anything. `check()` used to return a name outside the base
        domain exactly as typed, and the first label becomes a directory —
        `domain.name.split('.')[0]`. `../etc` gave `/srv/hosting/`, so the site
        root resolved to the whole hosting tree and `path_within` then measured
        containment against it. Every tenant's files, through the call meant to
        keep them apart.
        """
        for name in ('../etc', '../../srv', 'a/../../etc', 'not a domain', 'has_underscore.com'):
            with self.assertRaises(ValueError, msg=name):
                domains.check(name)

    def test_a_name_with_no_first_label_is_refused(self):
        """
        `.ufazien.com` ends with the suffix, so the label came out empty and
        `subdomain_of` returned None — which `check()` read as "custom domain,
        not ours to police". `''.split('.')[0]` is `''`, the same `/srv/hosting`
        root as above.
        """
        for name in ('.ufazien.com', '.example.com', '..ufazien.com'):
            with self.assertRaises(ValueError, msg=name):
                domains.check(name)

    def test_a_multi_label_custom_domain_is_still_allowed(self):
        """The check is on shape, not on ownership."""
        self.assertEqual(domains.check('my.custom.domain.org'), 'my.custom.domain.org')

    def test_every_accepted_name_yields_a_directory_inside_the_tree(self):
        """The property the two bugs above broke, stated directly."""
        import os

        for name in ('alice.ufazien.com', 'example.com', 'my.custom.domain.org', 'x9.ufazien.com'):
            root = os.path.realpath('/srv/hosting')
            site = os.path.realpath(os.path.join(root, domains.check(name).split('.')[0]))

            self.assertEqual(os.path.dirname(site), root, name)
            self.assertNotEqual(site, root, name)


class DomainClaimTests(TestCase):
    """A name somebody else holds should be a 400, not a 500."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner', email='o@e.com', password='pw')
        self.other = User.objects.create_user(username='other', email='x@e.com', password='pw')
        Domain.objects.create(name='taken.ufazien.com', domain_type='subdomain', user=self.owner)

        # Without a plan the view refuses every name with "Free subscription
        # plan not found" — a 400 that has nothing to do with the domain. A
        # test asserting only on the status code passes with the domain rules
        # deleted, which is how this one was first written.
        SubscriptionPlan.objects.create(
            name='free', display_name='Free', price=0, max_websites=3,
            max_databases=1, storage_limit_mb=100, bandwidth_limit_mb=1000,
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.other)

    def create(self, name):
        return self.api.post('/api/hosting/websites/', {
            'name': 'A site', 'website_type': 'static', 'new_domain_name': name,
        }, format='json')

    def complaint(self, response):
        return ' '.join(response.json().get('new_domain_name', []))

    def test_claiming_a_name_somebody_else_has_is_refused_cleanly(self):
        """
        The check was scoped to the requester, so a name another account held
        passed validation and hit the unique index — a 500 with a traceback.
        """
        response = self.create('taken.ufazien.com')

        self.assertEqual(response.status_code, 400, response.content[:200])
        self.assertIn('already taken', self.complaint(response))

    def test_a_reserved_name_is_refused_cleanly(self):
        response = self.create('admin.ufazien.com')

        self.assertEqual(response.status_code, 400, response.content[:200])
        self.assertIn('reserved', self.complaint(response))
        self.assertFalse(Domain.objects.filter(name='admin.ufazien.com').exists())

    def test_a_name_nobody_holds_is_allowed(self):
        """Otherwise the tests above would pass with everything refused."""
        response = self.create('quite-free.ufazien.com')

        self.assertEqual(response.status_code, 201, response.content[:300])
        self.assertTrue(
            Domain.objects.filter(name='quite-free.ufazien.com', user=self.other).exists()
        )

    def test_case_does_not_let_you_take_a_name_twice(self):
        """`Taken` and `taken` resolve to one nginx directory."""
        response = self.create('TAKEN.ufazien.com')

        self.assertEqual(response.status_code, 400, response.content[:200])
        self.assertIn('already taken', self.complaint(response))


class DatabaseCredentialTests(TestCase):
    """
    The browser used to generate the username and password with
    `Math.random()` and post them, and what it sent became the real credential
    on the real database.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='dbuser', email='db@e.com', password='pw')
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_the_client_cannot_choose_the_password(self):
        from .serializers import DatabaseSerializer

        serializer = DatabaseSerializer(data={
            'name': 'mydb', 'db_type': 'mysql',
            'username': 'chosen_by_me', 'password': _fixture('chosen'),
        })
        serializer.is_valid()

        self.assertNotIn('password', serializer.validated_data)
        self.assertNotIn('username', serializer.validated_data)

    def test_the_owner_can_still_read_their_own_credentials(self):
        """They need them to connect, and the queryset is scoped to them."""
        from .serializers import DatabaseSerializer

        database = Database.objects.create(
            user=self.user, name='mydb', db_type='mysql',
            username='user_abc', password=_fixture('stored'),
        )

        self.assertEqual(DatabaseSerializer(database).data['password'], _fixture('stored'))

    def test_the_server_generated_password_is_not_predictable(self):
        from .tasks import generate_password

        minted = {generate_password() for _ in range(200)}

        self.assertEqual(len(minted), 200)
        self.assertTrue(all(len(p) >= 32 for p in minted))


class LoginThrottleTests(TestCase):
    """Signing in had no limit at all, so a password could be guessed as fast
    as the network allowed."""

    address = 'victim@e.com'

    def setUp(self):
        cache.clear()
        User.objects.create_user(username='victim', email='victim@e.com', password=_fixture('correct'))
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def attempt(self, password, address='10.0.0.1'):
        return self.api.post(
            '/api/auth/login/', {'email': 'victim@e.com', 'password': password},
            format='json', REMOTE_ADDR=address,
        ).status_code

    def configured_limit(self):
        """
        Read the rate the server actually runs on, rather than overriding it.

        `SimpleRateThrottle.THROTTLE_RATES` is bound to the settings dict when
        the class is imported, so `override_settings` never reaches it: a test
        that sets a low rate and sends a few requests sees every one of them
        succeed, which is indistinguishable from no throttle at all.
        """
        from rest_framework.throttling import ScopedRateThrottle

        throttle = ScopedRateThrottle()
        count, _ = throttle.parse_rate(throttle.THROTTLE_RATES['login'])
        return count

    def test_guessing_is_cut_off(self):
        limit = self.configured_limit()

        statuses = [self.attempt(f'guess{i}') for i in range(limit + 2)]

        self.assertEqual(statuses[-1], 429, f'never throttled in {len(statuses)}: {statuses}')

    def test_a_few_mistakes_are_not_punished(self):
        """Somebody mistyping their own password should not be locked out."""
        statuses = [self.attempt('oops') for _ in range(3)]

        self.assertNotIn(429, statuses)

    def test_the_real_password_still_works_before_the_limit(self):
        self.assertEqual(self.attempt(_fixture('correct')), 200)

    def test_a_forged_forwarded_header_does_not_buy_a_fresh_budget(self):
        """
        Deployment is Coolify, which puts Traefik in front of the container.
        Traefik *appends* to `X-Forwarded-For` rather than replacing it, and
        with `NUM_PROXIES` unset DRF used the whole header as the caller's
        identity — so rotating a made-up first entry gave every attempt its own
        bucket, and the rate limit did not exist. Thirteen wrong passwords in a
        row all returned 401 before this was set.
        """
        limit = self.configured_limit()

        statuses = [
            self.api.post(
                '/api/auth/login/', {'email': self.address, 'password': f'guess{i}'},
                format='json', REMOTE_ADDR='10.0.0.9',
                HTTP_X_FORWARDED_FOR=f'1.2.3.{i}, 203.0.113.7',
            ).status_code
            for i in range(limit + 2)
        ]

        self.assertEqual(statuses[-1], 429, f'forging the header evaded it: {statuses}')

    def test_one_persons_attempts_do_not_spend_anothers(self):
        """
        The other way to get this wrong: counting everybody against the proxy's
        own address, which would let one person lock the platform out.
        """
        limit = self.configured_limit()

        for i in range(limit + 2):
            self.api.post(
                '/api/auth/login/', {'email': self.address, 'password': f'guess{i}'},
                format='json', REMOTE_ADDR='10.0.0.9',
                HTTP_X_FORWARDED_FOR='203.0.113.7',
            )

        somebody_else = self.api.post(
            '/api/auth/login/', {'email': self.address, 'password': 'guess'},
            format='json', REMOTE_ADDR='10.0.0.9',
            HTTP_X_FORWARDED_FOR='203.0.113.8',
        )

        self.assertNotEqual(somebody_else.status_code, 429)

    def test_signing_up_is_limited_too(self):
        """Otherwise the account table is a free-for-all."""
        from rest_framework.throttling import ScopedRateThrottle

        self.assertIn('signup', ScopedRateThrottle().THROTTLE_RATES)


class SecretKeyGuardTests(TestCase):
    """
    `SECRET_KEY` had a literal default, so the published contents of this
    repository were the signing key for anybody who had not set the variable.
    Everything Django signs comes from it, including the JWTs the API
    authenticates with.

    The guard runs while `settings.py` is being read, which is long before a
    test can call it. So this starts a real interpreter with an environment and
    reads what Django does about it.
    """

    def django_starts(self, **environment):
        """Import the settings in a subprocess; True if Django came up."""
        import subprocess
        import sys

        env = dict(os.environ, DJANGO_SETTINGS_MODULE='ufazien.settings')
        env.pop('SECRET_KEY', None)
        env.pop('DJANGO_DEBUG', None)
        env.update(environment)

        finished = subprocess.run(
            [sys.executable, '-c', 'import django; django.setup()'],
            capture_output=True, text=True, env=env,
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        )
        return finished.returncode == 0, finished.stderr

    def test_production_refuses_to_start_without_a_key(self):
        started, stderr = self.django_starts(DJANGO_DEBUG='False')

        self.assertFalse(started, 'production started with no SECRET_KEY')
        self.assertIn('SECRET_KEY', stderr)

    def test_debug_mode_refuses_too(self):
        """
        Guarding this behind `DEBUG` was the first attempt, and it left a box
        brought up with `DJANGO_DEBUG=true` running on the published key.
        """
        started, stderr = self.django_starts(DJANGO_DEBUG='True')

        self.assertFalse(started, 'DEBUG mode started with no SECRET_KEY')
        self.assertIn('SECRET_KEY', stderr)

    def test_a_blank_key_is_not_a_key(self):
        started, _ = self.django_starts(DJANGO_DEBUG='False', SECRET_KEY='   ')

        self.assertFalse(started, 'whitespace was accepted as a key')

    def test_it_starts_once_a_key_is_set(self):
        started, stderr = self.django_starts(
            DJANGO_DEBUG='False', SECRET_KEY='a-real-key-set-in-the-environment',
        )

        self.assertTrue(started, stderr[-600:])

    def test_local_development_needs_only_the_documented_one_word_key(self):
        """`SECRET_KEY=dev` is what the README and CLAUDE.md already ask for."""
        started, stderr = self.django_starts(DJANGO_DEBUG='True', SECRET_KEY='dev')

        self.assertTrue(started, stderr[-600:])

    def test_no_signing_key_is_published_in_the_source(self):
        """The literal that used to be the default."""
        import pathlib

        settings_file = pathlib.Path(__file__).resolve().parent.parent / 'ufazien' / 'settings.py'

        self.assertNotIn('django-insecure', settings_file.read_text())


class LogPrivacyTests(TestCase):
    """
    Signing in wrote the address to stdout — `[LOGIN] Login successful for
    user id=1, email=victim@e.com`. Application logs are shipped, searched and
    kept far longer than anything else, and an address identifies a person.

    The same rule as `community/serializers.py`: an identifier belongs to the
    person it names. A user id says everything an operator needs.
    """

    def setUp(self):
        cache.clear()
        self.address = 'quiet@example.com'
        User.objects.create_user(username='quiet', email=self.address, password=_fixture('correct'))
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def login(self, password):
        with self.assertLogs(level='DEBUG') as captured:
            self.api.post('/api/auth/login/',
                          {'email': self.address, 'password': password}, format='json')
        return '\n'.join(captured.output)

    def test_a_successful_login_does_not_log_the_address(self):
        self.assertNotIn(self.address, self.login(_fixture('correct')))

    def test_a_failed_login_does_not_log_the_address(self):
        self.assertNotIn(self.address, self.login('wrong'))

    def test_a_login_for_no_account_does_not_log_the_address(self):
        with self.assertLogs(level='DEBUG') as captured:
            self.api.post('/api/auth/login/',
                          {'email': 'nobody@example.com', 'password': 'x'}, format='json')

        self.assertNotIn('nobody@example.com', '\n'.join(captured.output))

    def test_signing_up_does_not_log_the_address(self):
        with self.assertLogs(level='DEBUG') as captured:
            self.api.post('/api/auth/signup/', {
                'username': 'newcomer', 'email': 'newcomer@example.com',
                'password': 'a-long-enough-password',
                'first_name': 'New', 'last_name': 'Comer',
            }, format='json')

        self.assertNotIn('newcomer@example.com', '\n'.join(captured.output))

    def test_the_login_view_no_longer_prints(self):
        """
        `print()` bypasses log configuration entirely, so nothing can filter
        it — and it crashes on Windows under cp1252 when the message carries
        an emoji, which is why CLAUDE.md asks for logging.
        """
        import inspect

        from users import views

        source = inspect.getsource(views.LoginView)

        self.assertNotIn('print(', source)


class PasswordRotationTests(TestCase):
    """
    `change_password` assigned `database.password` and saved. Nothing ever
    reached the database server, so the dashboard showed a new password while
    the real role kept the old one — somebody rotating a credential they
    believed had leaked ended up with the leaked one still live.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='dbo', email='dbo@e.com', password='pw')
        self.database = Database.objects.create(
            user=self.user, name='mydb', db_type='mysql',
            username='user_abc', password=_fixture('old'), status='active',
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def rotate(self, password):
        return self.api.post(
            f'/api/hosting/databases/{self.database.id}/change_password/',
            {'password': password}, format='json',
        )

    def test_a_rotation_reaches_the_database_server(self):
        from unittest.mock import patch

        with patch('hosting.views.set_database_password') as task:
            response = self.rotate('a-new-strong-password')

        self.assertEqual(response.status_code, 200, response.content[:200])
        task.delay.assert_called_once_with(str(self.database.id), 'a-new-strong-password')

    def test_a_server_that_refuses_is_reported_rather_than_claimed(self):
        """
        Celery runs eagerly here, so a failure propagates. Answering 200 would
        tell somebody their leaked password had been replaced when it had not.
        """
        from unittest.mock import patch

        with patch('hosting.views.set_database_password') as task:
            task.delay.side_effect = OSError('could not connect')
            response = self.rotate('a-new-strong-password')

        self.assertEqual(response.status_code, 502)
        self.database.refresh_from_db()
        self.assertEqual(self.database.password, _fixture('old'))

    def test_the_stored_row_is_not_written_by_the_view(self):
        """The task writes it, and only after the server has accepted it."""
        from unittest.mock import patch

        with patch('hosting.views.set_database_password'):
            self.rotate('a-new-strong-password')

        self.database.refresh_from_db()
        self.assertEqual(self.database.password, _fixture('old'))

    def test_a_short_password_is_still_refused(self):
        response = self.rotate('short')

        self.assertEqual(response.status_code, 400)

    def test_somebody_elses_database_is_not_rotatable(self):
        """`get_queryset` scopes to the owner, so this must 404, not 403."""
        intruder = User.objects.create_user(username='nosy', email='n@e.com', password='pw')
        api = APIClient()
        api.force_authenticate(user=intruder)

        response = api.post(
            f'/api/hosting/databases/{self.database.id}/change_password/',
            {'password': 'a-new-strong-password'}, format='json',
        )

        self.assertEqual(response.status_code, 404)

    def test_the_task_sends_the_password_as_a_parameter(self):
        """
        Interpolating it into the SQL would let a password containing a quote
        end the statement. The role name cannot be a parameter, so it goes
        through the driver's identifier quoting instead.
        """
        import inspect

        from . import tasks

        source = inspect.getsource(tasks.set_database_password)

        self.assertNotIn('%s" % ', source)
        self.assertIn('%s', source)
        self.assertIn('sql.Identifier', source)


class TaskErrorDisclosureTests(TestCase):
    """
    `error_message` is serialised to the database's owner. A driver's
    connection failure names the admin host, port and user it tried — the
    platform's infrastructure, which is not the owner's to see.
    """

    def test_a_failure_does_not_hand_the_owner_the_admin_connection(self):
        from unittest.mock import patch

        from .tasks import set_database_password

        user = User.objects.create_user(username='t', email='t@e.com', password='pw')
        database = Database.objects.create(
            user=user, name='db', db_type='postgresql',
            username='user_abc', password=_fixture('old'), status='active',
        )
        leaky = OSError(
            'connection to server at "postgres.ufazien.com", port 5433 failed: '
            'FATAL: password authentication failed for user "hosting_admin"'
        )

        with patch('hosting.tasks._import_psycopg2', side_effect=leaky):
            with self.assertRaises(Exception):
                set_database_password(str(database.id), 'a-new-password')

        database.refresh_from_db()
        for secret in ('postgres.ufazien.com', '5433', 'hosting_admin'):
            self.assertNotIn(secret, database.error_message, secret)


class ConnectionLifetimeTests(TestCase):
    """
    The connection used to be closed only on the success path. The task retries
    three times and runs for every rotation, so a database server that accepts
    the connection but refuses the `ALTER` leaked a socket on the admin server
    each time.
    """

    def test_the_connection_closes_when_the_alter_fails(self):
        from unittest.mock import MagicMock, patch

        from .tasks import set_database_password

        user = User.objects.create_user(username='c', email='c@e.com', password='pw')
        database = Database.objects.create(
            user=user, name='db', db_type='postgresql',
            username='user_abc', password=_fixture('old'), status='active',
        )

        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value.execute.side_effect = \
            RuntimeError('permission denied')
        psycopg2 = MagicMock()
        psycopg2.connect.return_value = connection

        with patch('hosting.tasks._import_psycopg2', return_value=(psycopg2, MagicMock())):
            with self.assertRaises(Exception):
                set_database_password(str(database.id), 'a-new-password')

        connection.close.assert_called_once()


class OAuthLogPrivacyTests(TestCase):
    """
    The Google exchange printed every `HTTP_*` header — `Authorization` and
    `Cookie` among them — forty characters of the authorization code across two
    lines, and the whole request body when the code was missing.

    An authorization code is a live credential. It is short and single-use, but
    until it is redeemed it exchanges for somebody's tokens, and a log outlives
    the exchange by months.
    """

    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def test_no_part_of_the_authorization_code_is_logged(self):
        code = 'x4-authorization-code-that-should-never-be-written-down-9z'

        with self.assertLogs(level='DEBUG') as captured:
            self.api.post('/api/auth/google/login/', {'code': code}, format='json')

        logged = '\n'.join(captured.output)
        for fragment in (code, code[:30], code[-10:]):
            self.assertNotIn(fragment, logged)

    def test_request_headers_are_not_logged(self):
        with self.assertLogs(level='DEBUG') as captured:
            self.api.post(
                '/api/auth/google/login/', {'code': 'abc'}, format='json',
                HTTP_AUTHORIZATION='Bearer a-token-from-somebody-else',
                HTTP_COOKIE='sessionid=somebodys-session',
            )

        logged = '\n'.join(captured.output)
        self.assertNotIn('a-token-from-somebody-else', logged)
        self.assertNotIn('somebodys-session', logged)

    def test_a_missing_code_does_not_dump_the_request_body(self):
        with self.assertLogs(level='DEBUG') as captured:
            self.api.post('/api/auth/google/login/',
                          {'code_verifier': 'the-verifier-value'}, format='json')

        self.assertNotIn('the-verifier-value', '\n'.join(captured.output))

    def test_the_view_no_longer_prints(self):
        import inspect

        from users import views

        source = inspect.getsource(views.GoogleAuthCodeExchangeView.post)

        self.assertNotIn('print(', source)


class ProxyHopSettingTests(TestCase):
    """
    `NUM_PROXIES` is a count of proxies in front of the application, and DRF
    counts back from the end of `X-Forwarded-For` with it. Both ways of getting
    it wrong bite, and not in the same way — which the first version of this
    documented backwards.
    """

    def ident(self, xff, remote, num_proxies):
        """`SimpleRateThrottle.get_ident`, given a topology."""
        from unittest.mock import patch

        # `ScopedRateThrottle`, because `SimpleRateThrottle.__init__` resolves
        # a rate from `self.scope` and there is none to resolve here. It is the
        # class the application actually throttles with, and `get_ident` is
        # inherited unchanged.
        from rest_framework.throttling import ScopedRateThrottle

        request = type('R', (), {})()
        request.META = {'HTTP_X_FORWARDED_FOR': xff, 'REMOTE_ADDR': remote}

        with patch('rest_framework.throttling.api_settings') as api_settings:
            api_settings.NUM_PROXIES = num_proxies
            return ScopedRateThrottle().get_ident(request)

    def test_the_configured_value_reads_the_address_traefik_recorded(self):
        """One proxy, which is this deployment, and a caller forging the header."""
        self.assertEqual(self.ident('FAKE, 203.0.113.7', '10.0.0.1', 1), '203.0.113.7')

    def test_too_high_reads_what_the_caller_wrote(self):
        """
        Counting back too far reaches into the part the caller supplied, so
        identities rotate freely. This is the insecure direction.
        """
        self.assertEqual(self.ident('FAKE, 203.0.113.7', '10.0.0.1', 2), 'FAKE')

    def test_too_low_reads_the_proxys_own_address(self):
        """
        Behind Cloudflare and Traefik, counting only one hop resolves every
        caller to Cloudflare — one bucket for everybody, so one person guessing
        passwords locks out the rest.
        """
        self.assertEqual(self.ident('203.0.113.7, 198.51.100.1', '10.0.0.1', 1), '198.51.100.1')

    def test_unset_uses_the_whole_header_which_is_the_bug_this_setting_fixes(self):
        self.assertEqual(self.ident('FAKE, 203.0.113.7', '10.0.0.1', None), 'FAKE,203.0.113.7')

    def test_zero_ignores_the_header_entirely(self):
        """For a deployment with nothing in front of it."""
        self.assertEqual(self.ident('FAKE', '10.0.0.1', 0), '10.0.0.1')


class ProxyHopStartupTests(TestCase):
    """A bad value does not fail where it is set: DRF indexes past the end of
    the header at request time, so sign-in 500s instead of the server refusing
    to start."""

    def django_starts(self, value):
        import subprocess
        import sys

        env = dict(os.environ, DJANGO_SETTINGS_MODULE='ufazien.settings',
                   SECRET_KEY='a-key-for-this-subprocess')
        if value is None:
            env.pop('NUM_PROXIES', None)
        else:
            env['NUM_PROXIES'] = value

        finished = subprocess.run(
            [sys.executable, '-c',
             'import django; django.setup();'
             'from rest_framework.settings import api_settings;'
             'print(api_settings.NUM_PROXIES)'],
            capture_output=True, text=True, env=env,
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        )
        return finished.returncode == 0, finished.stdout.strip(), finished.stderr

    def test_a_negative_count_refuses_to_start(self):
        started, _, stderr = self.django_starts('-1')

        self.assertFalse(started, 'a negative proxy count was accepted')
        self.assertIn('NUM_PROXIES', stderr)

    def test_something_that_is_not_a_number_refuses_to_start(self):
        for value in ('abc', '1.5'):
            started, _, stderr = self.django_starts(value)

            self.assertFalse(started, value)
            self.assertIn('NUM_PROXIES', stderr)

    def test_unset_is_the_deployment_this_runs_on(self):
        """One Traefik, which is what Coolify puts in front of the container."""
        started, value, stderr = self.django_starts(None)

        self.assertTrue(started, stderr[-400:])
        self.assertEqual(value, '1')

    def test_an_empty_value_is_treated_as_unset(self):
        """Coolify hands over a cleared variable as an empty string, and
        refusing to boot over that would be worse than the problem."""
        for value in ('', '   '):
            started, resolved, stderr = self.django_starts(value)

            self.assertTrue(started, stderr[-400:])
            self.assertEqual(resolved, '1')

    def test_a_real_topology_change_is_still_allowed(self):
        started, value, stderr = self.django_starts('2')

        self.assertTrue(started, stderr[-400:])
        self.assertEqual(value, '2')


class SiteDirectoryTests(TestCase):
    """Deletion had no equivalent of `path_within`, and needed one.

    The file endpoints derive the site root from a domain, and `domains.check()`
    has already refused anything that is not a hostname. `perform_destroy` fell
    back to `Website.name` when a site had no domain, which is a plain
    CharField nobody validates, and handed the result to `shutil.rmtree`.

    `Domain.on_delete` is SET_NULL, so a site loses its domain whenever the
    domain is deleted. Reaching the fallback is a normal thing to do.
    """

    def test_an_ordinary_name_resolves_inside_the_tree(self):
        import os

        from hosting.views import HOSTING_ROOT, site_directory

        resolved = site_directory('alice')
        self.assertEqual(resolved, os.path.join(os.path.realpath(HOSTING_ROOT), 'alice'))

    def test_climbing_out_of_the_tree_is_refused(self):
        from hosting.views import site_directory

        for label in ('../etc', '../../etc', '..', '../../../', 'a/../../etc'):
            self.assertIsNone(site_directory(label), label)

    def test_a_nested_path_is_refused(self):
        """A site directory is an immediate child, so `a/b` is wrong even inside."""
        from hosting.views import site_directory

        self.assertIsNone(site_directory('alice/public'))

    def test_the_root_itself_is_refused(self):
        from hosting.views import site_directory

        for label in ('', '.', '/'):
            self.assertIsNone(site_directory(label), repr(label))

    def test_an_absolute_path_cannot_escape(self):
        from hosting.views import site_directory

        self.assertIsNone(site_directory('/etc'))

    def test_a_prefix_neighbour_is_still_its_own_directory(self):
        from hosting.views import site_directory

        self.assertNotEqual(site_directory('a'), site_directory('alice'))


class DomainDeletionFileTests(TestCase):
    """A domain row is not the only thing that keeps a site up.

    nginx maps a request to a directory by `server_name` and knows nothing
    about these rows, so deleting the row left the files served. That is how
    `testphp.ufazien.com` stayed reachable long after its owner was done with
    it, and how a later assessment came to report it as a live web shell.
    """

    def setUp(self):
        from rest_framework.test import APIClient

        from hosting.models import Domain

        User = get_user_model()
        self.user = User.objects.create_user(
            username='owner.one', email='owner@example.com', password='pw'
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)
        self.domain = Domain.objects.create(
            name='oldsite.ufazien.com', domain_type='subdomain', user=self.user
        )

    def delete_domain(self):
        with mock.patch('hosting.views.os.path.exists', return_value=True), \
                mock.patch('shutil.rmtree') as rmtree:
            response = self.api.delete(f'/api/hosting/domains/{self.domain.id}/')
        return response, rmtree

    def test_an_orphaned_domain_takes_its_directory_with_it(self):
        response, rmtree = self.delete_domain()
        self.assertIn(response.status_code, (200, 204), response.status_code)
        rmtree.assert_called_once()
        self.assertTrue(rmtree.call_args[0][0].endswith('oldsite'))

    def test_a_domain_a_website_still_uses_keeps_its_files(self):
        """The website survives with domain set to NULL; its files are its own."""
        from hosting.models import Website

        Website.objects.create(name='Live', user=self.user, domain=self.domain)
        _, rmtree = self.delete_domain()
        rmtree.assert_not_called()

    def test_a_domain_whose_label_would_escape_deletes_nothing(self):
        from hosting.models import Domain

        self.domain = Domain.objects.create(
            name='../etc', domain_type='custom', user=self.user
        )
        _, rmtree = self.delete_domain()
        rmtree.assert_not_called()


class DomainEndpointValidationTests(TestCase):
    """`domains.check()` guarded website creation but not the domain endpoint.

    `POST /api/hosting/domains/` went through `DomainSerializer`, which named
    `name` as a writable field and validated nothing, straight to
    `serializer.save()`. Every file endpoint then derives the site root from
    that name, so a name nobody checked chose the directory.
    """

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username='tenant.one', email='one@example.com', password='pw'
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def claim(self, name, domain_type='custom'):
        return self.api.post(
            '/api/hosting/domains/', {'name': name, 'domain_type': domain_type}, format='json'
        )

    def test_a_traversing_name_is_refused(self):
        """`'../etc'.split('.')[0]` is empty, which roots the site at /srv/hosting."""
        for name in ('../etc', '../../srv', 'a/../../etc', '.ufazien.com', 'not a domain'):
            response = self.claim(name)
            self.assertEqual(response.status_code, 400, f'{name} -> {response.status_code}')
            self.assertFalse(Domain.objects.filter(name=name).exists(), name)

    def test_a_reserved_subdomain_is_still_refused_here(self):
        response = self.claim('admin.ufazien.com', domain_type='subdomain')
        self.assertEqual(response.status_code, 400)

    def test_a_dotted_subdomain_is_refused(self):
        response = self.claim('a.b.ufazien.com', domain_type='subdomain')
        self.assertEqual(response.status_code, 400)

    def test_an_ordinary_subdomain_is_accepted(self):
        response = self.claim('mysite.ufazien.com', domain_type='subdomain')
        self.assertIn(response.status_code, (200, 201), response.data)

    def test_a_custom_domain_of_your_own_is_accepted(self):
        response = self.claim('luxmart.example')
        self.assertIn(response.status_code, (200, 201), response.data)

    def test_the_name_is_stored_normalised(self):
        self.claim('MySite.UFAZIEN.com', domain_type='subdomain')
        self.assertTrue(Domain.objects.filter(name='mysite.ufazien.com').exists())


class SiteLabelCollisionTests(TestCase):
    """A valid hostname can still name somebody else's directory.

    The site root is the domain's first label. Under the base domain that is
    the subdomain, and it is unique because the whole name is. A custom domain
    is only checked for syntax, so `alice.attacker.com` passes every check and
    resolves to `/srv/hosting/alice`. `path_within` cannot help: it measures
    containment against that root, and the root is the victim's.
    """

    def setUp(self):
        User = get_user_model()
        self.victim = User.objects.create_user(
            username='alice.one', email='alice@example.com', password='pw'
        )
        self.attacker = User.objects.create_user(
            username='mallory.one', email='mallory@example.com', password='pw'
        )
        Domain.objects.create(
            name='alice.ufazien.com', domain_type='subdomain', user=self.victim
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.attacker)

    def claim(self, name, domain_type='custom'):
        return self.api.post(
            '/api/hosting/domains/', {'name': name, 'domain_type': domain_type}, format='json'
        )

    def test_a_custom_domain_cannot_borrow_another_tenants_label(self):
        response = self.claim('alice.attacker-owned.com')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Domain.objects.filter(name='alice.attacker-owned.com').exists())

    def test_the_subdomain_itself_is_still_refused(self):
        response = self.claim('alice.ufazien.com', domain_type='subdomain')
        self.assertEqual(response.status_code, 400)

    def test_a_label_nobody_holds_is_allowed(self):
        response = self.claim('mallory.attacker-owned.com')
        self.assertIn(response.status_code, (200, 201), response.data)

    def test_your_own_label_is_not_held_against_you(self):
        """One person may point two names at their own site."""
        Domain.objects.create(
            name='mallory.ufazien.com', domain_type='subdomain', user=self.attacker
        )
        response = self.claim('mallory.example.org')
        self.assertIn(response.status_code, (200, 201), response.data)

    def test_a_website_cannot_claim_the_label_either(self):
        """The website path creates a domain too, and needs the same check.

        Asserted on the field and not merely on the status: website creation
        has other reasons to answer 400, and this passed against the unfixed
        code by hitting one of them.
        """
        response = self.api.post('/api/hosting/websites/', {
            'name': 'Mine', 'website_type': 'static',
            'new_domain_name': 'alice.attacker-owned.com',
        }, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('new_domain_name', response.data)
        self.assertIn('alice', str(response.data['new_domain_name']))


class PhpHardeningConfigTests(TestCase):
    """The php-fpm pool is shared, so `disable_functions` is a tenant boundary.

    `open_basedir` stops a PHP script reading another site's files, but only
    inside PHP. A function that forks a helper process escapes it, and the
    helper is not bound by `disable_functions` either. The classic route is
    `putenv('LD_PRELOAD=...')` followed by `mail()`, which forks
    `/usr/sbin/sendmail` (a real busybox applet in this image) with the
    attacker's shared object preloaded. Disabling `putenv` removes the only way
    PHP userland can set `LD_PRELOAD`, and disabling the mail functions removes
    the fork.
    """

    def hardening(self):
        import os

        from django.conf import settings

        path = os.path.join(
            os.path.dirname(settings.BASE_DIR),
            'hosting', 'php', 'conf.d', 'zz-hardening.ini',
        )
        values = {}
        with open(path, encoding='utf-8') as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith(('#', ';')) or '=' not in line:
                    continue
                key, _, value = line.partition('=')
                values[key.strip()] = value.strip()
        return values

    def test_the_ld_preload_bypass_functions_are_disabled(self):
        disabled = set(self.hardening().get('disable_functions', '').split(','))
        for name in ('putenv', 'mail', 'mb_send_mail', 'dl'):
            self.assertIn(name, disabled, name)

    def test_the_exec_family_stays_disabled(self):
        disabled = set(self.hardening().get('disable_functions', '').split(','))
        for name in ('exec', 'passthru', 'shell_exec', 'system', 'popen',
                     'proc_open', 'pcntl_exec', 'pcntl_fork'):
            self.assertIn(name, disabled, name)

    def test_remote_includes_are_off(self):
        values = self.hardening()
        self.assertEqual(values.get('allow_url_fopen'), '0')
        self.assertEqual(values.get('allow_url_include'), '0')

    def test_runtime_extension_loading_is_off(self):
        self.assertEqual(self.hardening().get('enable_dl'), '0')
