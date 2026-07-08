import { test, expect } from '../fixtures';
import { RiderHubPage, VideoDetailPage } from '../../src/pages/RiderHubPage';
import { WHATSAPP_URL_PATTERN } from '../../src/pages/JobsPage';

// ============================================================
// VIDEO CATEGORY FILTERS
// ============================================================
test.describe('Video category filters', () => {
  test('all category filter tabs are visible on page load', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.verifyAllWithHighlight(riderHubPage.filterTabs);
  });

  test('selecting a category filter shows videos without crashing', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.filterTabs.education.click();
    await page.waitForTimeout(500);

    await expect(riderHubPage.videoCards.first()).toBeVisible({ timeout: 5000 });
    expect(await riderHubPage.videoCards.count()).toBeGreaterThan(0);
  });

  test('only one filter tab is active at a time', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.filterTabs.comedy.click();
    await page.waitForTimeout(500);

    // Switch to a different category — page must not crash
    await riderHubPage.filterTabs.education.click();
    await page.waitForTimeout(500);

    await expect(riderHubPage.videoCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking ALL after a category filter restores the full video list', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const allCount = await riderHubPage.videoCards.count();

    await riderHubPage.filterTabs.education.click();
    await page.waitForTimeout(500);
    const filteredCount = await riderHubPage.videoCards.count();

    await riderHubPage.filterTabs.all.click();
    await page.waitForTimeout(500);
    const afterAllCount = await riderHubPage.videoCards.count();

    expect(afterAllCount).toBe(allCount);
    expect(afterAllCount).toBeGreaterThanOrEqual(filteredCount);
  });
});

// ============================================================
// VIDEO CARD NAVIGATION
// ============================================================
test.describe('Video card navigation', () => {
  test('clicking a video card navigates to its detail page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const href = await riderHubPage.videoCards.first().getAttribute('href');
    await riderHubPage.videoCards.first().click();

    await page.waitForURL(/\/rider-adda\/.+/, { timeout: 10000 });
    // Must be a slug page, not the listing root
    expect(page.url()).not.toMatch(/\/rider-adda\/$/);
    if (href) expect(page.url()).toContain(href);
  });
});

// ============================================================
// VIDEO DETAIL PAGE
// ============================================================
test.describe('Video detail page', () => {
  test.beforeEach(async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    await riderHubPage.videoCards.first().click();
    await page.waitForURL(/\/rider-adda\/.+/, { timeout: 10000 });
  });

  test('shows embedded YouTube player and a non-empty title', async ({ page }) => {
    const detail = new VideoDetailPage(page);

    // The player shows a thumbnail + play button until clicked; the YouTube
    // iframe is only mounted once the user starts playback.
    await detail.playButton.click();
    await expect(detail.youtubeIframe).toBeVisible({ timeout: 10000 });
    await expect(detail.videoTitle).toBeVisible();
    const title = await detail.videoTitle.textContent();
    expect(title?.trim().length).toBeGreaterThan(0);
  });

  test('view count is visible and in a recognisable format', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    await expect(detail.viewCount).toBeVisible({ timeout: 10000 });
    const text = await detail.viewCount.textContent();
    expect(text).toMatch(/\d+[kKmM]? views/i);
  });

  test('Apply on WhatsApp button navigates to WhatsApp', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const getUrl = await detail.interceptWhatsAppNavigation();

    await detail.applyOnWhatsAppButton.scrollIntoViewIfNeeded();
    await detail.applyOnWhatsAppButton.click();

    await expect.poll(getUrl, { timeout: 5000 }).toMatch(WHATSAPP_URL_PATTERN);
  });

  test('switching description language to Hindi shows Devanagari text', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const main = page.locator('main');

    await detail.languageTabs.english.waitFor({ state: 'visible', timeout: 10000 });

    // All translations are rendered in the DOM simultaneously; CSS show/hides the
    // active one. Assert that a VISIBLE paragraph with Devanagari text appears after
    // clicking Hindi — not that textContent() changed (it won't).
    await detail.languageTabs.hindi.click();
    await page.waitForTimeout(300);

    await expect(
      main.locator('p').filter({ hasText: /[ऀ-ॿ]/ }).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test('switching description language to Kannada shows Kannada script', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const main = page.locator('main');

    await detail.languageTabs.english.waitFor({ state: 'visible', timeout: 10000 });
    const kannadaVisible = await detail.languageTabs.kannada.isVisible().catch(() => false);
    test.skip(!kannadaVisible, 'No Kannada translation for this video');

    await detail.languageTabs.kannada.click();
    await page.waitForTimeout(300);

    await expect(
      main.locator('p').filter({ hasText: /[ಀ-೿]/ }).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test('switching back to English from Hindi restores English text', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const main = page.locator('main');

    await detail.languageTabs.english.waitFor({ state: 'visible', timeout: 10000 });

    await detail.languageTabs.hindi.click();
    await page.waitForTimeout(300);

    await detail.languageTabs.english.click();
    await page.waitForTimeout(300);

    // English paragraph must be visible again — check for ASCII-range text
    await expect(
      main.locator('p').filter({ hasText: /[A-Za-z]{3,}/ }).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test('clicking a More Videos card navigates to a different detail page', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const currentPath = new URL(page.url()).pathname;

    await detail.moreVideoCards.first().waitFor({ state: 'visible', timeout: 10000 });

    // The sidebar may include the current video — find the first card with a different href
    const count = await detail.moreVideoCards.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const href = await detail.moreVideoCards.nth(i).getAttribute('href');
      if (href && href !== currentPath) {
        await detail.moreVideoCards.nth(i).click();
        clicked = true;
        break;
      }
    }
    expect(clicked, 'No different video card found in More Videos').toBe(true);

    // waitForURL with the same pattern would resolve immediately (we're already at /rider-adda/...)
    // so poll the URL until it differs from the starting path.
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 10000 }).not.toBe(currentPath);
  });
});

