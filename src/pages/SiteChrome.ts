import { Page, Locator } from '@playwright/test';

/**
 * Header shared by every vahan.ai page.
 * Desktop: hover dropdowns (Solutions / Company / Resources) + "Case Studies" link.
 * Mobile (<~900px): the same nav lives in a slide-out drawer behind "Open menu".
 * Job-seeker pages (/jobs/*) show a language picker; the rest show "Contact Us".
 */
export class SiteHeader {
  readonly root: Locator;
  readonly logo: Locator;
  readonly nav: Locator;
  readonly menus: Record<'solutions' | 'company' | 'resources', Locator>;
  readonly menuLinks: Record<string, Locator>;
  readonly caseStudiesLink: Locator;
  readonly contactUsLink: Locator;
  readonly languageButton: Locator;
  readonly languageOptions: Record<'english' | 'hindi' | 'tamil' | 'kannada', Locator>;
  readonly mobileMenuButton: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('banner');
    this.logo = this.root.getByRole('link', { name: 'vahan' });
    this.nav = this.root.getByRole('navigation');
    this.menus = {
      solutions: this.nav.getByText('Solutions', { exact: true }),
      company: this.nav.getByText('Company', { exact: true }),
      resources: this.nav.getByText('Resources', { exact: true }),
    };
    this.menuLinks = {
      forCorporates: this.nav.getByRole('link', { name: 'For Corporates' }),
      forRecruitmentAgencies: this.nav.getByRole('link', { name: 'For Recruitment Agencies' }),
      forJobSeekers: this.nav.getByRole('link', { name: 'For Job Seekers' }),
      careers: this.nav.getByRole('link', { name: 'Careers' }),
      newsroom: this.nav.getByRole('link', { name: 'Newsroom' }),
      recruitmentAgencyStories: this.nav.getByRole('link', { name: 'Recruitment Agency Stories' }),
      riderHub: this.nav.getByRole('link', { name: 'Rider Hub' }),
    };
    this.caseStudiesLink = this.nav.getByRole('link', { name: 'Case Studies' });
    this.contactUsLink = this.root.getByRole('link', { name: 'Contact Us' });
    // The button's accessible name is the currently selected language.
    this.languageButton = this.root.getByRole('button', {
      name: /^(English|हिंदी|தமிழ்|ಕನ್ನಡ)$/,
    }).first();
    this.languageOptions = {
      english: this.root.getByRole('option', { name: 'English', exact: true }),
      hindi: this.root.getByRole('option', { name: 'हिंदी', exact: true }),
      tamil: this.root.getByRole('option', { name: 'தமிழ்', exact: true }),
      kannada: this.root.getByRole('option', { name: 'ಕನ್ನಡ', exact: true }),
    };
    this.mobileMenuButton = this.root.getByRole('button', { name: /Open menu|Close menu/ });
  }

  /**
   * Desktop hover menus fade/slide in; clicking mid-animation misses and the
   * mouse move then drops :hover. Hover the trigger, wait for the dropdown's
   * animations to finish, then hover the link itself before clicking.
   */
  async navigateViaMenu(menu: keyof SiteHeader['menus'], link: string) {
    const target = this.menuLinks[link];
    await this.menus[menu].hover();
    await target.waitFor({ state: 'visible' });
    await target.evaluate(el =>
      Promise.all((el.closest('.dropdown') ?? el).getAnimations({ subtree: true }).map(a => a.finished)),
    );
    await target.hover();
    await target.click();
  }
}

export class SiteFooter {
  readonly root: Locator;
  readonly links: Record<string, Locator>;

  constructor(page: Page) {
    this.root = page.getByRole('contentinfo');
    const link = (name: string) => this.root.getByRole('link', { name, exact: true });
    this.links = {
      forCorporates: link('For Corporates'),
      forRecruitmentAgencies: link('For Recruitment Agencies'),
      forJobSeekers: link('For Job Seekers'),
      careers: link('Careers'),
      newsroom: link('Newsroom'),
      recruitmentAgencyStories: link('Recruitment Agency Stories'),
      riderHub: link('Rider Hub'),
      caseStudies: link('Case Studies'),
      email: link('info@vahan.ai'),
      privacyPolicy: link('Privacy Policy'),
      termsAndConditions: link('Terms & Conditions'),
      linkedIn: link('Vahan on LinkedIn'),
      youTube: link('Vahan on YouTube'),
    };
  }
}
