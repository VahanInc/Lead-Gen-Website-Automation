#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const XML_PATH = path.join(__dirname, '..', 'test-results', 'junit.xml');
const OUT_PATH = path.join(__dirname, '..', 'playwright-report', 'dashboard.html');

// ── XML helpers ───────────────────────────────────────────────────────────────

function attr(str, name) {
  const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(str);
  return m ? m[1] : '';
}

function parseXML(xml) {
  const suiteRx = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
  const suites  = [];
  let sm;
  while ((sm = suiteRx.exec(xml)) !== null) {
    const body    = sm[2];
    const caseRx  = /<testcase([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    const cases   = [];
    let cm;
    while ((cm = caseRx.exec(body)) !== null) {
      const cBody = cm[2] || '';
      cases.push({
        name:    attr(cm[1], 'name'),
        time:    parseFloat(attr(cm[1], 'time') || '0'),
        failed:  cBody.includes('<failure'),
        skipped: cBody.includes('<skipped'),
      });
    }
    suites.push({ name: attr(sm[1], 'name'), cases });
  }
  const tm = /<testsuites[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*skipped="(\d+)"[^>]*time="([\d.]+)"/.exec(xml);
  return {
    suites,
    totals: tm
      ? { tests: +tm[1], failures: +tm[2], skipped: +tm[3], time: +tm[4] }
      : { tests: 0, failures: 0, skipped: 0, time: 0 },
  };
}

// ── categorisation ────────────────────────────────────────────────────────────

function categorise(name) {
  const n = name.toLowerCase();
  if (/does not|empty phone|empty footer|wrong|not allow|not accept|not navigate|not submit|not proceed|non.numeric|shorter than|area alone|not enable|unregistered/.test(n))
    return 'negative';
  if (/rapid|zero.result|duplicate|overflow|break|broken|previous from|internal space|strips space|long translated|language switch with/.test(n))
    return 'edge';
  return 'positive';
}

function featureLabel(suiteName) {
  if (suiteName.startsWith('jobs/jobsPageTests'))          return 'Jobs Page – UI Validation';
  if (suiteName.startsWith('jobs/'))                       return 'Jobs Page – Interactions';
  if (suiteName.startsWith('riderHub/riderHubPageTests'))  return 'RiderHub – UI Validation';
  if (suiteName.startsWith('riderHub/'))                   return 'RiderHub – Interactions';
  return suiteName;
}

const CARD_COLOURS = ['#2563eb', '#7c3aed', '#059669', '#d97706'];

// ── build data ────────────────────────────────────────────────────────────────

const xml = fs.readFileSync(XML_PATH, 'utf8');
const { suites, totals } = parseXML(xml);

const features = suites.map((s, i) => {
  const pos = [], neg = [], edge = [];
  for (const tc of s.cases) {
    const obj = { name: tc.name, failed: tc.failed, skipped: tc.skipped };
    const cat = categorise(tc.name);
    if (cat === 'negative') neg.push(obj);
    else if (cat === 'edge') edge.push(obj);
    else pos.push(obj);
  }
  return { label: featureLabel(s.name), colour: CARD_COLOURS[i % CARD_COLOURS.length], count: s.cases.length, pos, neg, edge };
});

const passing    = totals.tests - totals.failures - totals.skipped;
const runtimeMin = Math.max(1, Math.round(totals.time / 60));
const manualMin  = Math.round(totals.tests * 3.5);
const savedMin   = manualMin - runtimeMin;

function fmtTime(min) {
  if (min < 60) return `~${min} min`;
  return `~${Math.floor(min / 60)} hr ${min % 60} min`;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function testRow({ name, failed, skipped }) {
  const icon = failed ? '✗' : skipped ? '○' : '✓';
  const cls  = failed ? 'fail' : skipped ? 'skip' : 'pass';
  return `<li class="tr ${cls}"><span class="ic">${icon}</span>${esc(name)}</li>`;
}

function section(items, dotCls, label) {
  if (!items.length) return '';
  return `
    <div class="sec">
      <div class="sec-head"><span class="dot ${dotCls}"></span>${label} (${items.length})</div>
      <ul class="tlist">${items.map(testRow).join('')}</ul>
    </div>`;
}

// ── HTML ──────────────────────────────────────────────────────────────────────

const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

const statsRows = [
  { v: totals.tests,            l: 'Total Tests',       c: '#059669' },
  { v: passing,                 l: 'Passing',           c: '#059669' },
  { v: totals.failures,         l: 'Failures',          c: totals.failures ? '#dc2626' : '#6b7280' },
  { v: totals.skipped,          l: 'Skipped',           c: '#d97706' },
  { v: features.length,         l: 'Features Covered',  c: '#2563eb' },
  { v: fmtTime(runtimeMin),     l: 'Suite Runtime',     c: '#059669' },
  { v: fmtTime(manualMin),      l: 'Manual Equivalent', c: '#7c3aed' },
  { v: fmtTime(savedMin),       l: 'Time Saved / Run',  c: '#e11d48' },
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test Coverage – Lead Gen Website</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b}
header{background:#0f172a;color:#fff;padding:22px 40px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
header h1{font-size:20px;font-weight:700}
header h1 em{color:#38bdf8;font-style:normal}
header time{font-size:12px;color:#94a3b8}
main{max-width:1300px;margin:0 auto;padding:32px 24px}
/* stats */
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:40px}
.stat{background:#fff;border-radius:12px;padding:18px 14px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.stat .v{font-size:32px;font-weight:800;line-height:1}
.stat .l{font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#64748b;margin-top:5px;font-weight:600}
/* section title */
.st{font-size:18px;font-weight:700;margin-bottom:18px;color:#0f172a;display:flex;align-items:center;gap:8px}
.st::before{content:'';display:inline-block;width:4px;height:20px;background:#38bdf8;border-radius:2px}
/* grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(500px,1fr));gap:22px}
/* card */
.card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.ch{padding:14px 18px;display:flex;justify-content:space-between;align-items:center}
.ch h3{color:#fff;font-size:15px;font-weight:700}
.badge{background:rgba(255,255,255,.22);color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px}
.cb{padding:14px 18px}
/* sections */
.sec{margin-bottom:12px}
.sec:last-child{margin-bottom:0}
.sec-head{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#64748b;margin-bottom:7px}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dp{background:#22c55e}.dn{background:#ef4444}.de{background:#f59e0b}
/* test rows */
ul.tlist{list-style:none}
li.tr{display:flex;align-items:flex-start;gap:7px;font-size:12.5px;line-height:1.55;padding:2px 0}
li.tr .ic{flex-shrink:0;width:14px;text-align:center;font-size:11px;margin-top:1px}
li.tr.pass .ic{color:#22c55e}
li.tr.fail .ic{color:#ef4444}
li.tr.skip .ic{color:#94a3b8}
li.tr.fail{color:#dc2626}
li.tr.skip{color:#94a3b8;font-style:italic}
footer{text-align:center;padding:20px;font-size:11px;color:#94a3b8}
@media(max-width:600px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<header>
  <h1>Lead Gen Website &mdash; <em>Test Coverage Report</em></h1>
  <time>${now} IST</time>
</header>
<main>
  <div class="stats">
    ${statsRows.map(s => `<div class="stat"><div class="v" style="color:${s.c}">${s.v}</div><div class="l">${s.l}</div></div>`).join('\n    ')}
  </div>

  <p class="st">Feature-wise Test Coverage</p>
  <div class="grid">
    ${features.map(f => `
    <div class="card">
      <div class="ch" style="background:${f.colour}">
        <h3>${esc(f.label)}</h3>
        <span class="badge">${f.count} test${f.count !== 1 ? 's' : ''}</span>
      </div>
      <div class="cb">
        ${section(f.pos,  'dp', 'Happy Flows')}
        ${section(f.neg,  'dn', 'Negative Scenarios')}
        ${section(f.edge, 'de', 'Edge Cases')}
      </div>
    </div>`).join('')}
  </div>
</main>
<footer>Generated by Playwright CI &middot; Vahan Lead Gen Website</footer>
</body>
</html>`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, html, 'utf8');
console.log(`Dashboard written → ${OUT_PATH}`);
