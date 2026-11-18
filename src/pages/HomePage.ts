import { Page, Locator } from '@playwright/test';
import { ROUTES } from '../constants/urls';
import { BasePage } from './BasePage';

/**
 * vahan.ai home (employer-facing). The hero "Try Now" form triggers a real OTP /
 * AI-recruiter call, so tests only exercise client-side validation and never
 * submit a valid number.
 */
export class HomePage extends BasePage {
  readonly heroHeading: Locator;
  readonly phoneInput: Locator;
  readonly tryNowButton: Locator;
  readonly formStatus: Locator;
  readonly stats: Record<string, Locator>;
  readonly audienceTabs: Record<string, Locator>;
  readonly headlinesHeading: Locator;
  readonly caseStudiesHeading: Locator;
  readonly caseStudyLinks: Locator;

  constructor(page: Page) {
    super(page);
    this.heroHeading = page.getByRole('heading', { level: 1 });
    this.phoneInput = page.getByRole('textbox', { name: 'Mobile number' });
    this.tryNowButton = page.getByRole('button', { name: 'Try Now' });
    this.formStatus = page.locator('.lg-status');
    this.stats = {
      workersPlaced: page.getByText('workers placed', { exact: true }),
      cities: page.getByText('cities', { exact: true }),
      network: page.getByText('workers in our network', { exact: true }),
      efficiency: page.getByText('higher recruitment efficiency', { exact: true }),
    };
    // Rendered as plain divs (no tab role) — see the accessibility findings.
    this.audienceTabs = {
      corporates: page.locator('.tab-label', { hasText: 'For Corporates' }),
      agencies: page.locator('.tab-label', { hasText: 'For Recruitment Agencies' }),
      jobSeekers: page.locator('.tab-label', { hasText: 'For Job-seekers' }),
    };
    this.headlinesHeading = page.getByRole('heading', { level: 2, name: 'Making Headlines Across India' });
    this.caseStudiesHeading = page.getByRole('heading', { level: 2, name: /Case Studies And Testimonials/ });
    this.caseStudyLinks = page.getByRole('link', { name: 'Read the case study' });
  }

  async goto() {
    await this.page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });
    await this.heroHeading.waitFor({ timeout: 15_000 });
  }
}
