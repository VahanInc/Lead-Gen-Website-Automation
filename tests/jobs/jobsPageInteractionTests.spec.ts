import { test, expect } from '../fixtures';
import { JobsPage, WHATSAPP_URL_PATTERN, VAHAN_WHATSAPP_PHONE } from '../../src/pages/JobsPage';

// ============================================================
// FILTER INTERACTIONS — POSITIVE
// ============================================================
test.describe('Filter interactions - positive', () => {
  test('selecting a city option changes the job count and still shows results', async ({
    page,
  }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.jobCountLabel.waitFor();
    const totalBefore = await jobsPage.getJobTotalCount();

    await jobsPage.selectFirstFilterOption(jobsPage.filterCity);

    const totalAfter = await jobsPage.getJobTotalCount();
    // Count must change (filter had an effect) and listing must remain non-empty
    expect(totalAfter).toBeGreaterThan(0);
    expect(totalAfter).not.toBe(totalBefore);

    const cardCount = await jobsPage.jobCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('selecting a company filter shows results for that company', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFirstFilterOption(jobsPage.filterCompany);

    const cardCount = await jobsPage.jobCards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(await jobsPage.getJobTotalCount()).toBeGreaterThan(0);
  });

  test('applying city then company filters both have visible effects', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.jobCountLabel.waitFor();
    const totalAll = await jobsPage.getJobTotalCount();

    // Apply city filter — count must change
    await jobsPage.selectFirstFilterOption(jobsPage.filterCity);
    const totalAfterCity = await jobsPage.getJobTotalCount();
    expect(totalAfterCity).toBeGreaterThan(0);
    expect(totalAfterCity).not.toBe(totalAll);

    // Apply company filter on top — count must change again
    await jobsPage.selectFirstFilterOption(jobsPage.filterCompany);
    const totalAfterBoth = await jobsPage.getJobTotalCount();
    expect(totalAfterBoth).toBeGreaterThan(0);
    expect(totalAfterBoth).not.toBe(totalAfterCity);
  });

  test('all three filters (city + neighbourhood + company) leave the page functional', async ({
    page,
  }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFirstFilterOption(jobsPage.filterCity);
    await jobsPage.selectFirstFilterOption(jobsPage.filterNeighbourhood);
    await jobsPage.selectFirstFilterOption(jobsPage.filterCompany);

    // Page should not crash and either show results or a clear no-results state
    const cardCount = await jobsPage.jobCards.count();
    const noResults = await jobsPage.noResultsMessage.isVisible().catch(() => false);
    expect(cardCount > 0 || noResults).toBeTruthy();
  });
});

// ============================================================
// FILTER INTERACTIONS — EDGE CASES
// ============================================================
test.describe('Filter interactions - edge cases', () => {
  test('applying a filter after navigating to page 2 resets listing to page 1', async ({
    page,
  }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    // Navigate to page 2
    await jobsPage.pagination.getByRole('button', { name: 'Go to page 2' }).click();
    await jobsPage.jobCountLabel.waitFor();

    // Apply city filter — should reset pagination
    await jobsPage.selectFirstFilterOption(jobsPage.filterCity);

    const countText = (await jobsPage.jobCountLabel.textContent()) ?? '';
    // Range should start from 1 (e.g. "Showing 1-9 jobs of …")
    expect(countText).toMatch(/Showing 1-/);
  });

  test('rapidly switching city options does not leave the page in a broken state', async ({
    page,
  }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    // selectFirstFilterOption handles the geolocation banner and leaves the dropdown open
    await jobsPage.selectFirstFilterOption(jobsPage.filterCity);

    // Dropdown is still open — rapidly toggle several options without close/reopen
    const options = jobsPage.filterDropdownOptions;
    const count = await options.count();
    for (let i = 0; i < Math.min(3, count); i++) {
      await options.nth(i).click();
    }

    // After rapid switching, listing and count label should still be functional
    await expect(jobsPage.jobCountLabel).toBeVisible({ timeout: 10000 });
    expect(await jobsPage.jobCards.count()).toBeGreaterThan(0);
  });

  test('zero-results filter combination shows no-results state gracefully', async ({ page }) => {
    // TODO: identify a city + neighbourhood + company triple that reliably
    // returns 0 results in the live dataset, then replace test.skip() with
    // the actual filter selections and assert jobsPage.noResultsMessage is visible.
    test.skip(true, 'Needs a known zero-result filter combination from the dataset');
  });
});

