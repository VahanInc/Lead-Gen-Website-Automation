import { Page, Locator, expect } from '@playwright/test';
import { ROUTES } from '../constants/urls';
import { BasePage } from './BasePage';

export const WHATSAPP_URL_PATTERN = /api\.whatsapp\.com|wa\.me/;
export const VAHAN_WHATSAPP_PHONE = '919964051511';

export class JobsPage extends BasePage {
  readonly headerNavItems: Record<string, Locator>;
  readonly languageDropdown: Locator;
  readonly languageOptions: Record<string, Locator>;
  readonly getStartedButton: Locator;
  readonly heroApplyNowButton: Locator;

  readonly heroHeading: Locator;
  readonly heroSubheading: Locator;
  readonly trustedByLabel: Locator;
  readonly trustedBrandLogos: Locator;

  readonly filterCity: Locator;
  readonly filterNeighbourhood: Locator;
  readonly filterCompany: Locator;
  readonly filterDropdownOptions: Locator;
  readonly noResultsMessage: Locator;

  readonly jobCards: Locator;
  readonly knowMoreLinks: Locator;
  readonly jobApplyNowButtons: Locator;
  readonly jobCountLabel: Locator;
  readonly pagination: Locator;

  readonly alertHeading: Locator;
  readonly areaNameInput: Locator;
  readonly alertWhatsAppInput: Locator;
  readonly alertSubmitButton: Locator;

  readonly benefitItems: Record<string, Locator>;
  readonly testimonialsHeading: Locator;
  readonly testimonialPrevButton: Locator;
  readonly testimonialNextButton: Locator;

  readonly faqHeading: Locator;
  readonly faqItems: Record<string, Locator>;
  readonly faqButtons: Record<string, Locator>;

  readonly footerHeading: Locator;
  readonly footerWhatsAppInput: Locator;
  readonly footerContactButton: Locator;
  readonly footerLinks: Record<string, Locator>;

  constructor(page: Page) {
    super(page);
    const banner = page.getByRole('banner');
    const contentinfo = page.getByRole('contentinfo');

    this.headerNavItems = {
      forEmployers: banner.getByText('For Employers', { exact: true }),
      forJobSeekers: banner.getByRole('link', { name: 'For Job-Seekers' }),
      vahanLeaders: banner.getByText('Vahan Leaders', { exact: true }),
      careers: banner.getByText('Careers', { exact: true }),
      riderHub: banner.getByRole('link', { name: 'Rider Hub' }),
    };

    this.languageDropdown = banner.getByRole('button', {
      name: 'ENGLISH',
      exact: true,
    });
    this.languageOptions = {
      english: banner.getByRole('button', { name: 'English', exact: true }),
      hindi: banner.getByRole('button', { name: 'हिंदी', exact: true }),
      tamil: banner.getByRole('button', { name: 'தமிழ்', exact: true }),
      kannada: banner.getByRole('button', { name: 'ಕನ್ನಡ', exact: true }),
    };
    this.getStartedButton = banner.getByRole('link', { name: 'GET STARTED' });
    this.heroApplyNowButton = page
      .getByRole('button', { name: 'Apply Now', exact: true })
      .first();

    this.heroHeading = page
      .getByRole('heading', { name: 'Find your perfect delivery job', level: 1 })
      .first();
    this.heroSubheading = page.getByText('Get a guaranteed job and earn ₹25,000+');
    this.trustedByLabel = page.getByText('We are trusted by', { exact: true });
    this.trustedBrandLogos = page.getByRole('button', { name: /logo$/i });

    // Use regex so the locator still matches when the button gains a count suffix
    // like "City (1)" after geolocation auto-applies a filter.
    this.filterCity = page.getByRole('button', { name: /^City/ });
    this.filterNeighbourhood = page.getByRole('button', { name: /^Neighbourhood/ });
    this.filterCompany = page.getByRole('button', { name: /^Company/ });
    // Options that appear inside a filter dropdown after it is opened.
    // The dropdowns use <label> + <input type="checkbox"> — no ARIA role="option".
    this.filterDropdownOptions = page
      .locator('label')
      .filter({ has: page.locator('input[type="checkbox"]') });
    this.noResultsMessage = page.getByText(/no jobs found|0 jobs/i);

    this.jobCards = page
      .getByRole('heading', { level: 3 })
      .filter({ hasText: /Delivery/i });
    this.knowMoreLinks = page.getByRole('link', { name: 'Know More' });
    this.jobApplyNowButtons = page.getByRole('button', { name: 'APPLY NOW' });
    this.jobCountLabel = page.getByText(/Showing \d+-\d+ jobs of \d+ total/);
    this.pagination = page.getByRole('navigation', { name: 'Pagination' });

    this.alertHeading = page.getByRole('heading', {
      name: 'Alert me for a job in my area',
      level: 2,
    });
    this.areaNameInput = page.getByRole('textbox', { name: 'Area Name' });
    this.alertWhatsAppInput = page
      .getByRole('textbox', { name: 'WhatsApp Number' })
      .first();
    this.alertSubmitButton = page.getByRole('button', { name: 'SUBMIT', exact: true });

    this.benefitItems = {
      free: page.getByRole('heading', { name: '100% Free', level: 3 }),
      noMiddlemen: page.getByRole('heading', { name: 'No Middlemen', level: 3 }),
      callSupport: page.getByRole('heading', { name: 'Call Support', level: 3 }),
      guaranteedJob: page.getByRole('heading', { name: 'Guaranteed job', level: 3 }),
    };
    this.testimonialsHeading = page.getByRole('heading', {
      name: "Rider's Testimonials",
      level: 2,
    });
    this.testimonialPrevButton = page.getByRole('button', {
      name: 'Previous testimonial',
    });
    this.testimonialNextButton = page.getByRole('button', { name: 'Next testimonial' });

    this.faqHeading = page.getByRole('heading', {
      name: 'Frequently Asked Questions',
      level: 2,
    });
    this.faqItems = {
      rolesAvailable: page.getByText('What types of delivery roles are available?', {
        exact: true,
      }),
      ownVehicle: page.getByText(
        'Do I need my own vehicle to work as a delivery partner?',
        { exact: true }
      ),
      fullTimeOrFlexible: page.getByText('Are delivery roles full-time or flexible?', {
        exact: true,
      }),
      priorExperience: page.getByText('Is prior experience required?', { exact: true }),
    };
    // Button-role versions of FAQ triggers — needed for aria-expanded accordion assertions.
    // <summary> elements also carry implicit button role, so this covers both patterns.
    this.faqButtons = {
      rolesAvailable: page.getByRole('button', {
        name: 'What types of delivery roles are available?',
      }),
      ownVehicle: page.getByRole('button', {
        name: 'Do I need my own vehicle to work as a delivery partner?',
      }),
      fullTimeOrFlexible: page.getByRole('button', {
        name: 'Are delivery roles full-time or flexible?',
      }),
      priorExperience: page.getByRole('button', {
        name: 'Is prior experience required?',
      }),
    };

    this.footerHeading = contentinfo.getByRole('heading', {
      name: 'Get your next delivery job today',
      level: 2,
    });
    this.footerWhatsAppInput = contentinfo.getByRole('textbox', {
      name: 'WhatsApp Number',
    });
    this.footerContactButton = contentinfo.getByRole('button', { name: 'Contact Me' });
    this.footerLinks = {
      privacyPolicy: contentinfo.getByRole('link', { name: 'Privacy Policy' }),
      termsAndConditions: contentinfo.getByRole('link', { name: 'Terms & Conditions' }),
      forJobSeekers: contentinfo.getByRole('link', { name: 'For Job-Seekers' }),
      riderHub: contentinfo.getByRole('link', { name: 'Rider Hub' }),
      blog: contentinfo.getByRole('link', { name: 'Blog' }),
      email: contentinfo.getByRole('link', { name: 'info@vahan.ai' }),
      linkedIn: contentinfo.getByRole('link', { name: 'LinkedIn' }),
      youTube: contentinfo.getByRole('link', { name: 'YouTube' }),
    };
  }

