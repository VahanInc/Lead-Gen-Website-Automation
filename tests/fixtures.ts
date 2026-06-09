import { test as base, expect } from '@playwright/test';

export { expect };

export const test = base.extend<{ _testBanner: void }>({
  _testBanner: [
    async ({ page }, use, testInfo) => {
      const title = testInfo.titlePath.slice(1).join(' › ');
      await page.addInitScript((testTitle: string) => {
        function createBanner() {
          const banner = document.createElement('div');
          banner.id = 'pw-test-banner';
          banner.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'right:0',
            'z-index:2147483647',
            'background:rgba(10,10,10,0.93)',
            'color:#fff',
            'font-family:"SF Mono","Fira Code",monospace',
            'font-size:15px',
            'padding:10px 20px',
            'border-bottom:3px solid #FFD700',
            'pointer-events:none',
            'display:flex',
            'align-items:center',
            'gap:14px',
          ].join(';');
          banner.innerHTML = `
            <span style="color:#FFD700;font-weight:bold;font-size:16px;flex-shrink:0">▶ TEST</span>
            <span id="pw-live-element" style="color:#aaa;flex-shrink:0;font-size:13px"></span>
            <span style="margin-left:auto;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;font-weight:500">${testTitle}</span>
          `;
          return banner;
        }

        function ensureBanner() {
          if (!document.getElementById('pw-test-banner')) {
            document.body?.prepend(createBanner());
          }
        }

        function setup() {
          ensureBanner();
          // Re-inject whenever React or SPA navigation removes it from the DOM.
          new MutationObserver(ensureBanner).observe(document.body, { childList: true });
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', setup);
        } else {
          setup();
        }
      }, title);
      await use();
    },
    { auto: true },
  ],
});
