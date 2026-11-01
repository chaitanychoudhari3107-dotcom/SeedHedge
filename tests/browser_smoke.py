"""Chromium UI QA for the farmer-first and detailed historical SeedHedge flows.

Run against a local Vite server. All weather API responses here are controlled mocks;
passing these tests does NOT certify live Open-Meteo, Vercel relay or crop advice.
"""
import os
import tempfile
import unittest
from datetime import date, timedelta
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv('SEEDHEDGE_BASE_URL', 'http://127.0.0.1:5173')


def weather_payload(year, forecast=False):
    n = 7 if forecast else 40
    start = date.today() if forecast else date(year, 6, 1)
    return {
        'timezone': 'Asia/Kolkata',
        'daily_units': {'precipitation_sum': 'mm', 'temperature_2m_max': '°C'},
        'daily': {
            'time': [(start + timedelta(days=i)).isoformat() for i in range(n)],
            'precipitation_sum': [8.0 if year in (2022, 2024) else 4.0] * n,
            'temperature_2m_max': [30.0] * n,
        },
    }


class GuidedSeedHedgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1365, 'height': 900})
        self.page = self.context.new_page()
        self.urls = []

        def route_weather(route):
            url = route.request.url
            self.urls.append(url)
            if 'archive-api.open-meteo.com' in url:
                year = int(parse_qs(urlparse(url).query)['start_date'][0][:4])
                route.fulfill(json=weather_payload(year))
            elif 'api.open-meteo.com' in url:
                route.fulfill(json=weather_payload(date.today().year, forecast=True))
            else:
                route.continue_()

        self.page.route('**/*open-meteo.com/**', route_weather)
        self.page.goto(BASE_URL, wait_until='domcontentloaded')
        # Existing detailed dashboard remains available for technical regression testing.
        self.page.get_by_role('button', name='Detailed View').click()
        self.page.get_by_text('Historical reanalysis ready for 2022, 2023, 2024, 2025', exact=False).wait_for(timeout=14000)

    def tearDown(self):
        self.context.close()

    def step(self, n):
        self.page.locator('.guide-step').nth(n).click()

    def test_four_steps_are_sequential_and_navigation_preserves_inputs(self):
        p = self.page
        self.assertEqual(p.locator('.guide-step').count(), 4)
        self.assertTrue(p.locator('#window-start').is_visible())
        p.locator('#area').fill('3')
        p.locator('.guide-next').click()
        self.assertTrue(p.locator('.hub-plan-a').is_visible())
        self.assertTrue(p.locator('.hub-rain-rows').is_visible())
        self.assertEqual(p.locator('.hub-plan-b').count(), 0)
        p.locator('.guide-next').click()
        self.assertTrue(p.locator('#allocation-slider').is_visible())
        self.assertTrue(p.locator('.hub-plan-b').is_visible())
        p.locator('.guide-next').click()
        self.assertTrue(p.locator('.farmer-first').is_visible())
        self.assertTrue(p.locator('.hub-plan-a').is_visible())
        self.assertTrue(p.locator('.hub-plan-b').is_visible())
        p.locator('.guide-step').first.click()
        self.assertEqual(p.locator('#area').input_value(), '3')

    def test_five_date_cap_removed_and_spacing_updates_both_plans(self):
        p = self.page
        self.assertEqual(p.locator('.date-toggles button').count(), 6)
        p.locator('#date-spacing').select_option('1')
        self.assertEqual(p.locator('.date-toggles button').count(), 16)
        self.step(1)
        self.assertEqual(p.locator('.hub-rain-row').count(), 16)
        self.step(2)
        self.assertEqual(p.locator('.hub-plan-b .hub-bmetrics strong').first.inner_text(), '1096')
        self.assertEqual(p.locator('#strategy-select option').count(), 1096)

    def test_user_selected_window_changes_chart_and_split_options(self):
        p = self.page
        p.locator('#window-start').fill('2024-06-23')
        p.locator('#window-end').fill('2024-07-03')
        p.locator('#date-spacing').select_option('5')
        self.assertEqual(p.locator('.date-toggles button').count(), 3)
        self.assertIn('23 Jun', p.locator('.date-toggles').inner_text())
        self.assertIn('3 Jul', p.locator('.date-toggles').inner_text())
        self.step(1)
        self.assertEqual(p.locator('.hub-rain-row').count(), 3)
        self.step(2)
        self.assertEqual(p.locator('#strategy-select option').count(), 30)  # 3 singles, 3 pairs × 9 splits
        self.assertEqual(p.locator('.hub-bmetrics strong').first.inner_text(), '30')

    def test_reversed_dates_block_next_step_and_offer_recovery(self):
        p = self.page
        p.locator('#area').fill('4')
        p.locator('#window-start').fill('2024-07-08')
        p.locator('#window-end').fill('2024-07-05')
        self.assertTrue(p.locator('.window-error').is_visible())
        self.assertTrue(p.locator('.guide-next').is_disabled())
        p.get_by_role('button', name='Swap dates', exact=False).click()
        self.assertEqual(p.locator('#area').input_value(), '4')
        self.assertFalse(p.locator('.guide-next').is_disabled())
        self.assertGreater(p.locator('.date-toggles button').count(), 0)

    def test_threshold_slider_is_on_first_chart(self):
        p = self.page
        self.step(1)
        p.locator('#rainfall-threshold').fill('180')
        self.assertIn('No date meets', p.locator('.hub-plan-a').inner_text())
        p.locator('#rainfall-threshold').fill('50')
        self.assertIn('20 Jun', p.locator('.hub-plan-a').inner_text())
        self.assertTrue(p.locator('.hub-rain-rows').is_visible())

    def test_split_is_exploratory_and_recommended_strategy_stays_independent(self):
        p = self.page
        p.locator('#weather-mode').select_option('synthetic')
        self.step(2)
        winner = p.locator('.winner-value').inner_text()
        options = p.locator('#strategy-select option')
        target = next((options.nth(i).get_attribute('value') for i in range(options.count()) if ' + ' in options.nth(i).inner_text()), None)
        self.assertIsNotNone(target)
        p.locator('#strategy-select').select_option(target)
        p.locator('#allocation-slider').fill('70')
        self.assertIn('70%', p.locator('.selection').inner_text())
        self.assertEqual(winner, p.locator('.winner-value').inner_text())
        for item in p.locator('.legend span').all():
            dt = item.get_attribute('data-date')
            self.assertGreater(p.locator(f'.plot-cell[data-date="{dt}"]').count(), 0)
            # Each date uses the same CSS color in the grid and its legend.
            legend_color = item.locator('i').evaluate('(el) => getComputedStyle(el).backgroundColor')
            plot_color = p.locator(f'.plot-cell[data-date="{dt}"]').first.evaluate('(el) => getComputedStyle(el).backgroundColor')
            self.assertEqual(legend_color, plot_color)

    def test_cost_rate_is_editable_and_reflected_in_final_result(self):
        p = self.page
        p.locator('#weather-mode').select_option('synthetic')
        p.locator('.guide-optional-costs summary').click()
        p.locator('.rate-input input').nth(4).fill('2000')
        self.step(3)
        self.assertTrue(p.locator('.decision-hub').is_visible())
        self.assertIn('2,000', p.locator('.hub-cost-rows').inner_text())
        self.assertIn('FICTIONAL DEMO', p.locator('.farmer-first').inner_text())

    def test_chat_and_marathi_text_do_not_depend_on_audio(self):
        p = self.page
        p.locator('#weather-mode').select_option('synthetic')
        self.step(3)
        p.locator('#farm-question').fill('How is cost calculated?')
        p.get_by_role('button', name='Send question').click()
        self.assertIn('estimated cost', p.locator('.help-thread').inner_text().lower())
        self.step(2)
        self.assertTrue(p.locator('.voice-copy[lang="mr-IN"]').is_visible())
        self.assertTrue(p.locator('.voice-status').is_visible())

    def test_crop_is_intentionally_soybean_only_and_explained(self):
        p = self.page
        self.assertTrue(p.locator('#crop').is_disabled())
        self.assertIn('another crop', p.locator('.farmer-setup').inner_text().lower())

    def test_weather_mode_changes_are_visible_in_each_step(self):
        p = self.page
        self.step(1)
        self.assertIn('REAL PAST RECORDS', p.locator('.guide-mode-switch').inner_text())
        p.locator('#weather-mode-step').select_option('synthetic')
        self.assertIn('FICTIONAL DEMO', p.locator('.guide-mode-switch').inner_text())
        self.assertIn('Unavailable in synthetic mode', p.locator('.hub-plan-a').inner_text())
        self.step(2)
        self.assertIn('FICTIONAL DEMO', p.locator('.guide-mode-switch').inner_text())
        self.assertIn('Best passing one-date option:', p.locator('.hub-farmer-explain').inner_text())
        p.get_by_role('button', name='Fictional stable').click()
        self.assertIn('stable weather', p.locator('.guide-mode-switch').inner_text())
        p.locator('#weather-mode-step').select_option('historical')
        self.assertIn('REAL PAST RECORDS', p.locator('.guide-mode-switch').inner_text())
        p.locator('.hub-state-ready').wait_for(state='visible', timeout=14000)
        self.assertIn('2022–2025 replay', p.locator('.hub-plan-b').inner_text())

    def test_plan_a_cost_is_explained_and_weather_temperature_visible(self):
        p = self.page
        self.step(1)
        self.assertIn('All one-day options currently cost the same', p.locator('.hub-plan-a').inner_text())
        self.assertIn('Temperature and modeled weather exposure', p.locator('.hub-date-evidence').inner_text())
        self.assertIn('30.0 °C', p.locator('.hub-date-evidence').inner_text())
        self.assertRegex(p.locator('.hub-date-evidence').inner_text().lower(), r'not (?:a )?crop-loss probability')

    def test_one_versus_two_visits_explained_with_real_model_values(self):
        p = self.page
        self.step(2)
        box = p.locator('.hub-farmer-explain')
        self.assertIn('One planting visit costs less', box.inner_text())
        self.assertIn('Best passing one-date option:', box.inner_text())
        self.assertIn('Best passing two-date option:', box.inner_text())
        self.assertIn('₹450', box.inner_text())

    def test_final_report_contains_region_temperature_dates_and_provenance(self):
        p = self.page
        p.locator('#region').select_option('jalna')
        p.get_by_text('Historical reanalysis ready for 2022, 2023, 2024, 2025 · Jalna',exact=False).wait_for(timeout=14000)
        self.step(3)
        report = p.locator('#farm-report')
        self.assertIn('Jalna, Maharashtra', report.inner_text())
        self.assertIn('Soybean (Kharif) only', report.inner_text())
        self.assertIn('highest 3-day temperature', report.inner_text().lower())
        self.assertIn('One-day vs two-day planting options', report.inner_text())
        self.assertIn('₹450', report.inner_text())
        self.assertTrue(report.get_by_role('button',name='Print / Save as PDF').is_visible())
        self.assertIn('not a crop-loss probability', report.inner_text().lower())
        self.assertIn('2022–2025', report.inner_text())

    def test_fictional_report_does_not_show_observed_rainfall_table(self):
        p = self.page
        p.locator('#weather-mode').select_option('synthetic')
        self.step(3)
        report = p.locator('#farm-report')
        self.assertIn('FICTIONAL DEMONSTRATION', report.inner_text())
        self.assertIn('Historical temperature and rainfall tables are intentionally hidden', report.inner_text())
        self.assertFalse(report.locator('.report-data-table').count())

    def test_partial_weather_request_does_not_claim_real_result(self):
        p = self.page
        p.unroute('**/*open-meteo.com/**')
        def one_year_fails(route):
            u = route.request.url
            if 'archive-api.open-meteo.com' in u:
                year = int(parse_qs(urlparse(u).query)['start_date'][0][:4])
                route.fulfill(status=400, body='Unavailable') if year == 2025 else route.fulfill(json=weather_payload(year))
            elif 'api.open-meteo.com' in u:
                route.fulfill(json=weather_payload(date.today().year, forecast=True))
            else:
                route.continue_()
        p.route('**/*open-meteo.com/**', one_year_fails)
        p.locator('.source-state button').click()
        p.get_by_text('PARTIAL DATA:', exact=False).wait_for(timeout=18000)
        self.step(1)
        self.assertIn('Partial', p.locator('.hub-state').inner_text())
        self.assertIn('No verified evidence', p.locator('.hub-plan-a').inner_text())

    def test_mobile_guided_navigation(self):
        p = self.page
        p.set_viewport_size({'width': 390, 'height': 844})
        self.assertTrue(p.locator('.guide-step').first.is_visible())
        p.locator('.guide-next').click()
        self.assertTrue(p.locator('.hub-rain-rows').is_visible())
        p.locator('.guide-next').click()
        self.assertTrue(p.locator('#allocation-slider').is_visible())
        p.get_by_role('button', name='Menu').click()
        self.assertTrue(p.locator('#app-navigation').is_visible())
        p.locator('#app-navigation button.nav-item').last.click()
        self.assertFalse(p.locator('#app-navigation').is_visible())
        self.assertTrue(p.locator('.farmer-first').is_visible())
        p.screenshot(path=os.path.join(tempfile.gettempdir(),'seedhedge-mobile-qa.png'), full_page=True)


