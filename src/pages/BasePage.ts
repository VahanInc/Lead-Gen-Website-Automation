import { Page, Locator, expect } from '@playwright/test';
import { WHATSAPP_URL_PATTERN } from '../constants/urls';
import { SiteFooter, SiteHeader } from './SiteChrome';

export type Language = 'english' | 'hindi' | 'tamil' | 'kannada';

export class BasePage {
  readonly header: SiteHeader;
  readonly footer: SiteFooter;

  constructor(protected page: Page) {
    this.header = new SiteHeader(page);
    this.footer = new SiteFooter(page);
  }

  /**
   * Captures (and aborts) any request to WhatsApp so the test never leaves vahan.ai.
   * Context-level so target="_blank" popups and window.open are caught too.
   * Returns a getter for the last captured URL — poll it after the click.
   */
  async interceptWhatsAppNavigation(): Promise<() => string> {
    let capturedUrl = '';
    await this.page.context().route(WHATSAPP_URL_PATTERN, async route => {
      capturedUrl = route.request().url();
      await route.abort();
    });
    return () => capturedUrl;
  }

  /** Language picker (job-seeker pages only). Choice is persisted in localStorage. */
  async switchLanguage(to: Language): Promise<void> {
    await this.header.languageButton.click();
    await this.header.languageOptions[to].click();
    await expect(this.page.locator('html')).toHaveAttribute(
      'lang',
      { english: 'en', hindi: 'hi', tamil: 'ta', kannada: /ka|kn/ }[to] as string | RegExp,
    );
  }

  async verifyAndHighlight(name: string, locator: Locator): Promise<void> {
    await expect(locator, `${name} should be visible`).toBeVisible();
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate((el: HTMLElement, label: string) => {
      const prevOutline = el.style.outline;
      const prevBg = el.style.backgroundColor;
      const prevShadow = el.style.boxShadow;
      el.style.outline = '3px solid #FFD700';
      el.style.backgroundColor = 'rgba(255, 215, 0, 0.28)';
      el.style.boxShadow = '0 0 0 5px rgba(255, 215, 0, 0.35)';
      el.style.transition = 'all 0.15s ease';
      const liveEl = document.getElementById('pw-live-element');
      if (liveEl) liveEl.textContent = `▶ ${label}`;
      setTimeout(() => {
        el.style.outline = prevOutline;
        el.style.backgroundColor = prevBg;
        el.style.boxShadow = prevShadow;
        const live = document.getElementById('pw-live-element');
        if (live) live.textContent = '';
      }, 350);
    }, name);
    await this.page.waitForTimeout(350);
  }

  async verifyAllWithHighlight(
    elements: Record<string, Locator>,
    options?: { minCount?: number }
  ): Promise<void> {
    const entries = Object.entries(elements);
    if (options?.minCount !== undefined) {
      expect(entries.length).toBeGreaterThanOrEqual(options.minCount);
    }
    const results: { name: string; found: boolean }[] = [];
    for (const [name, locator] of entries) {
      try {
        await this.verifyAndHighlight(name, locator);
        results.push({ name, found: true });
      } catch (e) {
        results.push({ name, found: false });
        await this._renderElementPanel(results).catch(() => {});
        throw e;
      }
      await this._renderElementPanel(results);
    }
  }

  protected async _renderElementPanel(results: { name: string; found: boolean }[]): Promise<void> {
    await this.page.evaluate((items) => {
      let panel = document.getElementById('pw-element-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'pw-element-panel';
        panel.style.cssText = [
          'position:fixed',
          'bottom:12px',
          'right:12px',
          'z-index:2147483647',
          'background:rgba(10,10,10,0.92)',
          'color:#e0e0e0',
          'font-family:"SF Mono","Fira Code",monospace',
          'font-size:11px',
          'line-height:1.65',
          'padding:10px 14px',
          'border-radius:8px',
          'border:1px solid #FFD700',
          'max-width:300px',
          'max-height:420px',
          'overflow-y:auto',
          'pointer-events:none',
          'box-shadow:0 4px 24px rgba(0,0,0,0.7)',
        ].join(';');
        document.body.appendChild(panel);
      }
      const passCount = items.filter(i => i.found).length;
      const rows = items
        .map(item => {
          const icon = item.found ? '✓' : '✗';
          const color = item.found ? '#66bb6a' : '#ef5350';
          return `<div style="color:${color}">${icon} ${item.name}</div>`;
        })
        .join('');
      panel.innerHTML = `
        <div style="color:#FFD700;font-weight:bold;margin-bottom:5px;font-size:12px;border-bottom:1px solid #333;padding-bottom:3px">
          Elements ${passCount}/${items.length}
        </div>
        ${rows}
      `;
    }, results);
  }
}