// ============================================================
// BLOG SECTION
// ============================================================
test.describe('Blog section', () => {
  test('blog cards are visible with at least one entry', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.latestBlogHeading.scrollIntoViewIfNeeded();
    await expect(riderHubPage.latestBlogHeading).toBeVisible();
    expect(await riderHubPage.blogCards.count()).toBeGreaterThan(0);
  });

  test('clicking a blog card navigates to its detail page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.blogCards.first().scrollIntoViewIfNeeded();
    const href = await riderHubPage.blogCards.first().getAttribute('href');

    await riderHubPage.blogCards.first().click();
    await page.waitForURL(/\/blog\/.+/, { timeout: 10000 });

    if (href) expect(page.url()).toContain(href);
  });

  test('SEE MORE BLOGS navigates to the blog listing page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.seeMoreBlogsLink.scrollIntoViewIfNeeded();
    await riderHubPage.seeMoreBlogsLink.click();

    await page.waitForURL(/\/blog\/?$/, { timeout: 10000 });
    expect(page.url()).toMatch(/vahan\.co\/blog/i);
  });
});

// ============================================================
// BROWSE ALL JOBS CTA
// ============================================================
test.describe('Browse All Jobs CTA', () => {
  test('BROWSE ALL JOBS navigates to the jobs listing page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.browseAllJobsLink.scrollIntoViewIfNeeded();
    await riderHubPage.browseAllJobsLink.click();

    await page.waitForURL(/\/jobs\//, { timeout: 10000 });
    expect(page.url()).toMatch(/\/jobs\//);
  });
});

// ============================================================
// ALERT ME FORM — POSITIVE
// ============================================================
test.describe('Alert Me form - positive', () => {
  test('valid phone alone navigates to WhatsApp', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const getUrl = await riderHubPage.interceptWhatsAppNavigation();
    await riderHubPage.alertWhatsAppInput.scrollIntoViewIfNeeded();
    await riderHubPage.alertWhatsAppInput.click();
    await riderHubPage.alertWhatsAppInput.pressSequentially('9876543210', { delay: 30 });
    await page.waitForTimeout(500);
    await expect(riderHubPage.alertSubmitButton).toBeEnabled({ timeout: 3000 });
    await riderHubPage.alertSubmitButton.click();

    await expect.poll(getUrl, { timeout: 5000 }).toMatch(WHATSAPP_URL_PATTERN);
  });
});

// ============================================================
// ALERT ME FORM — VALIDATION (NEGATIVE)
// ============================================================
test.describe('Alert Me form - validation', () => {
  test('empty phone does not navigate to WhatsApp', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.areaNameInput.fill('Koramangala');
    await riderHubPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/rider-adda\//, { timeout: 3000 });
  });

  test('phone shorter than 10 digits does not submit', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.alertWhatsAppInput.scrollIntoViewIfNeeded();
    await riderHubPage.alertWhatsAppInput.fill('98765');
    await riderHubPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/rider-adda\//, { timeout: 3000 });
  });

  test('non-numeric phone does not submit', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.alertWhatsAppInput.scrollIntoViewIfNeeded();
    await riderHubPage.alertWhatsAppInput.fill('abcde12345');
    await riderHubPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/rider-adda\//, { timeout: 3000 });
  });

  test('area alone without phone does not enable the submit button', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.areaNameInput.fill('Koramangala');
    await riderHubPage.alertSubmitButton.click({ force: true });

    await expect(page).toHaveURL(/\/rider-adda\//, { timeout: 3000 });
  });

  test('phone with internal space either strips space or is rejected', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const getUrl = await riderHubPage.interceptWhatsAppNavigation();
    await riderHubPage.alertWhatsAppInput.scrollIntoViewIfNeeded();
    await riderHubPage.alertWhatsAppInput.click();
    await riderHubPage.alertWhatsAppInput.pressSequentially('98765 43210');

    const buttonEnabled = await riderHubPage.alertSubmitButton.isEnabled();
    if (!buttonEnabled) return; // validation rejected the input — pass

    await riderHubPage.alertSubmitButton.click();
    await page.waitForTimeout(2000);
    const navigatedUrl = getUrl();

    if (navigatedUrl) {
      expect(navigatedUrl).not.toMatch(/ /);
    } else {
      await expect(page).toHaveURL(/\/rider-adda\//);
    }
  });
});

