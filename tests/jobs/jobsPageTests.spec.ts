import { test, expect } from '../fixtures';
import { JobsPage } from '../../src/pages/JobsPage';

test.describe('Jobs page - UI element validation', () => {
  test('all page sections have the expected elements', async ({ page }) => {
    test.setTimeout(120_000);
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await test.step('Header', async () => {
      await jobsPage.verifyAllWithHighlight({
        logo: jobsPage.header.logo,
        solutionsMenu: jobsPage.header.menus.solutions,
        companyMenu: jobsPage.header.menus.company,
        resourcesMenu: jobsPage.header.menus.resources,
        caseStudies: jobsPage.header.caseStudiesLink,
        languageButton: jobsPage.header.languageButton,
      });
    });

    await test.step('Language dropdown options', async () => {
      await jobsPage.header.languageButton.click();
      await expect(jobsPage.header.languageButton).toHaveAttribute('aria-expanded', 'true');
      await jobsPage.verifyAllWithHighlight(jobsPage.header.languageOptions);
      await expect(jobsPage.header.languageOptions.english).toHaveAttribute('aria-selected', 'true');
      await jobsPage.header.languageButton.click();
    });

    await test.step('Hero', async () => {
      await expect(jobsPage.heroHeading).toHaveText(/Find your perfect delivery job/i);
      await jobsPage.verifyAllWithHighlight({
        heroHeading: jobsPage.heroHeading,
        heroSalary: jobsPage.heroSalary,
        ...jobsPage.heroSteps,
        heroImage: jobsPage.heroImage,
        heroApplyLink: jobsPage.heroApplyLink,
        heroNote: jobsPage.heroNote,
      });
    });

    await test.step('Brand strip', async () => {
      await jobsPage.verifyAndHighlight('brandsHeading', jobsPage.brandsHeading);
      for (const brand of ['Blinkit', 'Instamart', 'Zepto', 'Swiggy', 'Zomato', 'Porter', 'Flipkart', 'Shadowfax', 'Rapido', 'Uber']) {
        await expect(jobsPage.brandLogo(brand), `${brand} logo`).toBeVisible();
      }
    });

    await test.step('Filters', async () => {
      await jobsPage.verifyAllWithHighlight({
        jobsHeading: jobsPage.jobsHeading,
        filterCity: jobsPage.filterCity,
        filterNeighbourhood: jobsPage.filterNeighbourhood,
        filterCompany: jobsPage.filterCompany,
      });
    });

    await test.step('Job cards and pagination', async () => {
      await expect(jobsPage.jobCardTitles).toHaveCount(9);
      await expect(jobsPage.knowMoreLinks).toHaveCount(9);
      await expect(jobsPage.applyNowLinks).toHaveCount(9);
      await jobsPage.verifyAllWithHighlight({
        firstJobCardTitle: jobsPage.jobCardTitles.first(),
        firstKnowMore: jobsPage.knowMoreLinks.first(),
        firstApplyNow: jobsPage.applyNowLinks.first(),
        pagination: jobsPage.pagination,
      });
      await expect(jobsPage.activePage).toHaveText('1');
    });

    await test.step('Why Riders Choose Us', async () => {
      await jobsPage.verifyAndHighlight('whyHeading', jobsPage.whyHeading);
      await jobsPage.verifyAllWithHighlight(jobsPage.benefitItems);
    });

    await test.step('Testimonials', async () => {
      await jobsPage.verifyAndHighlight('testimonialsHeading', jobsPage.testimonialsHeading);
      expect(await jobsPage.testimonials.count()).toBeGreaterThanOrEqual(3);
      await expect(jobsPage.testimonialDots).toHaveCount(2);
    });

    await test.step('FAQ', async () => {
      await jobsPage.verifyAndHighlight('faqHeading', jobsPage.faqHeading);
      await jobsPage.verifyAllWithHighlight(jobsPage.faqButtons);
    });

    await test.step('About + bottom CTA', async () => {
      await jobsPage.verifyAllWithHighlight({
        aboutRegion: jobsPage.aboutRegion,
        bottomCtaHeading: jobsPage.bottomCtaHeading,
        bottomApplyLink: jobsPage.bottomApplyLink,
      });
    });

    await test.step('Footer', async () => {
      await jobsPage.verifyAllWithHighlight(jobsPage.footer.links);
    });
  });

  test('page has correct SEO basics', async ({ page }) => {
    const jobsPage = new JobsPage(page);
    await jobsPage.goto('ignore');

    await expect(page).toHaveTitle(/Delivery Jobs/i);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /vahan\.ai\/jobs\/$/);
  });
});
