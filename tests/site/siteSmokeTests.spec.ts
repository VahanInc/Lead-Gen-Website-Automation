import { test, expect } from '../fixtures';
import { ROUTES } from '../../src/constants/urls';
import { HomePage } from '../../src/pages/HomePage';
import { JobsPage } from '../../src/pages/JobsPage';
import { BasePage } from '../../src/pages/BasePage';

const PAGES: Record<string, string> = {
  home: ROUTES.home,
  corporate: ROUTES.corporate,
  recruitmentAgencies: ROUTES.recruitmentAgencies,
  careers: ROUTES.careers,
  newsroom: ROUTES.newsroom,
  partnerStories: ROUTES.partnerStories,
  caseStudies: ROUTES.caseStudies,
  contact: ROUTES.contact,
  jobs: ROUTES.jobs,
  riderHub: ROUTES.riderHub,
  blog: ROUTES.blog,
};

// ============================================================
// EVERY TOP-LEVEL PAGE LOADS CLEANLY
// ============================================================
test.describe('Site pages load', () => {
  for (const [name, path] of Object.entries(PAGES)) {
    test(`${name} (${path}) loads with header, one h1, footer and no JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));

      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res?.status()).toBe(200);

      const chrome = new BasePage(page);
      await expect(chrome.header.root).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
      await chrome.footer.root.scrollIntoViewIfNeeded();
      await expect(chrome.footer.root).toBeVisible();

      const broken = await page.evaluate(async () => {
        // Force lazy images to load, then report any that failed.
        document.querySelectorAll('img[loading="lazy"]').forEach(i => i.setAttribute('loading', 'eager'));
        await new Promise(r => setTimeout(r, 1500));
        return [...document.images]
          .filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src'))
          .map(i => i.getAttribute('src'));
      });
      expect(broken, 'broken images').toEqual([]);
      expect(errors, 'uncaught page errors').toEqual([]);
    });
  }

  test('unknown URL returns the custom 404 page', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist-qa/');
    expect(res?.status()).toBe(404);
    await expect(page).toHaveTitle(/Page Not Found/i);
  });

  test('old vahan.co job URLs redirect to vahan.ai', async ({ request }) => {
    const res = await request.get('https://vahan.co/jobs/', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toMatch(/vahan\.ai.*\/jobs\/$/);
  });
});

// ============================================================
// HOME PAGE
// ============================================================
test.describe('Home page', () => {
  test('hero, stats, audience tabs and case studies are present', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await expect(home.heroHeading).toHaveText(/Recruit With AI/i);
    await home.verifyAllWithHighlight({
      phoneInput: home.phoneInput,
      tryNow: home.tryNowButton,
      ...home.stats,
      ...home.audienceTabs,
      headlines: home.headlinesHeading,
      caseStudies: home.caseStudiesHeading,
    });
    expect(await home.caseStudyLinks.count()).toBeGreaterThanOrEqual(3);
  });

  test('audience tab For Job-seekers swaps the panel to job-seeker content', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await home.audienceTabs.jobSeekers.click();

    await expect(page.getByRole('link', { name: 'Find Jobs Near You' })).toBeVisible();
  });

  test('Try Now with a short number shows a validation error and does not submit', async ({ page }) => {
    // Never send a valid number here — it triggers a real OTP / AI call.
    const home = new HomePage(page);
    const leadRequests: string[] = [];
    await page.route(/vahan\.ai\/.*api/, route => {
      if (route.request().method() !== 'GET') leadRequests.push(route.request().url());
      return route.abort();
    });
    await home.goto();

    await home.phoneInput.fill('12345');
    await home.tryNowButton.click();

    await expect(home.formStatus).toContainText(/valid mobile number/i);
    expect(leadRequests).toEqual([]);
  });

  test('Try Now phone field rejects letters', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await home.phoneInput.pressSequentially('abc');

    await expect(home.phoneInput).toHaveValue('');
  });
});

// ============================================================
// HEADER NAVIGATION (desktop)
// ============================================================
test.describe('Header menu navigation', () => {
  const targets: [menu: 'solutions' | 'company' | 'resources', link: string, url: RegExp][] = [
    ['solutions', 'forCorporates', /\/corporate\/$/],
    ['solutions', 'forRecruitmentAgencies', /\/recruitment-agencies\/$/],
    ['solutions', 'forJobSeekers', /\/jobs\/$/],
    ['company', 'careers', /\/careers\/$/],
    ['company', 'newsroom', /\/newsroom\/$/],
    ['resources', 'recruitmentAgencyStories', /\/partner-stories\/$/],
    ['resources', 'riderHub', /\/rider-adda\/$/],
  ];

  for (const [menu, link, url] of targets) {
    test(`${menu} › ${link} navigates correctly`, async ({ page }) => {
      await page.goto(ROUTES.home);
      const chrome = new BasePage(page);

      await chrome.header.navigateViaMenu(menu, link);

      await expect(page).toHaveURL(url);
    });
  }

  test('Case Studies and Contact Us links navigate correctly', async ({ page }) => {
    await page.goto(ROUTES.home);
    const chrome = new BasePage(page);

    await chrome.header.caseStudiesLink.click();
    await expect(page).toHaveURL(/\/case-studies\/$/);

    await chrome.header.contactUsLink.click();
    await expect(page).toHaveURL(/\/contact\/$/);
  });
});

// ============================================================
// CONTACT FORM (validation only — Cloudflare Turnstile blocks automated submits)
// ============================================================
test.describe('Contact form', () => {
  test('submitting empty contact form does not submit and shows an error', async ({ page }) => {
    await page.goto(ROUTES.contact);

    await page.getByRole('button', { name: 'Contact Us' }).last().click();

    await expect(page.getByText('Please fill all fields correctly.')).toBeVisible();
    const invalid = await page.evaluate(() =>
      [...document.querySelectorAll('input')].filter(i => !i.checkValidity()).length,
    );
    expect(invalid).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/contact\/$/);
  });
});

// ============================================================
// MOBILE
// ============================================================
test.describe('Mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('hamburger opens the nav drawer and links work', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await expect(jobsPage.header.mobileMenuButton).toBeVisible();
    await jobsPage.header.mobileMenuButton.click();

    await expect(jobsPage.header.menus.resources).toBeVisible();
    await jobsPage.header.menus.resources.click();
    await jobsPage.header.menuLinks.riderHub.click();
    await expect(page).toHaveURL(/\/rider-adda\/$/);
  });

  test('header stays pinned to the top while scrolling', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await page.mouse.wheel(0, 3000);
    await expect.poll(() => jobsPage.header.root.evaluate(e => Math.round(e.getBoundingClientRect().top))).toBe(0);
  });

  for (const [name, path] of Object.entries({ home: ROUTES.home, jobs: ROUTES.jobs, riderHub: ROUTES.riderHub, blog: ROUTES.blog })) {
    test(`${name} has no horizontal overflow on a phone`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('jobs page shows one job card per row with WhatsApp CTAs', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    const [a, b] = await jobsPage.knowMoreLinks.evaluateAll(as =>
      as.slice(0, 2).map(x => Math.round(x.getBoundingClientRect().top)),
    );
    expect(b).toBeGreaterThan(a);
    await expect(jobsPage.applyNowLinks.first()).toBeVisible();
  });
});