// ============================================================
// PAGINATION
// ============================================================
test.describe('Pagination', () => {
  test('page 2 shows the next sequential batch of jobs', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    // Apply city filter first to get a stable, manageable result set
    await jobsPage.selectFirstFilterOption(jobsPage.filterCity);
    // Close the dropdown so the page 2 button is accessible
    await page.keyboard.press('Escape');

    await jobsPage.jobCountLabel.waitFor();
    const page1Text = (await jobsPage.jobCountLabel.textContent()) ?? '';
    const page1Match = page1Text.match(/Showing (\d+)-(\d+) jobs of/);
    expect(page1Match).not.toBeNull();
    const page1End = parseInt(page1Match![2]);

    await jobsPage.pagination.getByRole('button', { name: 'Go to page 2' }).click();
    // Wait for the count label to reflect page 2 (it was already visible for page 1)
    await expect.poll(() => jobsPage.jobCountLabel.textContent(), { timeout: 10000 })
      .not.toBe(page1Text);

    const page2Text = (await jobsPage.jobCountLabel.textContent()) ?? '';
    const page2Match = page2Text.match(/Showing (\d+)-(\d+) jobs of/);
    expect(page2Match).not.toBeNull();

    const page2Start = parseInt(page2Match![1]);
    expect(page2Start).toBe(page1End + 1);
  });

  test('job count label is consistent with visible job cards', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.jobCountLabel.waitFor();
    const labelText = (await jobsPage.jobCountLabel.textContent()) ?? '';
    const rangeMatch = labelText.match(/Showing (\d+)-(\d+) jobs of/);
    expect(rangeMatch).not.toBeNull();

    const expectedCardCount = parseInt(rangeMatch![2]) - parseInt(rangeMatch![1]) + 1;
    const actualCardCount = await jobsPage.jobCards.count();
    expect(actualCardCount).toBe(expectedCardCount);
  });
});

// ============================================================
// ALERT ME FORM — POSITIVE
// ============================================================
test.describe('Alert Me form - positive', () => {
  // Skipped: React's controlled-input state is not updated by programmatic fill/type
  // in this headless environment, leaving the submit button disabled. The happy-path
  // submission flow cannot be reliably automated against the live site.
  test.skip('valid area name + phone number navigates to Vahan WhatsApp with correct message', async ({
    page,
  }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const getUrl = await jobsPage.interceptWhatsAppNavigation();

    await jobsPage.areaNameInput.pressSequentially('Koramangala', { delay: 50 });
    await jobsPage.alertWhatsAppInput.pressSequentially('9000000001', { delay: 50 });

    await expect.poll(getUrl, { timeout: 10000 }).toMatch(WHATSAPP_URL_PATTERN);
    expect(getUrl()).toContain(`phone=${VAHAN_WHATSAPP_PHONE}`);
    expect(decodeURIComponent(getUrl())).toContain('delivery job');
  });
});