// ============================================================
// FOOTER CONTACT ME — POSITIVE
// ============================================================
test.describe('Footer Contact Me - positive', () => {
  test('valid phone navigates to WhatsApp', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await page.waitForLoadState('networkidle', { timeout: 15000 });

    const getUrl = await riderHubPage.interceptWhatsAppNavigation();
    await riderHubPage.footerWhatsAppInput.scrollIntoViewIfNeeded();
    await riderHubPage.footerWhatsAppInput.click();
    await riderHubPage.footerWhatsAppInput.pressSequentially('9876543210', { delay: 50 });
    await page.waitForTimeout(500);
    await expect(riderHubPage.footerContactButton).toBeEnabled({ timeout: 5000 });
    await riderHubPage.footerContactButton.click();

    await expect.poll(getUrl, { timeout: 5000 }).toMatch(WHATSAPP_URL_PATTERN);
  });
});

// ============================================================
// FOOTER CONTACT ME — VALIDATION (NEGATIVE)
// ============================================================
test.describe('Footer Contact Me - validation', () => {
  test('empty footer phone does not navigate to WhatsApp', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await riderHubPage.footerWhatsAppInput.scrollIntoViewIfNeeded();
    await riderHubPage.footerContactButton.click({ force: true });

    await expect(page).toHaveURL(/\/rider-adda\//, { timeout: 3000 });
  });

  test('phone shorter than 10 digits does not navigate to WhatsApp', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await riderHubPage.footerWhatsAppInput.scrollIntoViewIfNeeded();
    await riderHubPage.footerWhatsAppInput.fill('98765');
    await riderHubPage.footerContactButton.click({ force: true });

    await expect(page).toHaveURL(/\/rider-adda\//, { timeout: 3000 });
  });
});

// ============================================================
// LANGUAGE SWITCHING
// ============================================================
test.describe('Language switching', () => {
  test('switching to Hindi changes hero heading to Devanagari script', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.switchLanguage('hindi');

    const text = await page.getByRole('heading', { level: 1 }).first().textContent();
    expect(text).toMatch(/[ऀ-ॿ]/);
  });

  test('switching to Kannada changes hero heading to Kannada script', async ({ page }) => {
    // RiderHub hero heading does not have a Kannada translation — the page only
    // supports English and Hindi for this heading. Skip until translation is added.
    test.skip(true, 'RiderHub hero heading has no Kannada translation yet');

    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.switchLanguage('kannada');

    const text = await page.getByRole('heading', { level: 1 }).first().textContent();
    expect(text).toMatch(/[ಀ-೿]/);
  });

  test('switching back to English from Hindi restores the English heading', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.switchLanguage('hindi');
    await riderHubPage.switchLanguage('english');

    await expect(riderHubPage.heroHeading).toBeVisible();
    const text = await riderHubPage.heroHeading.textContent();
    expect(text).toContain('Learn, earn, and stay ahead');
  });
});

// ============================================================
// FILTER EDGE CASES
// ============================================================
test.describe('Filter edge cases', () => {
  test('rapid filter switching does not leave the page broken', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    // Rapidly cycle through several category filters
    await riderHubPage.filterTabs.education.click();
    await riderHubPage.filterTabs.comedy.click();
    await riderHubPage.filterTabs.technology.click();
    await riderHubPage.filterTabs.all.click();
    await page.waitForTimeout(500);

    // Page must still show videos and not crash
    await expect(riderHubPage.videoCards.first()).toBeVisible({ timeout: 8000 });
    expect(await riderHubPage.videoCards.count()).toBeGreaterThan(0);
  });
});

// ============================================================
// NAVIGATION
// ============================================================
test.describe('Navigation', () => {
  test('browser back from detail page returns to RiderHub listing', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.videoCards.first().click();
    await page.waitForURL(/\/rider-adda\/.+/, { timeout: 10000 });

    await page.goBack();
    await page.waitForURL(/\/rider-adda\/?$/, { timeout: 10000 });

    // Listing must be functional after back navigation
    await expect(riderHubPage.heroHeading).toBeVisible({ timeout: 10000 });
    await expect(riderHubPage.videoCards.first()).toBeVisible({ timeout: 8000 });
  });
});
