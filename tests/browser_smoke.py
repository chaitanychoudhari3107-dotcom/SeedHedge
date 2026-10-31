"""Deployed-style browser checks with deterministic, transparent Open-Meteo mocks.

Run after starting Vite on localhost:5173:
  pip install playwright
  python -m playwright install chromium
  python tests/browser_smoke.py

These tests verify UI interactions; mocked weather does not certify agricultural science.
"""
import os
import unittest
from datetime import date, timedelta
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv('SEEDHEDGE_BASE_URL', 'http://127.0.0.1:5173')


def weather_payload(year, lat, forecast=False):
    n = 7 if forecast else 40
    start = date.today() if forecast else date(year, 6, 1)
    dates = [(start + timedelta(days=i)).isoformat() for i in range(n)]
    # Controlled mock, intentionally not passed off as real observations.
    rainfall = [8.0 if year in (2022, 2024) else 4.0 for _ in range(n)]
    return {
        'timezone': 'Asia/Kolkata',
        'daily_units': {'precipitation_sum': 'mm', 'temperature_2m_max': '°C'},
        'daily': {'time': dates, 'precipitation_sum': rainfall,
                  'temperature_2m_max': [30.0] * n},
    }


class SeedHedgeBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = sync_playwright().start()
        cls.browser = cls.p.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.p.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 900})
        self.page = self.context.new_page()
        self.request_urls = []

        def mock_weather(route):
            url = route.request.url
            self.request_urls.append(url)
            query = parse_qs(urlparse(url).query)
            if 'archive-api.open-meteo.com' in url:
                year = int(query['start_date'][0][:4])
                route.fulfill(json=weather_payload(year, query.get('latitude', [''])[0]))
            elif 'api.open-meteo.com' in url:
                route.fulfill(json=weather_payload(date.today().year, query.get('latitude', [''])[0], forecast=True))
            else:
                route.continue_()

        self.page.route('**/*open-meteo.com/**', mock_weather)
        self.page.goto(BASE_URL, wait_until='domcontentloaded')
        self.page.get_by_text('Loaded 2022, 2023, 2024, 2025 reanalysis').wait_for(timeout=12000)

    def tearDown(self):
        self.context.close()

    def test_strategy_cards_slider_and_recommendation_independence(self):
        p = self.page
        p.get_by_label('Weather evidence mode').select_option('synthetic')
        winner = p.locator('.winner-value').inner_text()
        p.get_by_role('button', name='Split sowing', exact=False).first.click()
        self.assertIn('Exploring:', p.locator('.selection-sub').inner_text())
        self.assertEqual(winner, p.locator('.winner-value').inner_text())
        p.locator('#allocation-slider').fill('70')
        self.assertIn('70% / 30%', p.locator('.allocation-slider-label').inner_text())
        self.assertIn('70%', p.locator('.selection').inner_text())
        self.assertIn('Recommended vs your selection', p.locator('.comparison-panel').inner_text())
        p.get_by_text('Show estimated sowing cost breakdown').click()
        self.assertIn('Repeat visits', p.locator('.cost-lines').inner_text())

    def test_region_change_and_api_provenance(self):
        p = self.page
        p.locator('#region').select_option('jalna')
        p.get_by_text('Loaded 2022, 2023, 2024, 2025 reanalysis').wait_for(timeout=12000)
        self.assertTrue(any('latitude=19.84' in url for url in self.request_urls))
        p.get_by_text('Show historical reanalysis inputs behind the heuristic').click()
        self.assertIn('Previous 14-day rain', p.locator('.diagnostics-detail').first.inner_text())

    def test_editable_cost_and_status_explanation(self):
        p = self.page
        p.locator('#weather-mode').select_option('synthetic')
        old = p.locator('.decision-price').inner_text()
        p.locator('.rate-input input').nth(4).fill('2000')
        self.assertNotEqual(old, p.locator('.decision-price').inner_text())
        self.assertIn('Why this strategy received its status', p.locator('.transparency-panel').inner_text())

    def test_failed_weather_does_not_make_real_data_recommendation(self):
        p = self.page
        p.unroute('**/*open-meteo.com/**')
        p.route('**/*open-meteo.com/**', lambda route: route.fulfill(status=503, body='Unavailable'))
        p.get_by_role('button', name='Retry').click()
        p.get_by_text('Unavailable:', exact=False).first.wait_for(timeout=12000)
        self.assertIn('Weather unavailable', p.locator('.decision').inner_text())
        self.assertEqual(p.locator('.decision-price').count(), 0)

    def test_mobile_navigation_and_controls(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        p = self.page
        p.get_by_role('button', name='Menu').click()
        self.assertTrue(p.locator('#app-navigation').is_visible())
        p.locator('#app-navigation a[href="#analysis"]').click()
        self.assertFalse(p.locator('#app-navigation').is_visible())
        self.assertTrue(p.locator('#strategy-select').is_visible())
        p.screenshot(path='/tmp/seedhedge-mobile-qa.png', full_page=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
