"""
Turning nginx's access logs into the analytics page.

The page has never shown anybody their own numbers: `WebsiteAnalytics` was only
writable by a webhook nothing called, so the endpoint fell back to
`random.randint` figures for every site, for ever.
"""

import hashlib
import hmac
import json
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .access_logs import (
    aggregate,
    is_bot,
    is_page,
    parse_line,
    subdomain_of,
    visitor_key,
)
from .models import Website, WebsiteAnalytics

User = get_user_model()

SALT = 'a-test-salt'


def line(**overrides):
    entry = {
        't': '2026-08-20T10:15:00+04:00',
        'host': 'alice.ufazien.com',
        'method': 'GET',
        'uri': '/',
        'status': 200,
        'bytes': 1024,
        'ip': '203.0.113.7',
        'ref': '-',
        'ua': 'Mozilla/5.0',
    }
    entry.update(overrides)
    return json.dumps(entry)


class WhichSiteTests(TestCase):
    """A log line names its site by host; `Website.name` is the subdomain."""

    def test_reads_the_subdomain(self):
        self.assertEqual(subdomain_of('alice.ufazien.com'), 'alice')

    def test_ignores_the_port_and_the_case(self):
        self.assertEqual(subdomain_of('Alice.Ufazien.com:80'), 'alice')

    def test_refuses_a_host_that_is_not_ours(self):
        self.assertIsNone(subdomain_of('example.com'))
        self.assertIsNone(subdomain_of('ufazien.com'))
        self.assertIsNone(subdomain_of('notufazien.com'))
        self.assertIsNone(subdomain_of(''))