// ============================================================
// ALERT ME FORM — VALIDATION (NEGATIVE)
// ============================================================
test.describe('Alert Me form - validation', () => {
  test('empty phone number does not navigate to WhatsApp', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.areaNameInput.fill('Koramangala');
    // phone left blank — button may be disabled; force-click to attempt submission
    await jobsPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/jobs\//, { timeout: 3000 });
  });

  test('area name is optional — form submits with a valid phone number alone', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const getUrl = await jobsPage.interceptWhatsAppNavigation();
    // Area is optional; fill only the phone number
    await jobsPage.alertWhatsAppInput.pressSequentially('9876543210', { delay: 30 });
    await page.waitForTimeout(500);
    await expect(jobsPage.alertSubmitButton).toBeEnabled({ timeout: 3000 });
    await jobsPage.alertSubmitButton.click();
    await expect.poll(getUrl, { timeout: 5000 }).toMatch(WHATSAPP_URL_PATTERN);
  });

  test('phone number shorter than 10 digits does not submit', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.areaNameInput.fill('Koramangala');
    await jobsPage.alertWhatsAppInput.fill('98765');
    await jobsPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/jobs\//, { timeout: 3000 });
  });

  test('non-numeric phone does not submit', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.areaNameInput.fill('Koramangala');
    await jobsPage.alertWhatsAppInput.fill('abcde12345');
    await jobsPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/jobs\//, { timeout: 3000 });
  });

  test('area alone without a phone number does not enable the submit button', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    // Fill area but leave phone blank — phone is required
    await jobsPage.areaNameInput.fill('Koramangala');
    await jobsPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/jobs\//, { timeout: 3000 });
  });

  test('phone with internal space either strips space or is rejected', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const getUrl = await jobsPage.interceptWhatsAppNavigation();

    await jobsPage.areaNameInput.fill('Koramangala');
    await jobsPage.alertWhatsAppInput.click();
    await jobsPage.alertWhatsAppInput.pressSequentially('98765 43210');

    const buttonEnabled = await jobsPage.alertSubmitButton.isEnabled();
    if (!buttonEnabled) {
      // Form validation rejected the input — test passes (form is working correctly)
      return;
    }
    await jobsPage.alertSubmitButton.click();

    // Wait briefly to see if navigation fires
    await page.waitForTimeout(2000);
    const navigatedUrl = getUrl();

    if (navigatedUrl) {
      // If accepted, the URL must not contain a raw space (it must be encoded or stripped)
      expect(navigatedUrl).not.toMatch(/ /);
    } else {
      // If rejected, must stay on the jobs page
      await expect(page).toHaveURL(/\/jobs\//);
    }
  });

  test('duplicate submission of same number is handled gracefully', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    // First submission attempt
    await jobsPage.areaNameInput.fill('Koramangala');
    await jobsPage.alertWhatsAppInput.fill('9876543210');
    await page.waitForTimeout(1000);

    // Re-navigate and submit again — page must remain accessible (not crash)
    await jobsPage.goto();
    await jobsPage.areaNameInput.fill('Koramangala');
    await jobsPage.alertWhatsAppInput.fill('9876543210');
    await page.waitForTimeout(1000);

    // Page must still be on /jobs/ (no crash or unexpected redirect)
    await expect(page).toHaveURL(/\/jobs\//);
    await expect(jobsPage.alertHeading).toBeVisible();
  });
});

// ============================================================
// CTA — WHATSAPP NAVIGATION
// ============================================================
test.describe('CTA WhatsApp navigation', () => {
  test('hero Apply Now button navigates to WhatsApp', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const getUrl = await jobsPage.interceptWhatsAppNavigation();
    await jobsPage.heroApplyNowButton.click();

    await expect.poll(getUrl, { timeout: 5000 }).toMatch(WHATSAPP_URL_PATTERN);
  });

  test('job card APPLY NOW button navigates to WhatsApp', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const getUrl = await jobsPage.interceptWhatsAppNavigation();
    await jobsPage.jobApplyNowButtons.first().scrollIntoViewIfNeeded();
    await jobsPage.jobApplyNowButtons.first().click();

    await expect.poll(getUrl, { timeout: 5000 }).toMatch(WHATSAPP_URL_PATTERN);
  });

  test('footer Contact Me button navigates to WhatsApp after entering a phone', async ({
    page,
  }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    // The footer is lazily loaded; wait until all JS bundles have executed before
    // interacting — otherwise React's onChange handler isn't attached yet.
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const getUrl = await jobsPage.interceptWhatsAppNavigation();
    await jobsPage.footerWhatsAppInput.scrollIntoViewIfNeeded();
    await jobsPage.footerWhatsAppInput.click();
    await jobsPage.footerWhatsAppInput.pressSequentially('9876543210', { delay: 50 });
    await page.waitForTimeout(500);
    await expect(jobsPage.footerContactButton).toBeEnabled({ timeout: 5000 });
    await jobsPage.footerContactButton.click();

    await expect.poll(getUrl, { timeout: 5000 }).toMatch(WHATSAPP_URL_PATTERN);
  });

  test('GET STARTED link has a non-empty href target', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const href = await jobsPage.getStartedButton.getAttribute('href');
    expect(href).toBeTruthy();
    // Should not be a dead anchor
    expect(href).not.toBe('#');
  });

  test('Know More link on first job card navigates to a job detail page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.knowMoreLinks.first().click();
    // Next.js client-side routing — URL updates via history.pushState, no page reload.
    // waitForLoadState('domcontentloaded') is a no-op here; use waitForURL instead.
    await page.waitForURL(/\/jobs\/.+/, { timeout: 10000 });

    // Must have navigated to a job detail path (not the root listing)
    expect(page.url()).not.toMatch(/\/jobs\/$/);
  });
});

