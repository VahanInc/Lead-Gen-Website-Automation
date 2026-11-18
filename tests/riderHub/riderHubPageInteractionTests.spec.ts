import { test, expect } from '../fixtures';
import { RiderHubPage, VideoDetailPage } from '../../src/pages/RiderHubPage';
import { VAHAN_WHATSAPP_PHONE, WHATSAPP_URL_PATTERN } from '../../src/constants/urls';

// ============================================================
// VIDEO CATEGORY TABS
// ============================================================
test.describe('Video category filters', () => {
  test('selecting a category marks only that tab as selected', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.selectCategory('education');

    await expect(riderHubPage.selectedTab).toHaveCount(1);
    await expect(riderHubPage.selectedTab).toHaveText('Education');
    await expect(riderHubPage.categoryTabs.all).toHaveAttribute('aria-selected', 'false');
  });

  test('every category shows only videos tagged with it', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const categories: Record<string, string> = {
      comedy: 'Comedy',
      education: 'Education',
      entertainment: 'Entertainment',
      healthWellness: 'Health & Wellness',
      investment: 'Investment',
      series: 'Series',
      socialAwareness: 'Social Awareness',
      technology: 'Technology',
      tipsTricks: 'Tips & Tricks',
    };
    for (const [key, label] of Object.entries(categories)) {
      await riderHubPage.selectCategory(key);
      const texts = await riderHubPage.visibleVideoTexts();
      expect(texts.length, `${label} has videos`).toBeGreaterThan(0);
      for (const t of texts) expect(t, `${label} card tags`).toContain(label);
    }
  });

  test('clicking All after a category restores the first page of all videos', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const initial = await riderHubPage.visibleVideoHrefs();

    await riderHubPage.selectCategory('investment');
    await riderHubPage.selectCategory('all');

    expect(await riderHubPage.visibleVideoHrefs()).toEqual(initial);
  });

  test('switching category resets the grid to page 1', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.nextPage.click();
    await expect(riderHubPage.currentVideoPage).toHaveText('2');
    await riderHubPage.selectCategory('comedy');

    await expect(riderHubPage.currentVideoPage).toHaveText('1');
    await expect(riderHubPage.previousPage).toBeDisabled();
  });

  test('rapid filter switching does not leave the page broken', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.categoryTabs.education.click();
    await riderHubPage.categoryTabs.comedy.click();
    await riderHubPage.categoryTabs.technology.click();
    await riderHubPage.categoryTabs.series.click();

    await expect(riderHubPage.selectedTab).toHaveText('Series');
    for (const t of await riderHubPage.visibleVideoTexts()) expect(t).toContain('Series');
  });
});

// ============================================================
// VIDEO PAGER
// ============================================================
test.describe('Video pagination', () => {
  test('Next shows a different set of 4 videos and enables Previous', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const page1 = await riderHubPage.visibleVideoHrefs();

    await riderHubPage.nextPage.click();

    await expect(riderHubPage.currentVideoPage).toHaveText('2');
    await expect(riderHubPage.previousPage).toBeEnabled();
    const page2 = await riderHubPage.visibleVideoHrefs();
    expect(page2).toHaveLength(4);
    expect(page2.filter(h => page1.includes(h))).toEqual([]);
  });

  test('Previous returns to the earlier page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const page1 = await riderHubPage.visibleVideoHrefs();

    await riderHubPage.nextPage.click();
    await riderHubPage.previousPage.click();

    await expect(riderHubPage.currentVideoPage).toHaveText('1');
    expect(await riderHubPage.visibleVideoHrefs()).toEqual(page1);
  });

  test('numbered page buttons jump directly to that page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.videoPager.getByRole('button', { name: 'Page 3' }).click();

    await expect(riderHubPage.currentVideoPage).toHaveText('3');
    expect(await riderHubPage.videoCards.count()).toBeGreaterThan(0);
  });
});

