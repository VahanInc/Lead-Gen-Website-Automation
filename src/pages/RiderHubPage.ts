import { Page, Locator, expect } from '@playwright/test';
import { ROUTES } from '../constants/urls';
import { BasePage } from './BasePage';

/**
 * /rider-adda/ ("Rider Hub") on vahan.ai.
 *
 * Flow: hero + featured video → category tabs (role=tab) → paginated video grid
 * (4 per page, client-side) → "Jobs Near You" (3 job cards + Browse All Jobs) →
 * "Alert Me" form (submits to wa.me) → latest blogs → footer.
 * No language picker on this page.
 */
export class RiderHubPage extends BasePage {
  readonly heroHeading: Locator;
  readonly heroSubheading: Locator;
  readonly featuredVideo: Locator;

  readonly categoryTablist: Locator;
  readonly categoryTabs: Record<string, Locator>;
  readonly selectedTab: Locator;
  /** Only the cards on the current grid page; hidden cards stay in the DOM. */
  readonly videoCards: Locator;
  readonly videoPager: Locator;
  readonly previousPage: Locator;
  readonly nextPage: Locator;
  readonly currentVideoPage: Locator;

  readonly jobsNearYouHeading: Locator;
  readonly jobKnowMoreLinks: Locator;
  readonly jobApplyLinks: Locator;
  readonly browseAllJobsLink: Locator;

  readonly alertHeading: Locator;
  readonly areaNameInput: Locator;
  readonly alertWhatsAppInput: Locator;
  readonly alertSubmitButton: Locator;

  readonly blogRegion: Locator;
  readonly blogCards: Locator;
  readonly viewAllBlogsLink: Locator;

  constructor(page: Page) {
    super(page);

    this.heroHeading = page.getByRole('heading', { name: 'Learn, earn, and stay ahead.', level: 1 });
    this.heroSubheading = page.getByText(/Short videos packed with delivery tips/);
    this.featuredVideo = page.locator('a.rh-feature');

    this.categoryTablist = page.getByRole('tablist', { name: 'Filter videos by category' });
    const tab = (name: string) => this.categoryTablist.getByRole('tab', { name, exact: true });
    this.categoryTabs = {
      all: tab('All'),
      comedy: tab('Comedy'),
      education: tab('Education'),
      entertainment: tab('Entertainment'),
      healthWellness: tab('Health & Wellness'),
      investment: tab('Investment'),
      series: tab('Series'),
      socialAwareness: tab('Social Awareness'),
      technology: tab('Technology'),
      tipsTricks: tab('Tips & Tricks'),
    };
    this.selectedTab = this.categoryTablist.getByRole('tab', { selected: true });
    this.videoCards = page.locator('a.vcard:not(.vcard-hidden)');
    this.videoPager = page.getByRole('navigation', { name: 'Video pages' });
    this.previousPage = this.videoPager.getByRole('button', { name: 'Previous page' });
    this.nextPage = this.videoPager.getByRole('button', { name: 'Next page' });
    this.currentVideoPage = this.videoPager.locator('[aria-current="page"]');

    this.jobsNearYouHeading = page.getByRole('heading', { level: 2, name: 'Jobs Near You' });
    this.jobKnowMoreLinks = page.getByRole('link', { name: /^Know more:/ });
    this.jobApplyLinks = page.getByRole('link', { name: /^Apply on WhatsApp:/ });
    this.browseAllJobsLink = page.getByRole('link', { name: 'Browse All Jobs' });

    this.alertHeading = page.getByRole('heading', { level: 2, name: /Alert Me for a Job in My Area/i });
    this.areaNameInput = page.getByRole('textbox', { name: 'Area Name' });
    this.alertWhatsAppInput = page.getByRole('textbox', { name: /WhatsApp Number/ });
    this.alertSubmitButton = page.getByRole('button', { name: 'Submit', exact: true });

    this.blogRegion = page.getByRole('region', { name: 'Read our latest blogs' });
    this.blogCards = this.blogRegion.locator('a[href^="/blog/"]').filter({
      has: page.getByRole('heading', { level: 3 }),
    });
    this.viewAllBlogsLink = this.blogRegion.getByRole('link', { name: 'View all blogs' });
  }

  async goto() {
    await this.page.goto(ROUTES.riderHub, { waitUntil: 'domcontentloaded' });
    await expect(this.heroHeading).toBeVisible({ timeout: 15_000 });
    await expect(this.videoCards.first()).toBeVisible({ timeout: 15_000 });
    await this.page.waitForTimeout(800);
  }

  async selectCategory(key: keyof RiderHubPage['categoryTabs'] | string) {
    const t = this.categoryTabs[key as string];
    await t.click();
    await expect(t).toHaveAttribute('aria-selected', 'true');
    await expect(this.videoCards.first()).toBeVisible();
  }

  async visibleVideoHrefs(): Promise<string[]> {
    return this.videoCards.evaluateAll(as => as.map(a => a.getAttribute('href') ?? ''));
  }

  /** Category tags rendered at the end of each card, e.g. "Education, Tips & Tricks". */
  async visibleVideoTexts(): Promise<string[]> {
    return this.videoCards.evaluateAll(as => as.map(a => (a.textContent ?? '').replace(/\s+/g, ' ').trim()));
  }
}

/** /rider-adda/<slug>/ */
export class VideoDetailPage extends BasePage {
  readonly main: Locator;
  readonly playButton: Locator;
  readonly youtubeIframe: Locator;
  readonly categoryTags: Locator;
  readonly videoTitle: Locator;
  readonly viewCount: Locator;
  readonly descriptionRegion: Locator;
  readonly transcriptTabs: Record<string, Locator>;
  readonly transcriptPanel: Locator;
  readonly applyOnWhatsAppLink: Locator;
  readonly moreVideos: Locator;
  readonly moreVideoCards: Locator;
  readonly seeAllVideosLink: Locator;
  readonly browseJobsLink: Locator;

  constructor(page: Page) {
    super(page);
    this.main = page.getByRole('main');
    this.playButton = this.main.getByRole('button', { name: /^Play video:/ });
    this.youtubeIframe = page.locator('iframe[src*="youtube"]');
    this.categoryTags = this.main.getByRole('list').first().getByRole('listitem');
    this.videoTitle = this.main.getByRole('heading', { level: 1 });
    this.viewCount = this.main.getByText(/[\d.]+[kKmM]? views/).first();
    this.descriptionRegion = this.main.getByRole('region', { name: 'Description' });
    const tablist = this.descriptionRegion.getByRole('tablist', { name: 'Transcript language' });
    const tab = (name: string) => tablist.getByRole('tab', { name, exact: true });
    this.transcriptTabs = {
      english: tab('English'),
      hindi: tab('हिंदी'),
      tamil: tab('தமிழ்'),
      kannada: tab('ಕನ್ನಡ'),
      telugu: tab('తెలుగు'),
    };
    this.transcriptPanel = this.descriptionRegion.getByRole('tabpanel');
    this.applyOnWhatsAppLink = this.main.getByRole('link', { name: 'Apply on WhatsApp' });
    this.moreVideos = this.main.getByRole('complementary', { name: 'More videos' });
    this.moreVideoCards = this.moreVideos.locator('a[href^="/rider-adda/"]:not([href="/rider-adda/"])');
    this.seeAllVideosLink = this.moreVideos.getByRole('link', { name: 'See all videos' });
    this.browseJobsLink = this.moreVideos.getByRole('link', { name: 'Browse delivery jobs' });
  }
}
