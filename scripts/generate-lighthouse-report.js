#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const REPORT_DIR  = path.resolve(__dirname, '..', 'lighthouse-report');
const MANIFEST    = path.join(REPORT_DIR, 'manifest.json');
const HTML_PATH   = path.join(REPORT_DIR, 'summary.html');
const PNG_PATH    = path.join(REPORT_DIR, 'summary.png');

// ── score helpers ─────────────────────────────────────────────────────────────

function color(score) {
  if (score >= 90) return '#0cce6b';
  if (score >= 50) return '#ffa400';
  return '#ff4e42';
}

function label(score) {
  if (score >= 90) return 'Good';
  if (score >= 50) return 'Needs Improvement';
  return 'Poor';
}

// SVG arc circle: radius 40, stroke-width 8
const CIRC = 2 * Math.PI * 40; // 251.33

function scoreCircle(raw) {
  const pct   = Math.round(raw * 100);
  const c     = color(pct);
  const filled = ((pct / 100) * CIRC).toFixed(1);
  const gap    = (CIRC - filled).toFixed(1);
  return `
    <svg viewBox="0 0 100 100" width="90" height="90">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#e8e8e8" stroke-width="8"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="${c}" stroke-width="8"
        stroke-dasharray="${filled} ${gap}" stroke-linecap="round"
        transform="rotate(-90 50 50)"/>
      <text x="50" y="57" text-anchor="middle"
        font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"
        font-size="24" font-weight="700" fill="${c}">${pct}</text>
    </svg>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${c};margin-top:2px">${label(pct)}</div>`;
}

// ── read manifest ─────────────────────────────────────────────────────────────

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  console.error('Could not read manifest.json:', e.message);
  process.exit(1);
}

const runs = manifest.filter(r => r.isRepresentativeRun);

const CATS = [
  { key: 'performance',    label: 'Performance'    },
  { key: 'accessibility',  label: 'Accessibility'  },
  { key: 'best-practices', label: 'Best Practices' },
  { key: 'seo',            label: 'SEO'            },
];

// ── build HTML ────────────────────────────────────────────────────────────────

function pageCard(run) {
  const shortUrl = run.url.replace(/^https?:\/\//, '');
  const circles  = CATS.map(c => `
      <div style="text-align:center;flex:1;min-width:90px">
        ${scoreCircle(run.summary[c.key] ?? 0)}
        <div style="font-size:11px;color:#555;margin-top:6px;font-weight:600">${c.label}</div>
      </div>`).join('');

  return `
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.1);overflow:hidden;margin-bottom:18px">
    <div style="background:#0f172a;padding:12px 20px;font-size:13px;font-weight:600;color:#e2e8f0;font-family:monospace">
      ${shortUrl}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:20px 16px;justify-content:space-around">
      ${circles}
    </div>
  </div>`;
}

const now = new Date().toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
});

const body = `
<div style="background:#f1f5f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:600px">

  <!-- header -->
  <div style="background:#0f172a;color:#fff;border-radius:10px;padding:18px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-size:18px;font-weight:700">🔦 Lighthouse CI Report</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:3px">${runs.length} page${runs.length !== 1 ? 's' : ''} audited &nbsp;·&nbsp; 3 runs averaged per page</div>
    </div>
    <div style="font-size:12px;color:#94a3b8">${now} IST</div>
  </div>

  <!-- page cards -->
  ${runs.map(pageCard).join('')}

  <!-- legend -->
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.1);padding:18px 22px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:14px">Score Legend</div>
    <div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:14px;height:14px;border-radius:50%;background:#0cce6b;flex-shrink:0"></div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1e293b">Good &nbsp;<span style="font-weight:400;color:#64748b">(90 – 100)</span></div>
          <div style="font-size:11px;color:#94a3b8">Meets or exceeds the recommended threshold</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:14px;height:14px;border-radius:50%;background:#ffa400;flex-shrink:0"></div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1e293b">Needs Improvement &nbsp;<span style="font-weight:400;color:#64748b">(50 – 89)</span></div>
          <div style="font-size:11px;color:#94a3b8">Some issues that should be addressed</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:14px;height:14px;border-radius:50%;background:#ff4e42;flex-shrink:0"></div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1e293b">Poor &nbsp;<span style="font-weight:400;color:#64748b">(0 – 49)</span></div>
          <div style="font-size:11px;color:#94a3b8">Significant issues — requires immediate attention</div>
        </div>
      </div>
    </div>
    <div style="border-top:1px solid #f0f0f0;padding-top:12px;font-size:11px;color:#94a3b8;line-height:1.6">
      <strong style="color:#475569">CI Thresholds:</strong>
      &nbsp; Accessibility &ge; 90 <span style="color:#ef4444;font-weight:600">(fails build)</span>
      &nbsp;&middot;&nbsp; Performance &ge; 70, Best Practices &ge; 80, SEO &ge; 80
      <span style="color:#f59e0b;font-weight:600">(warnings only)</span>
    </div>
  </div>

</div>`;

const htmlEmbedded = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lighthouse CI Report – Lead Gen</title>
</head>
<body style="margin:0;padding:0">${body}</body>
</html>`;

// ── write & screenshot ────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(HTML_PATH, htmlEmbedded, 'utf8');
  console.log(`Lighthouse HTML  → ${HTML_PATH}`);

  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 900, height: 600 });
    await page.setContent(htmlEmbedded, { waitUntil: 'networkidle' });
    const png = await page.screenshot({ fullPage: true });
    fs.writeFileSync(PNG_PATH, png);
    console.log(`Lighthouse PNG   → ${PNG_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error('generate-lighthouse-report failed:', e.message); process.exit(1); });
