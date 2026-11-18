// Site moved from vahan.co to vahan.ai (apex redirects to www). BASE_URL should be
// https://www.vahan.ai — the default in playwright.config.ts.
export const DEFAULT_BASE_URL = 'https://www.vahan.ai';

export const ROUTES = {
  home: '/',
  jobs: '/jobs/',
  riderHub: '/rider-adda/',
  blog: '/blog/',
  corporate: '/corporate/',
  recruitmentAgencies: '/recruitment-agencies/',
  careers: '/careers/',
  newsroom: '/newsroom/',
  partnerStories: '/partner-stories/',
  caseStudies: '/case-studies/',
  contact: '/contact/',
} as const;

export const WHATSAPP_URL_PATTERN = /api\.whatsapp\.com|wa\.me/;
export const VAHAN_WHATSAPP_PHONE = '919964051511';