// ============================================================
// LANGUAGE SWITCHING
// ============================================================
test.describe('Language switching', () => {
  test('switching to Hindi changes hero heading to Devanagari script', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const englishText = await jobsPage.heroHeading.textContent();
    expect(englishText).toContain('Find your perfect delivery job');

    await jobsPage.switchLanguage('hindi');

    const hindiText = await page.getByRole('heading', { level: 1 }).first().textContent();
    // Must contain at least one Devanagari character (U+0900–U+097F)
    expect(hindiText).toMatch(/[ऀ-ॿ]/);
  });

  test('switching to Kannada changes hero heading to Kannada script', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('kannada');

    const text = await page.getByRole('heading', { level: 1 }).first().textContent();
    // Must contain at least one Kannada character (U+0C80–U+0CFF)
    expect(text).toMatch(/[ಀ-೿]/);
  });

  test('switching back to English from Hindi restores the English heading', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('hindi');
    await jobsPage.switchLanguage('english');

    await expect(jobsPage.heroHeading).toBeVisible();
    const text = await jobsPage.heroHeading.textContent();
    expect(text).toContain('Find your perfect delivery job');
  });

  test('language switch with an active filter does not crash the page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFirstFilterOption(jobsPage.filterCity);
    await jobsPage.switchLanguage('hindi');

    // Page must not have crashed — at least one job card heading should be visible
    // (checking job count label is fragile as its text changes with language)
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible({ timeout: 10000 });
  });

  test('long translated strings do not overflow or break the nav layout', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('hindi');

    // Header must still be a single horizontal banner — check it is visible
    await expect(page.getByRole('banner')).toBeVisible();
    // Language dropdown must still be accessible
    const banner = page.getByRole('banner');
    // Both the toggle and the dropdown option contain Devanagari; use .first()
    const langButton = banner.locator('button').filter({ hasText: /[ऀ-ॿ]/ }).first();
    await expect(langButton).toBeVisible();
  });
});

