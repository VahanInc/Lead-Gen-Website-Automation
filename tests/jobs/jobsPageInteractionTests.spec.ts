import { test, expect } from '../fixtures';
import { JobsPage, WHATSAPP_URL_PATTERN, VAHAN_WHATSAPP_PHONE } from '../../src/pages/JobsPage';

// ============================================================
// LOCATION PROMPT (geolocation is granted as Bengaluru in playwright.config.ts)
// ============================================================
test.describe('Location prompt', () => {
  test('Continue on the detected location applies city and neighbourhood filters', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto('ignore');

    await expect(jobsPage.locationPrompt).toBeVisible({ timeout: 10_000 });
    await expect(jobsPage.locationPrompt).toContainText(/We detected .+, Bengaluru/);

    await jobsPage.handleLocationPrompt('accept');

    await expect(jobsPage.filterCity).toHaveText('Bengaluru');
    await expect(jobsPage.filterNeighbourhood).not.toHaveText('Neighbourhood');
    for (const summary of await jobsPage.cardSummaries()) {
      expect(summary).toMatch(/Bengaluru$/);
    }
  });

  test('declining the detected location keeps the all-India listing', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto('decline');

    await expect(jobsPage.filterCity).toHaveText('City');
    await expect(jobsPage.filterNeighbourhood).toHaveText('Neighbourhood');
    await expect(jobsPage.filterCompany).toHaveText('Company');
    expect(await jobsPage.lastPageNumber()).toBeGreaterThan(100);
  });
});

// ============================================================
// FILTERS — POSITIVE
// ============================================================
test.describe('Filter interactions - positive', () => {
  test('city dropdown opens a searchable list of cities', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.openFilter(jobsPage.filterCity);
    await expect(jobsPage.listboxOptions.first()).toHaveText('All (City)');
    expect(await jobsPage.listboxOptions.count()).toBeGreaterThan(50);

    const search = page.getByRole('combobox').filter({ visible: true }).first();
    await search.fill('Mumb');
    await expect(jobsPage.listboxOptions.filter({ visible: true }).first()).toContainText(/Mumbai/);
    for (const text of await jobsPage.listboxOptions.filter({ visible: true }).allTextContents()) {
      expect(text.toLowerCase()).toMatch(/mumb|^all/);
    }
  });

  test('selecting a city updates every job card to that city', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFilterOption(jobsPage.filterCity, 'Mumbai');

    const summaries = await jobsPage.cardSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) expect(s).toMatch(/, Mumbai$/);
    expect(await jobsPage.lastPageNumber()).toBeLessThan(9203);
  });

  test('selecting a company shows only that company\'s jobs', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFilterOption(jobsPage.filterCompany, 'Zomato');

    const summaries = await jobsPage.cardSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) expect(s).toContain('at Zomato,');
  });

  test('neighbourhood options are scoped to the selected city', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFilterOption(jobsPage.filterCity, 'Mumbai');
    const hood = await jobsPage.selectFilterOption(jobsPage.filterNeighbourhood);

    for (const s of await jobsPage.cardSummaries()) expect(s).toMatch(new RegExp(`${hood.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, Mumbai$`, 'i'));
  });

  test('city + neighbourhood + company filters combine', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto('accept'); // Bengaluru + detected neighbourhood

    await jobsPage.selectFilterOption(jobsPage.filterCompany, 'Zomato');

    const summaries = await jobsPage.cardSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) expect(s).toMatch(/at Zomato, .+, Bengaluru$/);
  });

  test('choosing "All (City)" clears the city filter', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFilterOption(jobsPage.filterCity, 'Mumbai');
    const filteredLast = await jobsPage.lastPageNumber();

    await jobsPage.openFilter(jobsPage.filterCity);
    const reload = jobsPage.waitForListings();
    await jobsPage.openListbox.getByRole('option', { name: 'All (City)' }).click();
    await reload;
    await expect(jobsPage.filterCity).toHaveText('City');
    await expect.poll(() => jobsPage.lastPageNumber()).toBeGreaterThan(filteredLast);
  });
});

