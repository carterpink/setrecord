/**
 * SetSense full user-journey test.
 * Launches the Electron app, walks through every major feature,
 * saves screenshots to /tmp/shots/ for review.
 */
import { _electron as electron } from 'playwright-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '../../..');
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');

let app, page;
let stepIdx = 0;

async function shot(label) {
  const name = `${String(stepIdx).padStart(2,'0')}-${label}.png`;
  const f = path.join(SHOT_DIR, name);
  await page.screenshot({ path: f });
  console.log(`[screenshot] ${name}`);
  stepIdx++;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickSelector(sel, desc) {
  const r = await page.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return 'NOT_FOUND';
    el.click(); return 'OK';
  }, sel);
  console.log(`[click] ${desc || sel} → ${r}`);
  return r;
}

async function clickText(text) {
  const r = await page.evaluate(t => {
    const all = [...document.querySelectorAll('button, a, [role="button"], [role="tab"], li, div[class*="tab"], span[class*="tab"]')];
    const el = all.find(e => e.textContent?.trim() === t)
            ?? all.find(e => e.textContent?.includes(t));
    if (!el) return 'NOT_FOUND';
    el.click(); return 'OK: ' + el.tagName + ' "' + el.textContent?.trim().slice(0,40) + '"';
  }, text);
  console.log(`[click-text] "${text}" → ${r}`);
  return r;
}

async function getInnerText(sel) {
  return page.evaluate(s => document.querySelector(s)?.innerText?.slice(0, 500) ?? '(null)', sel);
}

async function countElements(sel) {
  return page.evaluate(s => document.querySelectorAll(s).length, sel);
}

