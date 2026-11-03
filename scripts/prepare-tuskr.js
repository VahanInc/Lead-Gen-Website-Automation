#!/usr/bin/env node
'use strict';

// Turns Playwright's results.xml into results-tuskr.xml, the file actually uploaded to Tuskr.
//
// - Tuskr ignores testCaseType in rules/tuskr-rules.json and fails every new case with
//   "Type is required"; the importer only honours it as a per-testcase <property>.
// - The tuskr CLI aborts the whole import on the first attachment it can't find, so keep
//   only screenshots that exist (traces/videos would also blow past Tuskr's size limits).
//
// Same fix as VahanInc/playwright_automation scripts/upload-tuskr.js.

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const SRC       = path.join(ROOT, 'results.xml');
const OUT       = path.join(ROOT, 'results-tuskr.xml');
const CASE_TYPE = process.env.TUSKR_TEST_CASE_TYPE || 'Functional';

if (!fs.existsSync(SRC)) {
  console.log('[Tuskr] results.xml not found — skipping.');
  process.exit(0);
}

const TYPE_PROP = `<property name="testCase[testCaseType]" value="${CASE_TYPE}"/>`;

let cases = 0;
let shots = 0;

// Skipped tests already carry a <properties> block (the skip reason); Tuskr only reads
// one block per testcase, so add the type into that block rather than a second one.
const xml = fs.readFileSync(SRC, 'utf8')
  .replace(/<testcase\b[^>]*?(?:\/>|>[\s\S]*?<\/testcase>)/g, (tc) => {
    cases++;
    if (tc.includes('<properties>')) return tc.replace('<properties>', `<properties>\n${TYPE_PROP}`);
    return tc.endsWith('/>')
      ? `${tc.slice(0, -2)}>\n<properties>${TYPE_PROP}</properties>\n</testcase>`
      : tc.replace(/^<testcase\b[^>]*>/, (open) => `${open}\n<properties>${TYPE_PROP}</properties>`);
  })
  .replace(/\[\[ATTACHMENT\|([^\]]+)\]\]/g, (_, p) => {
    const abs = path.resolve(path.dirname(SRC), p);
    if (!/\.(png|jpe?g)$/i.test(abs) || !fs.existsSync(abs)) return '';
    shots++;
    return `[[ATTACHMENT|${abs}]]`;
  });

fs.writeFileSync(OUT, xml);
console.log(`[Tuskr] ${cases} test cases typed as "${CASE_TYPE}", ${shots} screenshot(s) attached.`);