class WhatCountsTests(TestCase):
    def test_a_page_is_a_page(self):
        for path in ('/', '/about', '/news/2026', '/index.html', '/thing.php?q=1'):
            self.assertTrue(is_page(path), path)

    def test_an_asset_is_not(self):
        # Somebody reading one page pulls a dozen of these, and counting each
        # as a view turns twelve readers into a hundred and fifty.
        for path in ('/style.css', '/app.js', '/logo.png', '/font.woff2', '/data.json'):
            self.assertFalse(is_page(path), path)

    def test_a_crawler_is_not_a_visitor(self):
        self.assertTrue(is_bot('Googlebot/2.1 (+http://www.google.com/bot.html)'))
        self.assertTrue(is_bot('python-requests/2.31'))
        self.assertFalse(is_bot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'))

    def test_a_visitor_key_keeps_no_address(self):
        key = visitor_key('203.0.113.7', date(2026, 8, 20), SALT)
        self.assertNotIn('203.0.113.7', key)

    def test_the_same_person_is_one_visitor_that_day(self):
        first = visitor_key('203.0.113.7', date(2026, 8, 20), SALT)
        again = visitor_key('203.0.113.7', date(2026, 8, 20), SALT)
        self.assertEqual(first, again)

    def test_but_cannot_be_followed_to_the_next_day(self):
        today = visitor_key('203.0.113.7', date(2026, 8, 20), SALT)
        tomorrow = visitor_key('203.0.113.7', date(2026, 8, 21), SALT)
        self.assertNotEqual(today, tomorrow)


class BadLinesTests(TestCase):
    """A log is a file that gets truncated, rotated and half-written."""

    def test_a_half_written_line_is_skipped(self):
        self.assertIsNone(parse_line('{"t":"2026-08-20T10:00:00+04:00","ho'))

    def test_a_blank_line_is_skipped(self):
        self.assertIsNone(parse_line('   '))

    def test_one_bad_line_does_not_stop_the_rest(self):
        traffic = aggregate([line(), 'not json at all', line(uri='/about')], salt=SALT)
        self.assertEqual(traffic[('alice', date(2026, 8, 20))].page_views, 2)

    def test_quotes_in_a_user_agent_do_not_break_the_line(self):
        # This is what `escape=json` in the nginx log_format is for.
        traffic = aggregate([line(ua='Mozilla "quoted" \\\\ backslash')], salt=SALT)
        self.assertEqual(traffic[('alice', date(2026, 8, 20))].page_views, 1)


class AggregationTests(TestCase):
    def totals(self, lines, **kwargs):
        traffic = aggregate(lines, salt=SALT, **kwargs)
        return traffic[('alice', date(2026, 8, 20))]

    def test_counts_page_views_and_visitors(self):
        got = self.totals([
            line(ip='203.0.113.1'),
            line(ip='203.0.113.1', uri='/about'),
            line(ip='203.0.113.2'),
        ])
        self.assertEqual(got.page_views, 3)
        self.assertEqual(len(got.visitors), 2, 'the same address was counted twice')

    def test_bandwidth_counts_everything_that_left(self):
        # A 404 page and a stylesheet both cost the quota.
        got = self.totals([
            line(bytes=1000),
            line(bytes=500, uri='/style.css'),
            line(bytes=200, status=404, uri='/missing'),
        ])
        self.assertEqual(got.bandwidth_used, 1700)

    def test_assets_do_not_inflate_the_view_count(self):
        got = self.totals([line(), line(uri='/app.js'), line(uri='/logo.png')])
        self.assertEqual(got.page_views, 1)

    def test_an_error_is_traffic_but_not_readership(self):
        got = self.totals([line(status=404, uri='/missing'), line(status=301, uri='/old')])
        self.assertEqual(got.page_views, 0)
        self.assertGreater(got.bandwidth_used, 0)

    def test_crawlers_are_left_out_by_default(self):
        got = self.totals([line(), line(ua='Googlebot/2.1', ip='198.51.100.9')])
        self.assertEqual(got.page_views, 1)
        self.assertEqual(len(got.visitors), 1)

    def test_a_site_is_not_its_own_referrer(self):
        got = self.totals([
            line(ref='https://alice.ufazien.com/index.html'),
            line(ref='https://news.example.com/story'),
        ])
        self.assertEqual([r['referrer'] for r in got.as_row()['referrers']],
                         ['https://news.example.com/story'])

    def test_top_pages_are_ordered_by_how_often_they_were_read(self):
        got = self.totals([line(uri='/about'), line(uri='/about'), line(uri='/')])
        self.assertEqual(got.as_row()['top_pages'][0], {'path': '/about', 'views': 2})

    def test_a_query_string_does_not_split_a_page_in_two(self):
        got = self.totals([line(uri='/search?q=a'), line(uri='/search?q=b')])
        self.assertEqual(got.as_row()['top_pages'], [{'path': '/search', 'views': 2}])

    def test_days_are_kept_apart(self):
        traffic = aggregate(
            [line(), line(t='2026-08-21T09:00:00+04:00')], salt=SALT
        )
        self.assertEqual(sorted(day for _, day in traffic),
                         [date(2026, 8, 20), date(2026, 8, 21)])

    def test_sites_are_kept_apart(self):
        traffic = aggregate([line(), line(host='bob.ufazien.com')], salt=SALT)
        self.assertEqual(sorted(name for name, _ in traffic), ['alice', 'bob'])

    def test_a_host_that_is_not_ours_is_dropped(self):
        traffic = aggregate([line(host='example.com')], salt=SALT)
        self.assertEqual(traffic, {})

    def test_running_it_twice_gives_the_same_answer(self):
        """
        Absolute totals, not increments — which is what the webhook it replaces
        got wrong: a retried delivery counted twice.
        """
        lines = [line(), line(uri='/about')]
        once = aggregate(lines, salt=SALT)[('alice', date(2026, 8, 20))].as_row()
        twice = aggregate(lines, salt=SALT)[('alice', date(2026, 8, 20))].as_row()
        self.assertEqual(once, twice)


class CommandTests(TestCase):
    """The command that writes what the page reads."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='alice', email='alice@example.com', password='pw'
        )
        self.site = Website.objects.create(name='alice', user=self.user)

    def run_command(self, lines, **options):
        from io import StringIO
        from django.core.management import call_command
        import tempfile
        import os

        directory = tempfile.mkdtemp()
        path = os.path.join(directory, 'access.log')
        with open(path, 'w') as handle:
            handle.write('\n'.join(lines) + '\n')

        out = StringIO()
        call_command('aggregate_access_logs', logs=path, stdout=out, **options)
        return out.getvalue()

    def test_writes_a_day_of_traffic(self):
        self.run_command([line(ip='203.0.113.1'), line(ip='203.0.113.2', uri='/about')])

        row = WebsiteAnalytics.objects.get(website=self.site, date=date(2026, 8, 20))
        self.assertEqual(row.page_views, 2)
        self.assertEqual(row.unique_visitors, 2)
        self.assertEqual(row.bandwidth_used, 2048)

    def test_running_it_again_does_not_double_the_numbers(self):
        lines = [line(), line(uri='/about')]
        self.run_command(lines)
        self.run_command(lines)

        row = WebsiteAnalytics.objects.get(website=self.site, date=date(2026, 8, 20))
        self.assertEqual(row.page_views, 2, 'a second run counted the same requests again')
        self.assertEqual(WebsiteAnalytics.objects.count(), 1)

    def test_a_rotated_log_does_not_shrink_a_day(self):
        """
        The log holding less than it did is rotation, not a quieter day.
        Overwriting from it would lose traffic that really happened.
        """
        self.run_command([line(), line(uri='/about'), line(uri='/news')])
        self.run_command([line()])

        row = WebsiteAnalytics.objects.get(website=self.site, date=date(2026, 8, 20))
        self.assertEqual(row.page_views, 3)

    def test_but_force_says_it_anyway(self):
        self.run_command([line(), line(uri='/about'), line(uri='/news')])
        self.run_command([line()], force=True)

        row = WebsiteAnalytics.objects.get(website=self.site, date=date(2026, 8, 20))
        self.assertEqual(row.page_views, 1)

    def test_a_host_with_no_website_is_ignored_rather_than_failing(self):
        output = self.run_command([line(host='nobody.ufazien.com')])
        self.assertIn('ignored', output)
        self.assertEqual(WebsiteAnalytics.objects.count(), 0)

    def test_a_dry_run_writes_nothing(self):
        self.run_command([line()], dry_run=True)
        self.assertEqual(WebsiteAnalytics.objects.count(), 0)


@override_settings(HOSTING_WEBHOOK_SECRET='shhh')
class WebhookTests(TestCase):
    """
    The webhook is signed now.

    A subdomain says which site a payload is about; it does not say who sent it.
    Before this the endpoint had no authentication at all and took `website_id`
    straight from the body, so anybody could post any figures for anybody's
    site — and it *added* them, so a retry counted twice.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='bob', email='bob@example.com', password='pw'
        )
        self.site = Website.objects.create(name='bob', user=self.user)
        self.client = APIClient()

    def post(self, payload, signature=None, secret='shhh'):
        body = json.dumps(payload)
        if signature is None:
            signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        return self.client.post(
            '/api/hosting/webhooks/analytics/',
            data=body,
            content_type='application/json',
            HTTP_X_UFAZIEN_SIGNATURE=signature,
        )

    def payload(self, **overrides):
        data = {'subdomain': 'bob', 'date': '2026-08-20', 'page_views': 10}
        data.update(overrides)
        return data

    def test_a_signed_payload_is_recorded(self):
        response = self.post(self.payload())
        self.assertEqual(response.status_code, 200, response.content[:200])
        self.assertEqual(
            WebsiteAnalytics.objects.get(website=self.site).page_views, 10
        )

    def test_an_unsigned_payload_is_refused(self):
        response = self.post(self.payload(), signature='')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(WebsiteAnalytics.objects.count(), 0)

    def test_a_payload_signed_with_the_wrong_secret_is_refused(self):
        response = self.post(self.payload(), secret='guessed')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(WebsiteAnalytics.objects.count(), 0)

    def test_a_tampered_body_is_refused(self):
        body = json.dumps(self.payload())
        signature = hmac.new(b'shhh', body.encode(), hashlib.sha256).hexdigest()
        response = self.client.post(
            '/api/hosting/webhooks/analytics/',
            data=json.dumps(self.payload(page_views=999999)),
            content_type='application/json',
            HTTP_X_UFAZIEN_SIGNATURE=signature,
        )
        self.assertEqual(response.status_code, 401)

    def test_posting_the_same_day_twice_does_not_double_it(self):
        self.post(self.payload())
        self.post(self.payload())
        self.assertEqual(
            WebsiteAnalytics.objects.get(website=self.site).page_views, 10
        )

    def test_a_site_that_does_not_exist_is_a_404(self):
        response = self.post(self.payload(subdomain='nobody'))
        self.assertEqual(response.status_code, 404)

    def test_a_bad_date_is_refused(self):
        self.assertEqual(self.post(self.payload(date='yesterday')).status_code, 400)

    def test_nonsense_figures_are_refused(self):
        self.assertEqual(self.post(self.payload(page_views='lots')).status_code, 400)


