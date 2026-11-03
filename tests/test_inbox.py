"""Offline regression checks. No model calls, scrapes, database writes or notifications."""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, Mock
import inbox


class ScannerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.env = patch.object(inbox, 'ENV', {'LOCAL_ONLY': '1', 'ANTHROPIC_API_KEY': 'test'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.state = patch.object(inbox, 'STATE', Path(self.temp.name) / 'state.json')
        self.state.start()
        self.addCleanup(self.state.stop)

    def test_windows_cover_delay(self):
        for seconds, expected in [(3600, '1h'), (3601, '24h'), (4200, '24h'), (86400, '24h'), (90000, 'week')]:
            self.assertEqual(inbox.posted_limit(1000000-seconds, 1000000), expected)
            self.assertGreaterEqual(inbox.WINDOW_SECONDS[expected], seconds)

    def test_missing_database_fails_before_scraping(self):
        with patch.object(inbox, 'ENV', {}), patch.object(inbox, 'fetch_posts') as fetch:
            with self.assertRaisesRegex(RuntimeError, 'DATABASE_URL'):
                inbox.main()
            fetch.assert_not_called()
            self.assertFalse(inbox.STATE.exists())

    def test_x_variants_are_processed_once(self):
        posts = [inbox.x_post({'url': url, 'text': 'need an app developer'}) for url in
                 ['https://twitter.com/a/status/123', 'https://x.com/a/status/123?s=20']]
        with patch.object(inbox, 'fetch_posts', return_value=(posts, 0)), patch.object(inbox, 'classify', return_value={'match': False}) as classify:
            self.assertEqual(inbox.main(), 0)
            self.assertEqual(classify.call_count, 1)
            self.assertEqual(json.loads(inbox.STATE.read_text())['seen'], ['x_123'])

    def test_existing_state_urls_are_migrated(self):
        inbox.STATE.write_text(json.dumps({'last_run': 100, 'seen': ['https://twitter.com/a/status/123']}))
        posts = [inbox.x_post({'url': 'https://x.com/a/status/123', 'text': 'text'})]
        with patch.object(inbox, 'fetch_posts', return_value=(posts, 0)), patch.object(inbox, 'classify') as classify:
            inbox.main()
            classify.assert_not_called()

    def test_failure_preserves_retry_window(self):
        posts = [inbox.linkedin_post({'linkedinUrl': url, 'content': 'need an app'}) for url in ['a', 'b']]
        def classify(_, author, text):
            return {'match': True, 'kind': 'product', 'reason': '', 'reply': ''}
        def notify(url, *args):
            if url == 'b':
                raise RuntimeError('temporary failure')
        with patch.object(inbox, 'fetch_posts', return_value=(posts, 0)), patch.object(inbox, 'classify', side_effect=classify), patch.object(inbox, 'notify', side_effect=notify):
            self.assertEqual(inbox.main(), 1)
            self.assertEqual(json.loads(inbox.STATE.read_text()), {'last_run': 0, 'seen': [inbox.lead_id('a')]})

    def test_one_network_failure_preserves_other_posts_and_health(self):
        def actor(name, run_input):
            if name.startswith('xquik'):
                raise RuntimeError('X unavailable')
            return [{'linkedinUrl': 'https://linkedin.com/post', 'content': 'need an app'}]
        reports = {}
        with patch.object(inbox, 'run_actor', side_effect=actor):
            posts, failed = inbox.fetch_posts('24h', 1000000, reports)
        self.assertEqual(len(posts), 1)
        self.assertEqual(failed, 1)
        self.assertEqual(reports['x']['status'], 'error')
        self.assertEqual(reports['linkedin']['status'], 'ok')
        self.assertEqual(reports['reddit']['status'], 'disabled')

    def test_malformed_source_is_not_reported_as_healthy(self):
        reports = {}
        with patch.object(inbox, 'run_actor', return_value=[{}]):
            _, failed = inbox.fetch_posts('24h', 1000000, reports)
        self.assertEqual(failed, 2)
        self.assertEqual(reports['x']['status'], 'error')

    def test_reddit_and_x_mapping(self):
        post = inbox.reddit_post({'id': 'abc', 'communityName': 'SaaS', 'authorName': 'buyer', 'title': 'Need an app', 'body': 'Paid project'})
        self.assertEqual(post['text'], 'Need an app\nPaid project')
        self.assertEqual(inbox.lead_id(post['url']), 'reddit_abc')
        self.assertEqual(inbox.x_post({'searchTerm': 'specific phrase'})['query'], 'specific phrase')
        self.assertNotEqual(inbox.lead_id('https://evilx.com/a/status/123'), 'x_123')

    def test_actor_reads_all_pages_and_rejects_errors(self):
        client = Mock()
        client.actor.return_value.call.return_value = SimpleNamespace(status='SUCCEEDED', status_message='', default_dataset_id='test')
        client.dataset.return_value.iterate_items.return_value = iter([{'text': 'one'}, {'text': 'two'}])
        with patch.object(inbox, 'ApifyClient', return_value=client), patch.dict(inbox.ENV, {'APIFY_TOKEN': 'test'}):
            self.assertEqual(len(inbox.run_actor('test', {})), 2)
            client.dataset.return_value.iterate_items.return_value = iter([{'reasonCode': 'unavailable'}])
            with self.assertRaises(RuntimeError):
                inbox.run_actor('test', {})


if __name__ == '__main__':
    unittest.main()