// ============================================================
// VIDEO CARD NAVIGATION
// ============================================================
test.describe('Video card navigation', () => {
  test('clicking a video card navigates to its detail page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const href = (await riderHubPage.videoCards.first().getAttribute('href'))!;
    await riderHubPage.videoCards.first().click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('featured video opens its detail page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const href = (await riderHubPage.featuredVideo.getAttribute('href'))!;
    expect(href).not.toBe('/rider-adda/');
    await riderHubPage.featuredVideo.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('browser back from detail page returns to RiderHub listing', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.videoCards.first().click();
    await page.waitForURL(/\/rider-adda\/.+\/$/);
    await page.goBack();

    await expect(page).toHaveURL(/\/rider-adda\/$/);
    await expect(riderHubPage.heroHeading).toBeVisible();
    await expect(riderHubPage.videoCards.first()).toBeVisible();
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
    await page.waitForURL(/\/rider-adda\/.+\/$/);
  });

  test('shows title, view count, category tags and description', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    await detail.verifyAllWithHighlight({
      playButton: detail.playButton,
      videoTitle: detail.videoTitle,
      viewCount: detail.viewCount,
      description: detail.descriptionRegion,
      applyOnWhatsApp: detail.applyOnWhatsAppLink,
      moreVideos: detail.moreVideos,
    });
    expect(((await detail.videoTitle.textContent()) ?? '').trim().length).toBeGreaterThan(0);
    expect(await detail.categoryTags.count()).toBeGreaterThan(0);
    await expect(detail.viewCount).toHaveText(/[\d.]+[kKmM]? views/);
  });

  test('clicking play mounts the YouTube player', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    await detail.playButton.click();
    await expect(detail.youtubeIframe).toBeVisible({ timeout: 10_000 });
  });

  test('Apply on WhatsApp button navigates to WhatsApp', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const getUrl = await detail.interceptWhatsAppNavigation();

    await detail.applyOnWhatsAppLink.scrollIntoViewIfNeeded();
    await detail.applyOnWhatsAppLink.click();

    await expect.poll(getUrl, { timeout: 10_000 }).toMatch(WHATSAPP_URL_PATTERN);
    expect(getUrl()).toContain(VAHAN_WHATSAPP_PHONE);
  });

  test('switching description language to Hindi shows Devanagari text', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    await expect(detail.transcriptTabs.english).toHaveAttribute('aria-selected', 'true');

    await detail.transcriptTabs.hindi.click();

    await expect(detail.transcriptTabs.hindi).toHaveAttribute('aria-selected', 'true');
    await expect(detail.transcriptPanel.filter({ visible: true })).toHaveText(/[ऀ-ॿ]/);
  });

  test('every transcript language shows text in its own script', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const scripts: Record<string, RegExp> = {
      hindi: /[ऀ-ॿ]/,
      tamil: /[஀-௿]/,
      kannada: /[ಀ-೿]/,
      telugu: /[ఀ-౿]/,
      english: /[A-Za-z]{3,}/,
    };
    for (const [lang, script] of Object.entries(scripts)) {
      const tab = detail.transcriptTabs[lang];
      if (!(await tab.isVisible())) continue; // not every video has every translation
      await tab.click();
      await expect(detail.transcriptPanel.filter({ visible: true }), lang).toHaveText(script);
    }
  });

  test('clicking a More Videos card navigates to a different detail page', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    const currentPath = new URL(page.url()).pathname;

    const card = detail.moreVideoCards.first();
    const href = (await card.getAttribute('href'))!;
    expect(href).not.toBe(currentPath);
    await card.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('See all videos and Browse delivery jobs links work', async ({ page }) => {
    const detail = new VideoDetailPage(page);
    await expect(detail.seeAllVideosLink).toHaveAttribute('href', '/rider-adda/');
    await detail.browseJobsLink.click();
    await expect(page).toHaveURL(/\/jobs\/$/);
  });
});

// ============================================================
// JOBS NEAR YOU / BLOG
// ============================================================
test.describe('Jobs Near You', () => {
  test('BROWSE ALL JOBS navigates to the jobs listing page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.browseAllJobsLink.scrollIntoViewIfNeeded();
    await riderHubPage.browseAllJobsLink.click();

    await expect(page).toHaveURL(/\/jobs\/$/);
  });

  test('job card Apply Now links go to Vahan WhatsApp', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    for (const href of await riderHubPage.jobApplyLinks.evaluateAll(as => as.map(a => a.getAttribute('href') ?? ''))) {
      expect(href).toMatch(WHATSAPP_URL_PATTERN);
      expect(href).toContain(VAHAN_WHATSAPP_PHONE);
    }
  });
});