// ============================================================
// FILTERS — EDGE CASES
// ============================================================
test.describe('Filter interactions - edge cases', () => {
  test('applying a filter after navigating to page 2 resets listing to page 1', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.goToPage(2);
    await jobsPage.selectFilterOption(jobsPage.filterCity, 'Mumbai');

    await expect(jobsPage.activePage).toHaveText('1');
  });

  test('Escape closes an open filter dropdown', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.openFilter(jobsPage.filterCompany);
    await page.keyboard.press('Escape');

    await expect(jobsPage.filterCompany).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('rapidly switching companies leaves the grid showing the last selection', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.openFilter(jobsPage.filterCompany);
    await jobsPage.openListbox.getByRole('option', { name: 'Zomato', exact: true }).click();
    await jobsPage.openFilter(jobsPage.filterCompany);
    await jobsPage.openListbox.getByRole('option', { name: 'Zepto', exact: true }).click();
    await jobsPage.openFilter(jobsPage.filterCompany);
    const lastResponse = jobsPage.waitForListings();
    await jobsPage.openListbox.getByRole('option', { name: 'Uber', exact: true }).click();
    await lastResponse;

    await expect(jobsPage.filterCompany).toHaveText('Uber');
    await expect.poll(async () => (await jobsPage.cardSummaries()).every(s => s.includes('at Uber,'))).toBe(true);
  });

  test('zero-result filter combination shows no-results state gracefully', async () => {
    // Every city/neighbourhood in the live dataset currently has jobs for at least
    // one company and the UI only offers in-scope options, so no reliable
    // zero-result combination exists. The empty-state copy is
    // "No jobs match those filters yet — try widening your search." (.job-empty).
    test.skip(true, 'Needs a known zero-result filter combination from the dataset');
  });
});

// ============================================================
// PAGINATION
// ============================================================
test.describe('Pagination', () => {
  test('page 2 shows a different batch of 9 jobs and is marked current', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const page1 = await jobsPage.cardSummaries();
    expect(page1).toHaveLength(9);

    await jobsPage.goToPage(2);

    const page2 = await jobsPage.cardSummaries();
    expect(page2).toHaveLength(9);
    expect(page2).not.toEqual(page1);
    await expect(jobsPage.pagination.getByRole('button', { name: '1', exact: true })).not.toHaveAttribute('aria-current', 'page');
  });

  test('last page button navigates to the final page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();
    await jobsPage.selectFilterOption(jobsPage.filterCity, 'Mumbai');

    const last = await jobsPage.lastPageNumber();
    await jobsPage.goToPage(last);

    const count = await jobsPage.knowMoreLinks.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(9);
  });

  test('changing page keeps the job grid in view', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.goToPage(2);
    await expect(jobsPage.jobsHeading.or(jobsPage.knowMoreLinks.first()).first()).toBeInViewport();
  });
});

// ============================================================
// CTA — WHATSAPP
// ============================================================
test.describe('CTA WhatsApp navigation', () => {
  test('hero Apply on WhatsApp links to Vahan WhatsApp with a delivery-job message', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const href = (await jobsPage.heroApplyLink.getAttribute('href')) ?? '';
    expect(href).toMatch(WHATSAPP_URL_PATTERN);
    expect(href).toContain(VAHAN_WHATSAPP_PHONE);
    expect(decodeURIComponent(href)).toContain('apply for the delivery job');
  });

  test('clicking hero Apply on WhatsApp navigates to WhatsApp', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();
    const getUrl = await jobsPage.interceptWhatsAppNavigation();

    await jobsPage.heroApplyLink.click();

    await expect.poll(getUrl, { timeout: 10_000 }).toMatch(WHATSAPP_URL_PATTERN);
    expect(getUrl()).toContain(VAHAN_WHATSAPP_PHONE);
  });

  test('job card Apply Now pre-fills the role, company and location', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const count = await jobsPage.applyNowLinks.count();
    const summaries = await jobsPage.cardSummaries();
    for (let i = 0; i < count; i++) {
      const link = jobsPage.applyNowLinks.nth(i);
      const href = decodeURIComponent((await link.getAttribute('href')) ?? '');
      // summary: "<Company> <Role> at <Company>, <Area>, <City>"
      const [, company, location] = summaries[i].match(/ at ([^,]+), (.+)$/) ?? [];
      expect(href).toContain(VAHAN_WHATSAPP_PHONE);
      expect(href, `card ${i}`).toContain(`for ${company} in ${location}`);
    }
  });

  test('job card Apply Now opens WhatsApp in a new tab safely', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const link = jobsPage.applyNowLinks.first();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);

    const getUrl = await jobsPage.interceptWhatsAppNavigation();
    const popup = page.waitForEvent('popup');
    await link.click();
    await (await popup).close();
    await expect.poll(getUrl, { timeout: 10_000 }).toMatch(WHATSAPP_URL_PATTERN);
  });

  test('bottom CTA Apply on WhatsApp navigates to WhatsApp', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();
    const getUrl = await jobsPage.interceptWhatsAppNavigation();

    await jobsPage.bottomApplyLink.scrollIntoViewIfNeeded();
    await jobsPage.bottomApplyLink.click();

    await expect.poll(getUrl, { timeout: 10_000 }).toMatch(WHATSAPP_URL_PATTERN);
  });
});

