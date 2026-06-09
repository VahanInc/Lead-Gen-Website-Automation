import { test, expect } from '../fixtures';
import { JobsPage } from '../../src/pages/JobsPage';

test.describe('Jobs page - UI element validation', () => {
  test('all page sections have the expected elements', async ({ page }) => {
    test.setTimeout(120_000);
    const jobsPage = new JobsPage(page);
    await jobsPage.goto();

    await test.step('Header', async () => {
      await jobsPage.verifyAllWithHighlight({
        ...jobsPage.headerNavItems,
        languageDropdown: jobsPage.languageDropdown,
        getStarted: jobsPage.getStartedButton,
        heroApplyNow: jobsPage.heroApplyNowButton,
      });
    });

    await test.step('Language dropdown options', async () => {
      await jobsPage.languageDropdown.click();
      await jobsPage.verifyAllWithHighlight(jobsPage.languageOptions);
      await page.keyboard.press('Escape');
    });

    await test.step('Hero', async () => {
      await jobsPage.verifyAllWithHighlight({
        heroHeading: jobsPage.heroHeading,
        heroSubheading: jobsPage.heroSubheading,
        trustedByLabel: jobsPage.trustedByLabel,
      });
      const logoCount = await jobsPage.trustedBrandLogos.count();
      expect(logoCount).toBeGreaterThan(0);
      await jobsPage.verifyAndHighlight('trustedBrandLogos', jobsPage.trustedBrandLogos.first());
    });

    await test.step('Filters', async () => {
      await jobsPage.verifyAllWithHighlight({
        filterCity: jobsPage.filterCity,
        filterNeighbourhood: jobsPage.filterNeighbourhood,
        filterCompany: jobsPage.filterCompany,
      });
    });

    await test.step('Job listings', async () => {
      await jobsPage.verifyAndHighlight('jobCountLabel', jobsPage.jobCountLabel);
      await jobsPage.verifyAndHighlight('pagination', jobsPage.pagination);
      const cardCount = await jobsPage.jobCards.count();
      expect(cardCount).toBeGreaterThan(0);
      await jobsPage.verifyAndHighlight('firstJobCard', jobsPage.jobCards.first());
      await jobsPage.verifyAndHighlight('jobCardKnowMore', jobsPage.knowMoreLinks.first());
      await jobsPage.verifyAndHighlight('jobCardApplyNow', jobsPage.jobApplyNowButtons.first());
    });

    await test.step('Alert Me', async () => {
      await jobsPage.verifyAllWithHighlight({
        alertHeading: jobsPage.alertHeading,
        areaNameInput: jobsPage.areaNameInput,
        alertWhatsAppInput: jobsPage.alertWhatsAppInput,
        alertSubmitButton: jobsPage.alertSubmitButton,
      });
    });

    await test.step('Benefits', async () => {
      await jobsPage.verifyAllWithHighlight(jobsPage.benefitItems);
    });

    await test.step('Testimonials', async () => {
      await jobsPage.verifyAllWithHighlight({
        testimonialsHeading: jobsPage.testimonialsHeading,
        testimonialPrevButton: jobsPage.testimonialPrevButton,
        testimonialNextButton: jobsPage.testimonialNextButton,
      });
    });

    await test.step('FAQ', async () => {
      await jobsPage.verifyAndHighlight('faqHeading', jobsPage.faqHeading);
      await jobsPage.verifyAllWithHighlight(jobsPage.faqItems);
    });

    await test.step('Footer', async () => {
      await jobsPage.verifyAllWithHighlight({
        footerHeading: jobsPage.footerHeading,
        footerWhatsAppInput: jobsPage.footerWhatsAppInput,
        footerContactButton: jobsPage.footerContactButton,
        ...jobsPage.footerLinks,
      });
    });
  });
});
