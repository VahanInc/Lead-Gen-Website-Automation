import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** /jobs/<company>-<role>-<area>-<city>/ — reached via "Know More" on a job card. */
export class JobDetailPage extends BasePage {
  readonly breadcrumb: Locator;
  readonly heading: Locator;
  readonly whatYoullDoHeading: Locator;
  readonly earningTipsHeading: Locator;
  readonly salary: Locator;
  readonly requirementsHeading: Locator;
  readonly applyNowLink: Locator;
  readonly moreJobsHeading: Locator;
  readonly moreJobsKnowMoreLinks: Locator;
  readonly alertHeading: Locator;
  readonly areaNameInput: Locator;
  readonly alertWhatsAppInput: Locator;
  readonly alertSubmitButton: Locator;
  readonly faqHeading: Locator;
  readonly bottomApplyLink: Locator;

  constructor(page: Page) {
    super(page);
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.heading = page.getByRole('heading', { level: 1 });
    this.whatYoullDoHeading = page.getByRole('heading', { level: 2, name: "What You'll Do" });
    this.earningTipsHeading = page.getByRole('heading', { level: 2, name: 'Maximum earning tips' });
    this.salary = page.getByText(/₹[\d,]+\s*–\s*₹[\d,]+/).first();
    this.requirementsHeading = page.getByRole('heading', { level: 2, name: /Job Requirements/ });
    this.applyNowLink = page.getByRole('link', { name: 'APPLY NOW', exact: true });
    this.moreJobsHeading = page.getByRole('heading', { level: 2, name: /See more jobs near you/i });
    this.moreJobsKnowMoreLinks = page.getByRole('link', { name: /^Know more:/ });
    this.alertHeading = page.getByRole('heading', { level: 2, name: /Alert me for a job in my area/i });
    this.areaNameInput = page.getByRole('textbox', { name: 'Area Name' });
    this.alertWhatsAppInput = page.getByRole('textbox', { name: /WhatsApp Number/ });
    this.alertSubmitButton = page.getByRole('button', { name: 'Submit', exact: true });
    this.faqHeading = page.getByRole('heading', { level: 2, name: 'Frequently Asked Questions' });
    this.bottomApplyLink = page.getByRole('link', { name: 'Apply on WhatsApp', exact: true });
  }
}
