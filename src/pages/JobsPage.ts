import { Page, Locator, expect } from '@playwright/test';
import { ROUTES } from '../constants/urls';
import { BasePage } from './BasePage';

export { WHATSAPP_URL_PATTERN, VAHAN_WHATSAPP_PHONE } from '../constants/urls';

export type LocationPrompt = 'accept' | 'decline' | 'ignore';

/**
 * /jobs/ on vahan.ai.
 *
 * Flow: hero → "Apply on WhatsApp" (direct wa.me link, no form) → brand strip →
 * filterable job grid (9 per page, API-backed: /jobs/api/listings/) → why-us →
 * testimonial carousel → FAQ accordion → SEO "about" block → bottom WhatsApp CTA.
 *
 * Geolocation: right after load the page calls /jobs/api/detect-location/ and shows
 * "We detected <area>, <city>. Continue?". Continue sets the City + Neighbourhood
 * filters and reloads the grid; the other button dismisses it.
 */
export class JobsPage extends BasePage {
  readonly heroHeading: Locator;
  readonly heroSalary: Locator;
  readonly heroSteps: Record<string, Locator>;
  readonly heroImage: Locator;
  readonly heroApplyLink: Locator;
  readonly heroNote: Locator;

  readonly brandsHeading: Locator;
  readonly brandLogos: Locator;

  readonly jobsHeading: Locator;
  readonly filterCity: Locator;
  readonly filterNeighbourhood: Locator;
  readonly filterCompany: Locator;
  readonly openListbox: Locator;
  readonly listboxOptions: Locator;

  readonly jobGrid: Locator;
  readonly jobCardTitles: Locator;
  readonly knowMoreLinks: Locator;
  readonly applyNowLinks: Locator;
  readonly pagination: Locator;
  readonly activePage: Locator;

  readonly locationPrompt: Locator;
  readonly locationContinue: Locator;
  readonly locationDecline: Locator;

  readonly whyHeading: Locator;
  readonly benefitItems: Record<string, Locator>;

  readonly testimonialsHeading: Locator;
  readonly testimonials: Locator;
  readonly testimonialDots: Locator;

  readonly faqHeading: Locator;
  readonly faqButtons: Record<string, Locator>;
  readonly allFaqButtons: Locator;

  readonly aboutRegion: Locator;
  readonly bottomCtaHeading: Locator;
  readonly bottomApplyLink: Locator;

  constructor(page: Page) {
    super(page);

    this.heroHeading = page.getByRole('heading', { level: 1 });
    this.heroSalary = page.getByText('₹25,000+ guaranteed monthly salary');
    this.heroSteps = {
      step1: page.getByText(/Tap .Apply on WhatsApp./),
      step2: page.getByText('Answer 2 simple questions'),
      step3: page.getByText('Your job is confirmed!'),
    };
    this.heroImage = page.getByRole('img', { name: /delivery partner holding a phone/i });
    // Hero and bottom CTA share the same accessible name — hero is first in DOM.
    this.heroApplyLink = page.getByRole('link', { name: 'Apply on WhatsApp', exact: true }).first();
    this.heroNote = page.getByText('1-click application, takes 2 mins.');

    this.brandsHeading = page.getByRole('heading', { level: 2, name: /Top Companies/i });
    // No landmark around the brand strip; its wrapper class is the only stable hook.
    this.brandLogos = page.locator('.msec-brands').getByRole('img');

    this.jobsHeading = page.getByRole('heading', { level: 2, name: /Verified Jobs Across India/i });
    // Custom select: trigger <button aria-label="Filter by …"> whose text is the current value.
    this.filterCity = page.getByRole('button', { name: 'Filter by city' });
    this.filterNeighbourhood = page.getByRole('button', { name: 'Filter by neighbourhood' });
    this.filterCompany = page.getByRole('button', { name: 'Filter by company' });
    // Only the open dropdown is exposed in the accessibility tree.
    this.openListbox = page.getByRole('listbox').filter({ visible: true }).last();
    this.listboxOptions = this.openListbox.getByRole('option');

    this.jobGrid = page.locator('.lg-cards');
    this.jobCardTitles = this.jobGrid.getByRole('heading', { level: 3 });
    // Located by href, not accessible name — the "Know more: …" labels are translated.
    this.knowMoreLinks = this.jobGrid.locator('a[href^="/jobs/"]');
    this.applyNowLinks = this.jobGrid.locator('a[href*="wa.me"]');
    this.pagination = page.getByRole('navigation', { name: 'Pagination' });
    this.activePage = this.pagination.locator('[aria-current="page"]');

    this.locationPrompt = page.getByRole('status').filter({ hasText: 'We detected' });
    this.locationContinue = this.locationPrompt.getByRole('button', { name: 'Continue' });
    this.locationDecline = this.locationPrompt.getByRole('button', { name: /Not Correct/ });

    this.whyHeading = page.getByRole('heading', { level: 2, name: 'Why Riders Choose Us' });
    this.benefitItems = {
      free: page.getByRole('heading', { name: '100% Free', level: 3 }),
      noMiddlemen: page.getByRole('heading', { name: 'No Middlemen', level: 3 }),
      callSupport: page.getByRole('heading', { name: 'Call Support', level: 3 }),
      guaranteedJob: page.getByRole('heading', { name: 'Guaranteed job', level: 3 }),
    };

    this.testimonialsHeading = page.getByRole('heading', { level: 2, name: "Rider's Testimonials" });
    this.testimonials = page.getByRole('figure');
    this.testimonialDots = page.getByRole('button', { name: /^Testimonials page \d+$/ });

    this.faqHeading = page.getByRole('heading', { level: 2, name: 'Frequently Asked Questions' });
    const faq = (name: string) => page.getByRole('button', { name, exact: true });
    this.faqButtons = {
      rolesAvailable: faq('What types of delivery roles are available?'),
      ownVehicle: faq('Do I need my own vehicle to work as a delivery partner?'),
      fullTimeOrFlexible: faq('Are delivery roles full-time or flexible?'),
      priorExperience: faq('Is prior experience required?'),
    };
    this.allFaqButtons = page.locator('.faq').getByRole('button');

    this.aboutRegion = page.getByRole('region', { name: 'About these jobs' });
    this.bottomCtaHeading = page.getByRole('heading', { level: 2, name: /Get your next delivery job today/i });
    this.bottomApplyLink = page.getByRole('link', { name: 'Apply on WhatsApp', exact: true }).last();
  }

