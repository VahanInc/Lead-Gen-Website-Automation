import { test, expect } from '../fixtures';
import { RiderHubPage } from '../../src/pages/RiderHubPage';

test.describe('RiderHub page - UI element validation', () => {
  test('all page sections have the expected elements', async ({ page }) => {
    test.setTimeout(120_000);
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await test.step('Header', async () => {
      await riderHubPage.verifyAllWithHighlight({
        logo: riderHubPage.header.logo,
        solutionsMenu: riderHubPage.header.menus.solutions,
        companyMenu: riderHubPage.header.menus.company,
        resourcesMenu: riderHubPage.header.menus.resources,
        caseStudies: riderHubPage.header.caseStudiesLink,
        contactUs: riderHubPage.header.contactUsLink,
      });
    });

    await test.step('Hero + featured video', async () => {
      await riderHubPage.verifyAllWithHighlight({
        heroHeading: riderHubPage.heroHeading,
        heroSubheading: riderHubPage.heroSubheading,
        featuredVideo: riderHubPage.featuredVideo,
      });
    });

    await test.step('Video category tabs', async () => {
      await riderHubPage.verifyAllWithHighlight(riderHubPage.categoryTabs);
      await expect(riderHubPage.selectedTab).toHaveText('All');
    });

    await test.step('Video grid + pager', async () => {
      await expect(riderHubPage.videoCards).toHaveCount(4);
      await riderHubPage.verifyAllWithHighlight({
        firstVideoCard: riderHubPage.videoCards.first(),
        videoPager: riderHubPage.videoPager,
      });
      await expect(riderHubPage.previousPage).toBeDisabled();
      await expect(riderHubPage.nextPage).toBeEnabled();
    });

    await test.step('Jobs Near You', async () => {
      await riderHubPage.verifyAndHighlight('jobsNearYouHeading', riderHubPage.jobsNearYouHeading);
      await expect(riderHubPage.jobKnowMoreLinks).toHaveCount(3);
      await expect(riderHubPage.jobApplyLinks).toHaveCount(3);
      await riderHubPage.verifyAndHighlight('browseAllJobsLink', riderHubPage.browseAllJobsLink);
    });

    await test.step('Alert Me', async () => {
      await riderHubPage.verifyAllWithHighlight({
        alertHeading: riderHubPage.alertHeading,
        areaNameInput: riderHubPage.areaNameInput,
        alertWhatsAppInput: riderHubPage.alertWhatsAppInput,
        alertSubmitButton: riderHubPage.alertSubmitButton,
      });
    });

    await test.step('Blog section', async () => {
      await riderHubPage.verifyAndHighlight('blogRegion', riderHubPage.blogRegion);
      await expect(riderHubPage.blogCards).toHaveCount(3);
      await riderHubPage.verifyAndHighlight('firstBlogCard', riderHubPage.blogCards.first());
      await riderHubPage.verifyAndHighlight('viewAllBlogsLink', riderHubPage.viewAllBlogsLink);
    });

    await test.step('Footer', async () => {
      await riderHubPage.verifyAllWithHighlight(riderHubPage.footer.links);
    });
  });
});