test.describe('Blog section', () => {
  test('clicking a blog card navigates to its post', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const card = riderHubPage.blogCards.first();
    await card.scrollIntoViewIfNeeded();
    const href = (await card.getAttribute('href'))!;
    await card.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('View all blogs navigates to the blog listing page', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.viewAllBlogsLink.scrollIntoViewIfNeeded();
    await riderHubPage.viewAllBlogsLink.click();

    await expect(page).toHaveURL(/\/blog\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Delivery Job Tips/i);
  });
});

// ============================================================
// ALERT ME FORM — POSITIVE
// ============================================================
test.describe('Alert Me form - positive', () => {
  test('area + valid phone opens Vahan WhatsApp with an alert message', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const getUrl = await riderHubPage.interceptWhatsAppNavigation();

    await riderHubPage.areaNameInput.fill('Koramangala');
    await riderHubPage.alertWhatsAppInput.pressSequentially('9876543210', { delay: 30 });
    await riderHubPage.alertSubmitButton.click();

    await expect.poll(getUrl, { timeout: 10_000 }).toMatch(WHATSAPP_URL_PATTERN);
    const decoded = decodeURIComponent(getUrl());
    expect(decoded).toContain(VAHAN_WHATSAPP_PHONE);
    expect(decoded).toContain('Koramangala');
    expect(decoded).toContain('9876543210');
  });

});

// ============================================================
// ALERT ME FORM — VALIDATION (NEGATIVE)
// ============================================================
test.describe('Alert Me form - validation', () => {
  const expectNoWhatsApp = async (getUrl: () => string, page: import('@playwright/test').Page) => {
    await page.waitForTimeout(1500);
    expect(getUrl()).toBe('');
    await expect(page).toHaveURL(/\/rider-adda\/$/);
  };

  test('empty phone does not navigate to WhatsApp', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const getUrl = await riderHubPage.interceptWhatsAppNavigation();

    await riderHubPage.areaNameInput.fill('Koramangala');
    await riderHubPage.alertSubmitButton.click();

    await expectNoWhatsApp(getUrl, page);
  });

  test('valid phone without an area name does not submit (area is required)', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const getUrl = await riderHubPage.interceptWhatsAppNavigation();

    await riderHubPage.alertWhatsAppInput.pressSequentially('9876543210', { delay: 30 });
    await riderHubPage.alertSubmitButton.click();

    await expectNoWhatsApp(getUrl, page);
  });

  test('phone shorter than 10 digits does not submit', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const getUrl = await riderHubPage.interceptWhatsAppNavigation();

    await riderHubPage.alertWhatsAppInput.fill('98765');
    await riderHubPage.alertSubmitButton.click();

    await expectNoWhatsApp(getUrl, page);
  });

  test('phone not starting with 6-9 does not submit', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();
    const getUrl = await riderHubPage.interceptWhatsAppNavigation();

    await riderHubPage.alertWhatsAppInput.fill('5876543210');
    await riderHubPage.alertSubmitButton.click();

    await expectNoWhatsApp(getUrl, page);
  });

  test('non-numeric characters are stripped from the phone field', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.alertWhatsAppInput.pressSequentially('abcde12345');

    await expect(riderHubPage.alertWhatsAppInput).toHaveValue('12345');
  });

  test('phone with internal space strips the space', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.alertWhatsAppInput.pressSequentially('98765 43210');

    await expect(riderHubPage.alertWhatsAppInput).toHaveValue('9876543210');
  });

  test('phone longer than 10 digits is capped at 10', async ({ page }) => {
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await riderHubPage.alertWhatsAppInput.pressSequentially('987654321012');

    await expect(riderHubPage.alertWhatsAppInput).toHaveValue('9876543210');
  });
});

// ============================================================
// KNOWN ISSUES
// ============================================================
test.describe('Known issues', () => {
  test('Rider Hub listing has its own page title and description', async ({ page }) => {
    test.fail(true, 'BUG: /rider-adda/ <title> and meta description are copied from the featured video');
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    const featuredTitle = ((await riderHubPage.featuredVideo.getByRole('paragraph').first().textContent()) ?? '').trim();
    expect(await page.title()).not.toBe(featuredTitle);
  });
});
