import { Page, Locator } from '@playwright/test';
import { ROUTES } from '../constants/urls';
import { WHATSAPP_URL_PATTERN } from './JobsPage';
import { BasePage } from './BasePage';

export class RiderHubPage extends BasePage {
  readonly heroHeading: Locator;

  readonly filterTabs: Record<string, Locator>;
  // Each video card is an <a href="/rider-adda/<slug>/"> containing a thumbnail img
  readonly videoCards: Locator;

  readonly alertHeading: Locator;
  readonly areaNameInput: Locator;
  readonly alertWhatsAppInput: Locator;
  readonly alertSubmitButton: Locator;

  readonly latestBlogHeading: Locator;
  // Blog cards: <a href="/blog/<slug>/"> containing a thumbnail img
  readonly blogCards: Locator;
  readonly seeMoreBlogsLink: Locator;

  readonly browseAllJobsLink: Locator;

  readonly footerWhatsAppInput: Locator;
  readonly footerContactButton: Locator;

  constructor(page: Page) {
    super(page);
    const contentinfo = page.getByRole('contentinfo');

    this.heroHeading = page.getByRole('heading', {
      name: 'Learn, earn, and stay ahead.',
      level: 1,
    });

    // The filter buttons display as uppercase (CSS text-transform) but their DOM text is
    // title-case. They're duplicated in the DOM (mobile + desktop), so use .first().
    this.filterTabs = {
      all: page.getByRole('button', { name: 'All', exact: true }).first(),
      comedy: page.getByRole('button', { name: 'Comedy', exact: true }).first(),
      education: page.getByRole('button', { name: 'Education', exact: true }).first(),
      entertainment: page.getByRole('button', { name: 'Entertainment', exact: true }).first(),
      healthWellness: page.getByRole('button', { name: 'Health & Wellness', exact: true }).first(),
      investment: page.getByRole('button', { name: 'Investment', exact: true }).first(),
      series: page.getByRole('button', { name: 'Series', exact: true }).first(),
      socialAwareness: page.getByRole('button', { name: 'Social Awareness', exact: true }).first(),
      technology: page.getByRole('button', { name: 'Technology', exact: true }).first(),
      tipsTricks: page.getByRole('button', { name: 'Tips & Tricks', exact: true }).first(),
    };

    this.videoCards = page
      .locator('a[href^="/rider-adda/"]')
      .filter({ has: page.locator('img') });

    this.alertHeading = page.getByRole('heading', {
      name: 'Alert me for a job in my area',
      level: 2,
    });
    this.areaNameInput = page.getByRole('textbox', { name: 'Area Name' });
    this.alertWhatsAppInput = page.getByRole('textbox', { name: 'WhatsApp Number' }).first();
    this.alertSubmitButton = page.getByRole('button', { name: 'SUBMIT', exact: true });

    // Heading text is title-case in DOM ("Latest from the Blog"), CSS transforms to uppercase.
    this.latestBlogHeading = page.getByRole('heading', { name: 'Latest from the Blog', level: 2 });
    this.blogCards = page.locator('a[href^="/blog/"]').filter({ has: page.locator('img') });
    // Link text is "See More Blogs" in DOM, CSS transforms to uppercase.
    this.seeMoreBlogsLink = page.getByRole('link', { name: 'See More Blogs', exact: true });

    this.browseAllJobsLink = page.getByRole('link', { name: /Browse All Jobs/i });

    this.footerWhatsAppInput = contentinfo.getByRole('textbox', { name: 'WhatsApp Number' });
    this.footerContactButton = contentinfo.getByRole('button', { name: 'Contact Me' });
  }

  async goto() {
    await this.page.goto(ROUTES.riderHub, { waitUntil: 'domcontentloaded' });
    await this.heroHeading.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForFunction(
      () => !!document.querySelector('button[aria-pressed]'),
      { timeout: 10000 }
    );
    // Brief pause so the test-name banner is readable before interactions start.
    await this.page.waitForTimeout(1200);
  }

  async interceptWhatsAppNavigation(): Promise<() => string> {
    let capturedUrl = '';
    await this.page.context().route(WHATSAPP_URL_PATTERN, async route => {
      capturedUrl = route.request().url();
      await route.abort();
    });
    return () => capturedUrl;
  }
}

export class VideoDetailPage {
  // Player shows a thumbnail with this button until clicked; the YouTube iframe
  // is only mounted afterwards.
  readonly playButton: Locator;
  readonly youtubeIframe: Locator;
  readonly videoTitle: Locator;
  readonly viewCount: Locator;
  readonly applyOnWhatsAppButton: Locator;
  readonly languageTabs: Record<string, Locator>;
  // Sidebar cards linking to other video detail pages
  readonly moreVideoCards: Locator;

  constructor(private page: Page) {
    // Scope to <main> to exclude the header language dropdown options, which also
    // contain "English" / "हिंदी" buttons. Both sets are duplicated (mobile + desktop)
    // so we also use .first() on each.
    const main = page.locator('main');

    this.playButton = main.getByRole('button', { name: /^Play video:/ });
    this.youtubeIframe = page.locator('iframe[src*="youtube"]');
    this.videoTitle = main.getByRole('heading', { level: 1 });
    // Sidebar "More Videos" cards also show view counts in <span> elements;
    // the main video count is in a <p> — scope to <p> to avoid strict-mode violations.
    this.viewCount = main.locator('p').filter({ hasText: /\d+[kKmM]? views/i }).first();
    this.applyOnWhatsAppButton = main.getByRole('link', { name: /Apply on WhatsApp/i });
    this.languageTabs = {
      english: main.getByRole('button', { name: 'English', exact: true }).first(),
      hindi: main.getByRole('button', { name: 'हिंदी', exact: true }).first(),
      tamil: main.getByRole('button', { name: 'தமிழ்', exact: true }).first(),
      kannada: main.getByRole('button', { name: 'ಕನ್ನಡ', exact: true }).first(),
      telugu: main.getByRole('button', { name: 'తెలుగు', exact: true }).first(),
    };
    // Sidebar cards link to other detail pages. The current page's own slug may also
    // appear here — the test filters it out by checking for a different href.
    this.moreVideoCards = main
      .locator('a[href^="/rider-adda/"]')
      .filter({ has: page.locator('img') });
  }

  async interceptWhatsAppNavigation(): Promise<() => string> {
    let capturedUrl = '';
    await this.page.context().route(WHATSAPP_URL_PATTERN, async route => {
      capturedUrl = route.request().url();
      await route.abort();
    });
    return () => capturedUrl;
  }
}