  async goto() {
    await this.page.goto(ROUTES.jobs, { waitUntil: 'domcontentloaded' });
    await this.jobCountLabel.waitFor({ state: 'visible', timeout: 15000 });
    await this.dismissOverlaysIfPresent();
    // Brief pause so the test-name banner is readable before interactions start.
    await this.page.waitForTimeout(1200);
  }

  private async dismissOverlaysIfPresent() {
    // The geolocation banner ("We detected X. Continue?") appears ~3 seconds after
    // page load via a timer. Wait long enough to catch it, then dismiss it so it
    // does not intercept pointer events during subsequent test interactions.
    const continueBtn = this.page.getByRole('button', { name: 'Continue' });
    const appeared = await continueBtn
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      await continueBtn.click();
      await continueBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }

  /** Parses the "Showing X-Y jobs of Z total" label and returns Z. */
  async getJobTotalCount(): Promise<number> {
    const text = (await this.jobCountLabel.textContent()) ?? '';
    const match = text.match(/of ([\d,]+) total/);
    return match ? parseInt(match[1].replace(',', ''), 10) : 0;
  }

  /**
   * Opens a filter dropdown, checks the first available option (checkbox/label),
   * and waits for the job count label to confirm the listing refreshed.
   * The dropdown stays open after selection (multi-select design).
   */
  async selectFirstFilterOption(filterButton: Locator): Promise<string> {
    await filterButton.scrollIntoViewIfNeeded();
    await filterButton.click();

    // After geolocation auto-applies a city, that checkbox is already checked.
    // Always pick the first UNCHECKED option so we're adding a new filter.
    const firstUnchecked = this.filterDropdownOptions
      .filter({ has: this.page.locator('input[type="checkbox"]:not(:checked)') })
      .first();
    await expect(firstUnchecked).toBeVisible({ timeout: 10000 });
    const text = ((await firstUnchecked.textContent()) ?? '').trim();
    await firstUnchecked.click();
    // Job count refreshes immediately on checkbox selection — no need to close dropdown
    await expect(this.jobCountLabel).toBeVisible({ timeout: 10000 });
    return text;
  }

  /**
   * Registers a route interceptor that captures any navigation to WhatsApp
   * and aborts it so the page stays on vahan.co. Returns a getter for the
   * captured URL — poll it after the triggering click.
   *
   * Uses context-level routing so popups opened via window.open are also
   * intercepted — some CTAs open WhatsApp in a new tab.
   */
  async interceptWhatsAppNavigation(): Promise<() => string> {
    let capturedUrl = '';
    await this.page.context().route(WHATSAPP_URL_PATTERN, async route => {
      capturedUrl = route.request().url();
      await route.abort();
    });
    return () => capturedUrl;
  }

}