  /**
   * @param location what to do with the "We detected … Continue?" prompt.
   *   'decline' (default) keeps the unfiltered all-India listing so tests start from a known state.
   */
  async goto(location: LocationPrompt = 'decline') {
    await this.page.goto(ROUTES.jobs, { waitUntil: 'domcontentloaded' });
    await expect(this.knowMoreLinks.first()).toBeVisible({ timeout: 20_000 });
    await this.handleLocationPrompt(location);
    // Brief pause so the test-name banner is readable before interactions start.
    await this.page.waitForTimeout(800);
  }

  async handleLocationPrompt(action: LocationPrompt) {
    if (action === 'ignore') return;
    const shown = await this.locationPrompt
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (!shown) return;
    if (action === 'accept') {
      const reload = this.waitForListings();
      await this.locationContinue.click();
      await reload;
    } else {
      await this.locationDecline.click();
      // "Try filters below" scrolls to the grid and auto-opens the City dropdown —
      // close it so tests start from a neutral state.
      const autoOpened = await expect(this.filterCity)
        .toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      if (autoOpened) {
        await this.page.keyboard.press('Escape');
        await expect(this.filterCity).toHaveAttribute('aria-expanded', 'false');
      }
    }
    await expect(this.locationPrompt).toBeHidden();
  }

  /**
   * Resolves when the next listings API call completes AND the grid/pager have
   * re-rendered from it. Start it *before* the triggering action.
   */
  async waitForListings(): Promise<{ total: number; totalPages: number; page: number }> {
    const res = await this.page.waitForResponse(
      r => r.url().includes('/jobs/api/listings/') && r.ok(),
      { timeout: 15_000 },
    );
    const data = await res.json();
    if (data.totalPages > 1) {
      await expect.poll(() => this.lastPageNumber(), { timeout: 10_000 }).toBe(data.totalPages);
      await expect(this.activePage).toHaveText(String(data.page));
    } else {
      await expect(this.pagination).toBeHidden();
    }
    return data;
  }

  async cardSummaries(): Promise<string[]> {
    return this.knowMoreLinks.evaluateAll(as =>
      as.map(a => (a.getAttribute('aria-label') ?? '').replace(/^Know more:\s*/, '')),
    );
  }

  async pageNumbers(): Promise<number[]> {
    const labels = await this.pagination.getByRole('button').allTextContents();
    return labels.map(l => parseInt(l, 10)).filter(n => !Number.isNaN(n));
  }

  async lastPageNumber(): Promise<number> {
    const nums = await this.pageNumbers();
    return nums.length ? Math.max(...nums) : 1;
  }

  async goToPage(n: number) {
    const reload = this.waitForListings();
    await this.pagination.getByRole('button', { name: String(n), exact: true }).click();
    await reload;
    await expect(this.activePage).toHaveText(String(n));
  }

  async openFilter(trigger: Locator) {
    await trigger.scrollIntoViewIfNeeded();
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(this.listboxOptions.first()).toBeVisible();
  }

  /** Picks an option by visible name (or the first non-"All" option) and waits for the grid to refresh. */
  async selectFilterOption(trigger: Locator, optionName?: string): Promise<string> {
    await this.openFilter(trigger);
    const option = optionName
      ? this.openListbox.getByRole('option', { name: optionName, exact: true }).first()
      : this.listboxOptions.filter({ hasNotText: /^All \(/ }).first();
    const text = ((await option.textContent()) ?? '').trim();
    const reload = this.waitForListings();
    await option.click();
    await reload;
    await expect(trigger).toHaveText(text);
    return text;
  }

  brandLogo(name: string): Locator {
    return this.brandLogos.and(this.page.getByRole('img', { name, exact: true })).first();
  }

  /** The faq answer is the sibling element following the button. */
  faqAnswer(button: Locator): Locator {
    return button.locator('xpath=following-sibling::*[1]');
  }
}