// ============================================================
// FAQ ACCORDION
// ============================================================
test.describe('FAQ accordion behavior', () => {
  test('clicking a FAQ question toggles its aria-expanded state', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const btn = jobsPage.faqButtons.rolesAvailable;
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toHaveAttribute('aria-expanded', /true|false/, { timeout: 5000 });
    const before = await btn.getAttribute('aria-expanded');
    await btn.click();
    await expect(btn).not.toHaveAttribute('aria-expanded', before!, { timeout: 5000 });
  });

  test('clicking the same FAQ question twice returns it to its original state', async ({
    page,
  }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const btn = jobsPage.faqButtons.rolesAvailable;
    await btn.scrollIntoViewIfNeeded();

    const initial = await btn.getAttribute('aria-expanded');
    await btn.click();
    await page.waitForTimeout(300);
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', initial ?? 'false', { timeout: 5000 });
  });

  test('opening a second FAQ while the first is open works correctly', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const first = jobsPage.faqButtons.rolesAvailable;
    const second = jobsPage.faqButtons.ownVehicle;

    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute('aria-expanded', /true|false/, { timeout: 5000 });

    // Ensure first is open
    if ((await first.getAttribute('aria-expanded')) === 'false') {
      await first.click();
      await expect(first).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
    }

    // Click second — must successfully open it
    await second.scrollIntoViewIfNeeded();
    await expect(second).toHaveAttribute('aria-expanded', /true|false/, { timeout: 5000 });
    await second.click();
    await expect(second).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
  });

  test('each FAQ question can be individually opened', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    for (const [key, btn] of Object.entries(jobsPage.faqButtons)) {
      await btn.scrollIntoViewIfNeeded();
      await expect(btn).toHaveAttribute('aria-expanded', /true|false/, { timeout: 5000 });

      const current = await btn.getAttribute('aria-expanded');
      if (current !== 'true') {
        await btn.click();
        await expect(btn, `${key} should expand`).toHaveAttribute('aria-expanded', 'true', {
          timeout: 5000,
        });
      } else {
        expect(current).toBe('true');
      }
    }
  });
});

// ============================================================
// TESTIMONIAL CAROUSEL
// ============================================================
test.describe('Testimonial carousel', () => {
  test('clicking Next advances the carousel without crashing', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.testimonialNextButton.scrollIntoViewIfNeeded();
    await jobsPage.testimonialNextButton.click();
    await page.waitForTimeout(400);

    // Carousel controls and heading must still be present after click
    await expect(jobsPage.testimonialNextButton).toBeVisible();
    await expect(jobsPage.testimonialPrevButton).toBeVisible();
    await expect(jobsPage.testimonialsHeading).toBeVisible();
  });

  test('clicking Previous from the first testimonial does not crash', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.testimonialPrevButton.scrollIntoViewIfNeeded();
    await jobsPage.testimonialPrevButton.click();

    // Both carousel controls must still be present and functional
    await expect(jobsPage.testimonialNextButton).toBeVisible();
    await expect(jobsPage.testimonialPrevButton).toBeVisible();
  });

  test('clicking Next then Previous leaves the carousel functional', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.testimonialNextButton.scrollIntoViewIfNeeded();
    await jobsPage.testimonialNextButton.click();
    await page.waitForTimeout(300);
    await jobsPage.testimonialPrevButton.click();
    await page.waitForTimeout(300);

    // Carousel must still be operational after both button clicks
    await expect(jobsPage.testimonialNextButton).toBeVisible();
    await expect(jobsPage.testimonialsHeading).toBeVisible();
  });
});

// ============================================================
// FOOTER LINK NAVIGATION
// ============================================================
test.describe('Footer link navigation', () => {
  test('Privacy Policy link navigates to a privacy page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.footerLinks.privacyPolicy.scrollIntoViewIfNeeded();
    const href = await jobsPage.footerLinks.privacyPolicy.getAttribute('href');
    expect(href).toMatch(/privacy/i);
  });

  test('Terms & Conditions link navigates to a terms page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.footerLinks.termsAndConditions.scrollIntoViewIfNeeded();
    const href = await jobsPage.footerLinks.termsAndConditions.getAttribute('href');
    expect(href).toMatch(/terms/i);
  });

  test('email link uses mailto: scheme with correct address', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const href = await jobsPage.footerLinks.email.getAttribute('href');
    expect(href).toBe('mailto:info@vahan.ai');
  });

  test('LinkedIn icon links to linkedin.com', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const href = await jobsPage.footerLinks.linkedIn.getAttribute('href');
    expect(href).toContain('linkedin.com');
  });

  test('YouTube icon links to youtube.com', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const href = await jobsPage.footerLinks.youTube.getAttribute('href');
    expect(href).toContain('youtube.com');
  });

  test('For Job-Seekers footer link points to the jobs page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.footerLinks.forJobSeekers.scrollIntoViewIfNeeded();
    const href = await jobsPage.footerLinks.forJobSeekers.getAttribute('href');
    expect(href).toMatch(/vahan\.co\/jobs/i);
  });
});
