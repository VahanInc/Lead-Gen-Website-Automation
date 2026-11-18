import { test, expect } from '../fixtures';
import { JobsPage, WHATSAPP_URL_PATTERN, VAHAN_WHATSAPP_PHONE } from '../../src/pages/JobsPage';
import { JobDetailPage } from '../../src/pages/JobDetailPage';

test.describe('Job detail page', () => {
  let cardTitle = '';
  let detailPath = '';

  test.beforeEach(async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();
    cardTitle = ((await jobsPage.jobCardTitles.first().textContent()) ?? '').trim();
    detailPath = (await jobsPage.knowMoreLinks.first().getAttribute('href')) ?? '';
    await jobsPage.knowMoreLinks.first().click();
    await page.waitForURL(`**${detailPath}`);
  });

  test('all detail sections are present', async ({ page }) => {
    const detail = new JobDetailPage(page);
    await expect(detail.heading).toContainText(cardTitle);
    await detail.verifyAllWithHighlight({
      breadcrumb: detail.breadcrumb,
      heading: detail.heading,
      whatYoullDo: detail.whatYoullDoHeading,
      earningTips: detail.earningTipsHeading,
      salary: detail.salary,
      requirements: detail.requirementsHeading,
      applyNow: detail.applyNowLink,
      moreJobs: detail.moreJobsHeading,
      alertHeading: detail.alertHeading,
      areaName: detail.areaNameInput,
      alertWhatsApp: detail.alertWhatsAppInput,
      alertSubmit: detail.alertSubmitButton,
      faq: detail.faqHeading,
      bottomApply: detail.bottomApplyLink,
    });
  });

  test('breadcrumb links back to Jobs, the city and the company', async ({ page }) => {
    const detail = new JobDetailPage(page);
    const crumbs = detail.breadcrumb.getByRole('link');
    await expect(crumbs.first()).toHaveAttribute('href', '/jobs/');
    expect(await crumbs.count()).toBeGreaterThanOrEqual(3);

    await crumbs.nth(1).click();
    await expect(page).toHaveURL(/\/jobs\/[a-z-]+\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('APPLY NOW links to WhatsApp with this job pre-filled', async ({ page }) => {
    const detail = new JobDetailPage(page);
    const href = decodeURIComponent((await detail.applyNowLink.getAttribute('href')) ?? '');
    expect(href).toMatch(WHATSAPP_URL_PATTERN);
    expect(href).toContain(VAHAN_WHATSAPP_PHONE);
    const company = cardTitle.split(' ')[0];
    expect(href).toContain(company);
  });

  test('has JobPosting structured data and a canonical URL', async ({ page }) => {
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld.map(s => JSON.parse(s)['@type']);
    expect(types).toContain('JobPosting');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${detailPath}$`));
  });

  test('"See more jobs near you" cards open other detail pages', async ({ page }) => {
    const detail = new JobDetailPage(page);
    const other = detail.moreJobsKnowMoreLinks.first();
    const href = (await other.getAttribute('href')) ?? '';
    expect(href).not.toBe(detailPath);
    await other.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('unknown job slug returns the 404 page', async ({ page }) => {
    const res = await page.goto('/jobs/this-job-does-not-exist-qa/');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