async function evalInPage(expr) {
  try { return await page.evaluate(expr); }
  catch(e) { return `ERROR: ${e.message}`; }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
console.log('\n=== SetSense Automated User-Journey Test ===\n');

// 1. Launch
console.log('\n[1] Launching app...');
app = await electron.launch({
  executablePath: electronBin,
  args: [APP_DIR],
  env: { ...process.env },
  timeout: 60_000,
});

await sleep(6000);
const wins = app.windows();
page = wins.find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow();
await page.waitForLoadState('domcontentloaded').catch(() => {});
await sleep(3000);

console.log('Windows:', wins.map(w => w.url()));
await shot('01-initial-launch');

// ─── ONBOARDING / EMPTY STATE ─────────────────────────────────────────────
console.log('\n[2] Checking initial state / onboarding...');
const bodyText = await getInnerText('body');
console.log('Body text (first 500):\n', bodyText);
await shot('02-body-state');

// Check what tabs/nav are visible
const navItems = await evalInPage(() => {
  return [...document.querySelectorAll('[role="tab"], .tab, button')].map(el => el.textContent?.trim()).filter(Boolean).slice(0, 20);
});
console.log('Nav/buttons visible:', navItems);

// ─── TOP BAR ──────────────────────────────────────────────────────────────
console.log('\n[3] Checking TopBar...');
const topBar = await getInnerText('[class*="topbar"], [class*="top-bar"], header');
console.log('TopBar text:', topBar);
await shot('03-topbar');

// ─── PREPARE TAB ──────────────────────────────────────────────────────────
console.log('\n[4] Navigating to Prepare tab...');
await clickText('Prepare');
await sleep(1000);
await shot('04-prepare-tab');

// Check library panel
const trackCount = await countElements('[class*="track-row"], [class*="TrackRow"], li[class*="track"]');
console.log('Track rows visible:', trackCount);

// Check for import button / empty state
const importBtnText = await evalInPage(() => {
  const el = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Import'));
  return el ? el.textContent?.trim() : null;
});
console.log('Import button:', importBtnText);

await shot('04b-prepare-library');

// ─── LIBRARY PANELS & PLAYLIST SIDEBAR ───────────────────────────────────
console.log('\n[5] Library panel inspection...');
const libTabs = await evalInPage(() => {
  return [...document.querySelectorAll('[class*="library"] button, [class*="library"] [role="tab"]')]
    .map(el => el.textContent?.trim()).filter(Boolean);
});
console.log('Library sub-tabs:', libTabs);

// Try clicking Library sub-tabs
for (const tab of ['Library', 'Crates', 'Sets']) {
  await clickText(tab);
  await sleep(500);
}
await shot('05-library-panels');

// ─── SEARCH ───────────────────────────────────────────────────────────────
console.log('\n[6] Testing search...');
const searchInput = await page.evaluate(() => {
  const el = document.querySelector('input[placeholder*="Search"], input[type="search"], input[placeholder*="search"]');
  return el ? el.placeholder : null;
});
console.log('Search input placeholder:', searchInput);
if (searchInput) {
  await clickSelector('input[placeholder*="Search"], input[type="search"], input[placeholder*="search"]', 'search input');
  await page.keyboard.type('test', { delay: 50 });
  await sleep(500);
  await shot('06-search-results');
  // Clear search
  await page.keyboard.selectAll();
  await page.keyboard.press('Backspace');
  await sleep(300);
}

// ─── SET TIMELINE ─────────────────────────────────────────────────────────
console.log('\n[7] Checking timeline/set panel...');
await shot('07-timeline-area');

const setInfo = await evalInPage(() => {
  const el = document.querySelector('[class*="timeline"], [class*="Timeline"]');
  return el ? el.innerText?.slice(0, 200) : '(not found)';
});
console.log('Timeline text:', setInfo);

// ─── TOP BAR BUTTONS ─────────────────────────────────────────────────────
console.log('\n[8] Testing TopBar action buttons...');
const topBarBtns = await evalInPage(() => {
  return [...document.querySelectorAll('header button, [class*="topbar"] button, [class*="TopBar"] button')]
    .map(b => ({ text: b.textContent?.trim(), title: b.title, ariaLabel: b.getAttribute('aria-label') }))
    .filter(b => b.text || b.title || b.ariaLabel);
});
console.log('TopBar buttons:', JSON.stringify(topBarBtns, null, 2));

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────
console.log('\n[9] Opening Settings...');
await clickText('Settings');
await sleep(800);
await shot('09-settings-modal');
const settingsText = await getInnerText('[role="dialog"], [class*="modal"], [class*="Modal"]');
console.log('Settings content (first 300):', settingsText?.slice(0, 300));
// Close with Escape
await page.keyboard.press('Escape');
await sleep(500);

// ─── SET ARCHITECT ────────────────────────────────────────────────────────
console.log('\n[10] Testing Set Architect button...');
// Look for the Set Architect button/icon in TopBar
const architectBtn = await evalInPage(() => {
  const btns = [...document.querySelectorAll('button, [role="button"]')];
  const el = btns.find(b => b.title?.includes('Architect') || b.textContent?.includes('Architect') || b.getAttribute('aria-label')?.includes('Architect'));
  return el ? { text: el.textContent?.trim(), title: el.title, label: el.getAttribute('aria-label') } : null;
});
console.log('Architect button:', architectBtn);

if (architectBtn) {
  await clickText('Architect');
  await sleep(800);
  await shot('10-set-architect-modal');
  await page.keyboard.press('Escape');
  await sleep(500);
}

// ─── RECALL TAB ───────────────────────────────────────────────────────────
console.log('\n[11] Navigating to Recall tab...');
await clickText('Recall');
await sleep(1500);
await shot('11-recall-tab');

const recallText = await getInnerText('[class*="recall"], [class*="Recall"]');
console.log('Recall panel text (first 400):', recallText?.slice(0, 400));

// Check recall sections
const recallSections = await evalInPage(() => {
  return [...document.querySelectorAll('[class*="recall"] h2, [class*="recall"] h3, [class*="recall"] [class*="section"]')]
    .map(el => el.textContent?.trim()).filter(Boolean).slice(0, 10);
});
console.log('Recall sections:', recallSections);

await shot('11b-recall-detail');

// Try the Intelligence/Conversations section
await clickText('Conversations');
await sleep(800);
await shot('11c-recall-conversations');

// ─── DISCOVER TAB ─────────────────────────────────────────────────────────
console.log('\n[12] Navigating to Discover tab...');
await clickText('Discover');
await sleep(1500);
await shot('12-discover-tab');

const discoverText = await getInnerText('[class*="discover"], [class*="Discover"]');
console.log('Discover panel text (first 400):', discoverText?.slice(0, 400));

// ─── IMPORT MODAL ─────────────────────────────────────────────────────────
console.log('\n[13] Opening Import modal...');
await clickText('Prepare');
await sleep(500);
// Click Import button
await clickText('Import');
await sleep(800);
await shot('13-import-modal');
// Close
await page.keyboard.press('Escape');
await sleep(500);

// ─── NEW SET / SET OPERATIONS ─────────────────────────────────────────────
console.log('\n[14] Testing New Set creation...');
const newSetBtn = await evalInPage(() => {
  const btns = [...document.querySelectorAll('button')];
  const el = btns.find(b => b.textContent?.includes('New Set') || b.textContent?.includes('new set'));
  return el ? el.textContent?.trim() : null;
});
console.log('New Set button:', newSetBtn);
if (newSetBtn) {
  await clickText(newSetBtn);
  await sleep(800);
  await shot('14-new-set');
  await page.keyboard.press('Escape');
  await sleep(500);
}

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────
console.log('\n[15] Testing Export...');
await clickText('Export');
await sleep(800);
await shot('15-export-modal');
await page.keyboard.press('Escape');
await sleep(500);

// ─── FULL LAYOUT FINAL SHOT ───────────────────────────────────────────────
console.log('\n[16] Final full layout...');
await clickText('Prepare');
await sleep(1000);
await shot('16-final-prepare');

await clickText('Recall');
await sleep(1000);
await shot('16b-final-recall');

// ─── CONSOLE ERRORS ───────────────────────────────────────────────────────
console.log('\n[17] Collecting console errors...');
const consoleLogs = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleLogs.push(`[ERROR] ${msg.text()}`);
  if (msg.type() === 'warning') consoleLogs.push(`[WARN] ${msg.text()}`);
});
await sleep(1000);
if (consoleLogs.length) {
  console.log('Console errors/warnings:', consoleLogs.join('\n'));
} else {
  console.log('No console errors at exit check.');
}

// ─── DONE ─────────────────────────────────────────────────────────────────
console.log('\n=== Test complete. Screenshots in', SHOT_DIR, '===\n');
await sleep(1000);
await app.close();
process.exit(0);
