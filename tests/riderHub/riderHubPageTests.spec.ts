import { test, expect } from '../fixtures';
import { RiderHubPage } from '../../src/pages/RiderHubPage';

test.describe('RiderHub page - UI element validation', () => {
  test('all page sections have the expected elements', async ({ page }) => {
    test.setTimeout(120_000);
    const riderHubPage = new RiderHubPage(page);
    await riderHubPage.goto();

    await test.step('Hero', async () => {
      await riderHubPage.verifyAndHighlight('heroHeading', riderHubPage.heroHeading);
    });

    await test.step('Video category filter tabs', async () => {
      await riderHubPage.verifyAllWithHighlight(riderHubPage.filterTabs);
    });

    await test.step('Video cards', async () => {
      const count = await riderHubPage.videoCards.count();
      expect(count).toBeGreaterThan(0);
      await riderHubPage.verifyAndHighlight('firstVideoCard', riderHubPage.videoCards.first());
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
      await riderHubPage.verifyAndHighlight('latestBlogHeading', riderHubPage.latestBlogHeading);
      const blogCount = await riderHubPage.blogCards.count();
      expect(blogCount).toBeGreaterThan(0);
      await riderHubPage.verifyAndHighlight('firstBlogCard', riderHubPage.blogCards.first());
      await riderHubPage.verifyAndHighlight('seeMoreBlogsLink', riderHubPage.seeMoreBlogsLink);
    });

    await test.step('Browse All Jobs CTA', async () => {
      await riderHubPage.verifyAndHighlight('browseAllJobsLink', riderHubPage.browseAllJobsLink);
    });

    await test.step('Footer', async () => {
      await riderHubPage.verifyAllWithHighlight({
        footerWhatsAppInput: riderHubPage.footerWhatsAppInput,
        footerContactButton: riderHubPage.footerContactButton,
      });
    });
  });
});