// ============================================================
// KNOW MORE → DETAIL
// ============================================================
test.describe('Job card navigation', () => {
  test('Know More opens the detail page for that job', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const link = jobsPage.knowMoreLinks.first();
    const href = (await link.getAttribute('href')) ?? '';
    const title = ((await jobsPage.jobCardTitles.first().textContent()) ?? '').trim();
    await link.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
  });
});

// ============================================================
// LANGUAGE SWITCHING
// ============================================================
test.describe('Language switching', () => {
  test('switching to Hindi changes hero heading to Devanagari script', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('hindi');

    await expect(jobsPage.heroHeading).toHaveText(/[ऀ-ॿ]/);
    await expect(jobsPage.header.languageButton).toHaveText(/हिंदी/);
  });

  test('switching to Tamil changes hero heading to Tamil script', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('tamil');

    await expect(jobsPage.heroHeading).toHaveText(/[஀-௿]/);
  });

  test('switching to Kannada changes hero heading to Kannada script', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('kannada');

    await expect(jobsPage.heroHeading).toHaveText(/[ಀ-೿]/);
  });

  test('switching language also translates the job cards', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('hindi');

    await expect(jobsPage.jobCardTitles.first()).toHaveText(/[ऀ-ॿ]/);
  });

  test('switching back to English from Hindi restores the English heading', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('hindi');
    await jobsPage.switchLanguage('english');

    await expect(jobsPage.heroHeading).toHaveText(/Find your perfect delivery job/i);
  });

  test('selected language persists after a reload', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('hindi');
    await page.reload();

    await expect(jobsPage.heroHeading).toHaveText(/[ऀ-ॿ]/);
  });

  test('language switch with an active filter does not break the listing', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.selectFilterOption(jobsPage.filterCity, 'Mumbai');
    await jobsPage.switchLanguage('hindi');

    await expect(jobsPage.knowMoreLinks.first()).toBeVisible();
    expect(await jobsPage.knowMoreLinks.count()).toBeGreaterThan(0);
  });

  test('long translated strings do not overflow the layout', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.switchLanguage('tamil');

    await expect(jobsPage.header.root).toBeVisible();
    await expect(jobsPage.header.languageButton).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// ============================================================
// FAQ ACCORDION (single-open)
// ============================================================
test.describe('FAQ accordion behavior', () => {
  test('first FAQ is expanded by default and the rest are collapsed', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await expect(jobsPage.faqButtons.rolesAvailable).toHaveAttribute('aria-expanded', 'true');
    await expect(jobsPage.faqButtons.ownVehicle).toHaveAttribute('aria-expanded', 'false');
    await expect(jobsPage.faqButtons.fullTimeOrFlexible).toHaveAttribute('aria-expanded', 'false');
    await expect(jobsPage.faqButtons.priorExperience).toHaveAttribute('aria-expanded', 'false');
  });

  test('opening a question shows its answer and collapses the previously open one', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const { rolesAvailable, ownVehicle } = jobsPage.faqButtons;
    await ownVehicle.scrollIntoViewIfNeeded();
    await ownVehicle.click();

    await expect(ownVehicle).toHaveAttribute('aria-expanded', 'true');
    await expect(rolesAvailable).toHaveAttribute('aria-expanded', 'false');
    await expect(jobsPage.faqAnswer(ownVehicle)).toContainText('two-wheeler');
  });

  test('clicking an open question again collapses it', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const btn = jobsPage.faqButtons.rolesAvailable;
    await btn.scrollIntoViewIfNeeded();
    await btn.click();

    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  test('each FAQ question can be individually opened', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    for (const [key, btn] of Object.entries(jobsPage.faqButtons)) {
      await btn.scrollIntoViewIfNeeded();
      if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
      await expect(btn, `${key} should expand`).toHaveAttribute('aria-expanded', 'true');
      await expect(jobsPage.faqAnswer(btn), `${key} answer`).toBeVisible();
    }
  });
});