class FarmerFirstJourneyTests(unittest.TestCase):
    """The main (default) four-step farmer flow. Controlled weather fixtures only."""
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1365, 'height': 900})
        self.page = self.context.new_page()
        def route_weather(route):
            u = route.request.url
            if 'archive-api.open-meteo.com' in u:
                yr = int(parse_qs(urlparse(u).query)['start_date'][0][:4])
                route.fulfill(json=weather_payload(yr))
            elif 'api.open-meteo.com' in u:
                route.fulfill(json=weather_payload(date.today().year, forecast=True))
            else:
                route.continue_()
        self.page.route('**/*open-meteo.com/**', route_weather)
        self.page.goto(BASE_URL,wait_until='domcontentloaded')
        self.page.locator('.farmer-step').first.wait_for()

    def tearDown(self):
        self.context.close()

    def at(self,n):
        self.page.locator('.farmer-step').nth(n).click()

    def test_four_sequential_actions_and_inputs_survive_navigation(self):
        p=self.page
        assert p.locator('.farmer-step').count()==4
        assert p.locator('#farmer-region').is_visible()
        self.at(1)
        p.locator('#farmer-area').fill('3')
        self.at(2)
        assert p.locator('.farmer-rain-row').count()==6
        assert p.locator('.farmer-plan-card').count()==2
        self.at(3)
        assert p.locator('#farmer-action-plan').is_visible()
        self.at(1)
        assert p.locator('#farmer-area').input_value()=='3'

    def test_three_languages_keep_selected_inputs_and_next_step(self):
        p=self.page
        p.get_by_label('Language / भाषा').select_option('mr')
        assert 'पाऊस तपासा' in p.locator('.farmer-step').first.inner_text()
        self.at(1)
        p.locator('#farmer-area').fill('4')
        p.get_by_label('Language / भाषा').select_option('hi')
        assert 'खेत की जानकारी भरें' in p.locator('.farmer-section-heading').inner_text()
        assert p.locator('#farmer-area').input_value()=='4'
        self.at(3)
        assert 'मेरी बुवाई योजना' in p.locator('.farmer-step').last.inner_text()

    def test_rainfall_chart_explains_passes_and_year_values(self):
        p=self.page
        self.at(2)
        p.locator('.farmer-rain-row').first.locator('summary').click()
        assert p.locator('.farmer-year-bars').first.is_visible()
        assert p.locator('.farmer-year-bars').first.get_by_text('2022').is_visible()
        p.locator('#farmer-rain-threshold').fill('180')
        assert p.get_by_text('No date passed the rain rule').is_visible()

    def test_more_than_five_dates_and_dynamic_rates(self):
        p=self.page
        self.at(1)
        p.locator('#farmer-spacing').select_option('1')
        assert p.locator('.farmer-date-chips button').count()==16
        p.locator('.farmer-details summary').click()
        p.locator('.farmer-details input[type=number]').nth(4).fill('2000')
        self.at(3)
        assert '10,300' in p.locator('.farmer-summary').inner_text()

    def test_demo_does_not_show_historical_evidence(self):
        p=self.page
        p.locator('#farmer-weather-mode').select_option('synthetic')
        self.at(2)
        assert 'Practice data is not real weather' in p.locator('#farmer-rain').inner_text()
        assert p.locator('.farmer-year-bars').count()==0
        self.at(3)
        assert 'Practice result' in p.locator('.farmer-final-head').inner_text()
        assert p.locator('.farmer-report-weather').count()==0

    def test_error_state_does_not_claim_real_model_plan(self):
        p=self.page
        p.unroute('**/*open-meteo.com/**')
        p.route('**/*open-meteo.com/**',lambda route: route.fulfill(status=500,body='failed'))
        p.locator('#farmer-region').select_option('jalna')
        p.get_by_text('Weather could not be loaded').wait_for(timeout=18000)
        self.at(3)
        assert 'No final option yet' in p.locator('.farmer-final-head').inner_text()
        assert p.locator('.farmer-report-weather').count()==0

    def test_mobile_navigation_and_print_action(self):
        p=self.page
        p.set_viewport_size({'width':390,'height':844})
        assert p.locator('.farmer-step').first.is_visible()
        self.at(3)
        assert p.get_by_role('button',name='Save or print plan').is_visible()


if __name__ == '__main__':
    unittest.main(verbosity=2)