@override_settings(HOSTING_WEBHOOK_SECRET='')
class UnconfiguredWebhookTests(TestCase):
    def test_it_refuses_everything_rather_than_accepting_anything(self):
        """Fails closed: no secret means no writes, not free writes."""
        response = APIClient().post(
            '/api/hosting/webhooks/analytics/',
            data=json.dumps({'subdomain': 'bob', 'date': '2026-08-20', 'page_views': 5}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(WebsiteAnalytics.objects.count(), 0)


class AnalyticsEndpointTests(TestCase):
    """The page shows what happened, not what might have."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='carol', email='carol@example.com', password='pw'
        )
        self.site = Website.objects.create(name='carol', user=self.user)
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_a_site_with_no_traffic_reports_none(self):
        """
        It used to invent a week of `random.randint` traffic whenever the table
        was empty — which it always was, because nothing wrote to it.
        """
        response = self.api.get(f'/api/hosting/websites/{self.site.id}/analytics/')

        self.assertEqual(response.status_code, 200, response.content[:200])
        body = response.json()
        self.assertEqual(body['summary']['total_page_views'], 0)
        self.assertEqual(body['summary']['total_unique_visitors'], 0)

    def test_real_traffic_reaches_the_page(self):
        WebsiteAnalytics.objects.create(
            website=self.site,
            date=timezone.now().date() - timedelta(days=1),
            page_views=42,
            unique_visitors=17,
            bandwidth_used=123456,
        )

        response = self.api.get(f'/api/hosting/websites/{self.site.id}/analytics/')

        self.assertEqual(response.status_code, 200, response.content[:200])
        summary = response.json()['summary']
        self.assertEqual(summary['total_page_views'], 42)
        self.assertEqual(summary['total_unique_visitors'], 17)