// ============================================================
// TESTIMONIAL CAROUSEL
// ============================================================
test.describe('Testimonial carousel', () => {
  const inView = (jobsPage: JobsPage) =>
    jobsPage.testimonials.evaluateAll(figs =>
      figs
        .filter(f => {
          const r = f.getBoundingClientRect();
          return r.width > 0 && r.left >= -1 && r.right <= window.innerWidth + 1;
        })
        .map(f => f.querySelector('blockquote')?.textContent?.trim() ?? ''),
    );

  test('page 1 dot is active on load', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.testimonialsHeading.scrollIntoViewIfNeeded();
    await expect(jobsPage.testimonialDots.nth(0)).toHaveClass(/active/);
    await expect(jobsPage.testimonialDots.nth(1)).not.toHaveClass(/active/);
  });

  test('clicking the page 2 dot shows a different set of testimonials', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.testimonialsHeading.scrollIntoViewIfNeeded();
    const before = await inView(jobsPage);
    await jobsPage.testimonialDots.nth(1).click();

    await expect(jobsPage.testimonialDots.nth(1)).toHaveClass(/active/);
    await expect.poll(() => inView(jobsPage)).not.toEqual(before);
  });

  test('clicking page 2 then page 1 returns to the first testimonials', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.testimonialsHeading.scrollIntoViewIfNeeded();
    const first = await inView(jobsPage);
    await jobsPage.testimonialDots.nth(1).click();
    await expect.poll(() => inView(jobsPage)).not.toEqual(first);
    await jobsPage.testimonialDots.nth(0).click();

    await expect.poll(() => inView(jobsPage)).toEqual(first);
  });
});

// ============================================================
// HEADER NAVIGATION
// ============================================================
test.describe('Header navigation', () => {
  test('hovering each menu reveals its links', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();
    const { header } = jobsPage;

    await header.menus.solutions.hover();
    await expect(header.menuLinks.forCorporates).toBeVisible();
    await expect(header.menuLinks.forRecruitmentAgencies).toBeVisible();
    await expect(header.menuLinks.forJobSeekers).toBeVisible();

    await header.menus.company.hover();
    await expect(header.menuLinks.careers).toBeVisible();
    await expect(header.menuLinks.newsroom).toBeVisible();

    await header.menus.resources.hover();
    await expect(header.menuLinks.recruitmentAgencyStories).toBeVisible();
    await expect(header.menuLinks.riderHub).toBeVisible();
  });

  test('Rider Hub link in the Resources menu opens the Rider Hub', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await jobsPage.header.navigateViaMenu('resources', 'riderHub');

    await expect(page).toHaveURL(/\/rider-adda\/$/);
  });

  test('logo links back to the home page', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await expect(jobsPage.header.logo).toHaveAttribute('href', '/');
  });
});

// ============================================================
// FOOTER LINKS
// ============================================================
test.describe('Footer link navigation', () => {
  const expected: Record<string, RegExp | string> = {
    forCorporates: '/corporate/',
    forRecruitmentAgencies: '/recruitment-agencies/',
    forJobSeekers: '/jobs/',
    careers: '/careers/',
    newsroom: '/newsroom/',
    recruitmentAgencyStories: '/partner-stories/',
    riderHub: '/rider-adda/',
    caseStudies: '/case-studies/',
    email: 'mailto:info@vahan.ai',
    privacyPolicy: /vahan\.ai\/privacy-policy\.html$/,
    termsAndConditions: /vahan\.ai\/terms-of-use\.html$/,
    linkedIn: /linkedin\.com\/company\/vahan/,
    youTube: /youtube\.com\/@VahanDeliveryJobs/,
  };

  test('every footer link points to the right destination', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    for (const [key, href] of Object.entries(expected)) {
      await expect(jobsPage.footer.links[key], key).toHaveAttribute('href', href);
    }
  });

  test('Privacy Policy and Terms pages load', async ({ page, request }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    for (const key of ['privacyPolicy', 'termsAndConditions']) {
      const href = (await jobsPage.footer.links[key].getAttribute('href'))!;
      const res = await request.get(href);
      expect(res.status(), key).toBe(200);
    }
  });
});

// ============================================================
// KNOWN ISSUES — marked test.fail() so CI stays green but flags when they're fixed
// ============================================================
test.describe('Known issues', () => {
  test('jobs heading count matches the real number of listings', async ({ page, request }) => {
    test.fail(true, 'BUG: heading shows "9,200+" (≈ totalPages) while the API reports ~82,800 jobs');
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const headingText = (await jobsPage.jobsHeading.textContent()) ?? '';
    const shown = parseInt(headingText.replace(/[^\d]/g, ''), 10);
    const api = await (await request.get('/jobs/api/listings/?page=1')).json();

    expect(api.total).toBeGreaterThanOrEqual(shown);
    expect(api.total).toBeLessThan(shown * 1.5);
  });

  test('company and city filters have no duplicate options', async ({ page }) => {
    test.fail(true, 'BUG: "Swiggy" (swiggy / swiggy-soc) and "Bengaluru" (bangalore / bengaluru) appear twice; "Delhi NCR" vs "Delhi Ncr"');
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    for (const trigger of [jobsPage.filterCompany, jobsPage.filterCity]) {
      await jobsPage.openFilter(trigger);
      const names = (await jobsPage.listboxOptions.allTextContents()).map(t => t.trim().toLowerCase());
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      expect(dupes, 'duplicate options').toEqual([]);
      await page.keyboard.press('Escape');
    }
  });
});
