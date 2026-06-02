/**
 * SetSense walkthrough — Part 2 (picks up from step 7)
 * Covers: timeline interactions, modals, Recall, Discover, cue points
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
let stepIdx = 7;

async function shot(label) {
  const name = `${String(stepIdx).padStart(2,'0')}-${label}.png`;
  const f = path.join(SHOT_DIR, name);
  await page.screenshot({ path: f });
  console.log(`[screenshot] ${name}`);
  stepIdx++;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function click(sel, desc) {
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
    const all = [...document.querySelectorAll('button, a, [role="button"], [role="tab"], li, div, span')];
    const el = all.find(e => e.textContent?.trim() === t)
            ?? all.find(e => e.textContent?.includes(t));
    if (!el) return 'NOT_FOUND';
    el.click(); return 'OK: ' + el.tagName + '.' + [...el.classList].join('.') + ' "' + el.textContent?.trim().slice(0,40) + '"';
  }, text);
  console.log(`[click-text] "${text}" → ${r}`);
  return r;
}

async function getText(sel) {
  return page.evaluate(s => document.querySelector(s)?.innerText?.slice(0, 600) ?? '(null)', sel);
}

async function evalPage(expr) {
  try { return await page.evaluate(expr); }
  catch(e) { return `ERROR: ${e.message}`; }
}

async function countEls(sel) {
  return page.evaluate(s => document.querySelectorAll(s).length, sel);
}

// ── LAUNCH ──────────────────────────────────────────────────────────────────
console.log('\n=== SetSense Walkthrough Part 2 ===\n');
app = await electron.launch({
  executablePath: electronBin,
  args: [APP_DIR],
  env: { ...process.env },
  timeout: 60_000,
});
await sleep(7000);
const wins = app.windows();
page = wins.find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow();
await page.waitForLoadState('domcontentloaded').catch(() => {});
await sleep(3000);
console.log('Launched. Windows:', wins.map(w => w.url()));

// ── STEP 7: SEARCH INTERACTION ───────────────────────────────────────────
console.log('\n[7] Search functionality...');
await click('input[placeholder*="Search"]', 'search input');
await page.keyboard.type('cops', { delay: 50 });
await sleep(800);
await shot('search-typing');
// Check what filtered
const trackCount = await countEls('[class*="track-row"], [class*="TrackRow"]');
console.log('Tracks visible after search:', trackCount);
// Clear with Ctrl+A then Delete
await page.keyboard.press('Meta+a');
await page.keyboard.press('Backspace');
await sleep(400);

// ── STEP 8: PLAYLIST SIDEBAR INTERACTION ─────────────────────────────────
console.log('\n[8] Playlist sidebar...');
await clickText('Prepare');
await sleep(500);
// Try clicking a playlist
const playlistItem = await evalPage(() => {
  const items = [...document.querySelectorAll('[class*="playlist"], [class*="Playlist"]')];
  return items.map(el => ({ tag: el.tagName, cls: [...el.classList].join(' '), text: el.textContent?.trim().slice(0,30) })).slice(0, 8);
});
console.log('Playlist items found:', JSON.stringify(playlistItem, null, 2));

// click the first non-folder playlist item in sidebar
const clicked = await evalPage(() => {
  // find leaf items (not folders) in the sidebar
  const items = [...document.querySelectorAll('[class*="playlist-item"], [class*="PlaylistItem"]')];
  const leaf = items.find(el => !el.textContent?.includes('▶') || el.textContent?.includes('All Tracks'));
  if (!leaf) {
    // fall back: click any clickable playlist entry
    const all = [...document.querySelectorAll('[class*="sidebar"] li, [class*="sidebar"] [role="treeitem"]')];
    const el = all[3]; // skip All Tracks + ROOT, click 3rd item
    if (el) { el.click(); return 'clicked: ' + el.textContent?.trim().slice(0,30); }
    return 'NOT_FOUND';
  }
  leaf.click(); return 'clicked: ' + leaf.textContent?.trim().slice(0,30);
});
console.log('Playlist click:', clicked);
await sleep(800);
await shot('playlist-filter');

// Reset to All Tracks
await clickText('All Tracks');
await sleep(400);

// ── STEP 9: TRACK ROW INTERACTIONS ────────────────────────────────────────
console.log('\n[9] Track row interactions...');
// Click a track to select it
const firstTrack = await evalPage(() => {
  const row = document.querySelector('[class*="track-row"], [class*="TrackRow"]');
  if (!row) return null;
  row.click();
  return row.textContent?.trim().slice(0, 60);
});
console.log('Clicked first track:', firstTrack);
await sleep(500);
await shot('track-selected');

// Check suggestions panel updated
const suggestionsText = await getText('[class*="suggestion"], [class*="Suggestion"]');
console.log('Suggestions (first 200):', suggestionsText?.slice(0,200));
await shot('suggestions-updated');

// ── STEP 10: ENERGY + BPM FILTERS ────────────────────────────────────────
console.log('\n[10] Energy/BPM filter chips...');
await clickText('Energy');
await sleep(500);
await shot('energy-filter');
await clickText('BPM');
await sleep(500);
await shot('bpm-filter');
// Reset
await clickText('All library');
await sleep(400);

// ── STEP 11: ADD TRACK TO SET ─────────────────────────────────────────────
console.log('\n[11] Adding track to set via double-click...');
const addResult = await evalPage(() => {
  const rows = [...document.querySelectorAll('[class*="track-row"], [class*="TrackRow"]')];
  if (rows.length === 0) return 'no rows';
  // Double click first row to add to set
  const ev = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
  rows[0].dispatchEvent(ev);
  return 'dblclicked: ' + rows[0].textContent?.trim().slice(0,40);
});
console.log('Double-click result:', addResult);
await sleep(800);
await shot('track-added-to-set');

// Check timeline track count
const timelineTracks = await countEls('[class*="timeline-track"], [class*="TimelineTrack"], [class*="timeline"] [class*="card"]');
console.log('Timeline tracks:', timelineTracks);

// ── STEP 12: TIMELINE TRACK CARD INTERACTIONS ─────────────────────────────
console.log('\n[12] Timeline track card...');
const timelineCard = await evalPage(() => {
  const card = document.querySelector('[class*="timeline"] [class*="card"], [class*="timeline"] [class*="Card"]');
  if (!card) return 'NOT_FOUND';
  card.click();
  return card.textContent?.trim().slice(0,60);
});
console.log('Clicked timeline card:', timelineCard);
await sleep(500);
await shot('timeline-card-selected');

// ── STEP 13: CUE POINT EDITOR ─────────────────────────────────────────────
console.log('\n[13] Opening Cue Point Editor...');
// Look for the cue/edit button on a timeline card
const cueBtn = await evalPage(() => {
  // Try to find an edit/cue button on the active timeline card
  const btns = [...document.querySelectorAll('[class*="timeline"] button, [class*="timeline"] [role="button"]')];
  console.log('timeline buttons:', btns.map(b => b.textContent?.trim() + '|' + b.title + '|' + b.getAttribute('aria-label')));
  // try title or aria-label containing 'cue' or 'edit'
  const cue = btns.find(b => b.title?.toLowerCase().includes('cue') || b.getAttribute('aria-label')?.toLowerCase().includes('cue') || b.title?.toLowerCase().includes('edit'));
  if (cue) { cue.click(); return 'clicked cue btn: ' + cue.title; }
  return 'NOT_FOUND';
});
console.log('Cue button:', cueBtn);
await sleep(800);
await shot('cue-editor-attempt');

// If a modal opened
const modalText = await getText('[role="dialog"], [class*="modal"], [class*="Modal"]');
console.log('Modal opened:', modalText?.slice(0,100));
await page.keyboard.press('Escape');
await sleep(500);

// ── STEP 14: SET ARCHITECT ────────────────────────────────────────────────
console.log('\n[14] Set Architect modal...');
// Find the Architect button (wand/sparkle icon in topbar)
const archResult = await evalPage(() => {
  const btns = [...document.querySelectorAll('button, [role="button"]')];
  const el = btns.find(b =>
    b.title?.toLowerCase().includes('architect') ||
    b.getAttribute('aria-label')?.toLowerCase().includes('architect') ||
    b.textContent?.includes('Architect')
  );
  if (!el) {
    // dump all topbar button info
    const topBtns = [...document.querySelectorAll('header button, [class*="top"] button')];
    return 'NOT_FOUND. TopBar buttons: ' + topBtns.map(b => `${b.title}|${b.textContent?.trim()}|${b.getAttribute('aria-label')}`).join(', ');
  }
  el.click(); return 'OK: ' + el.title + ' / ' + el.textContent?.trim();
});
console.log('Architect click:', archResult);
await sleep(1200);
await shot('architect-modal-step1');

const archText = await getText('[role="dialog"], [class*="modal"]');
console.log('Architect modal text (first 400):', archText?.slice(0,400));

// Step through architect
await sleep(500);
// Find "Next" or "Generate" button
const nextBtn = await evalPage(() => {
  const btns = [...document.querySelectorAll('[role="dialog"] button, [class*="modal"] button')];
  const next = btns.find(b => b.textContent?.includes('Next') || b.textContent?.includes('Generate') || b.textContent?.includes('Build'));
  return next ? next.textContent?.trim() : null;
});
console.log('Next button in architect:', nextBtn);
if (nextBtn) {
  await clickText(nextBtn);
  await sleep(1000);
  await shot('architect-modal-step2');
}
await page.keyboard.press('Escape');
await sleep(500);

// ── STEP 15: SETTINGS MODAL ───────────────────────────────────────────────
console.log('\n[15] Settings modal...');
const settingsResult = await evalPage(() => {
  const btns = [...document.querySelectorAll('button, [role="button"]')];
  const el = btns.find(b =>
    b.title?.toLowerCase().includes('setting') ||
    b.getAttribute('aria-label')?.toLowerCase().includes('setting') ||
    b.textContent?.trim() === 'Settings'
  );
  if (!el) return 'NOT_FOUND. Buttons: ' + btns.slice(0,10).map(b => `"${b.textContent?.trim()}" title="${b.title}"`).join(', ');
  el.click(); return 'OK';
});
console.log('Settings:', settingsResult);
await sleep(800);
await shot('settings-modal');

// Scan settings sections
const settingsSections = await evalPage(() => {
  const modal = document.querySelector('[role="dialog"], [class*="Modal"], [class*="modal"]');
  if (!modal) return 'no modal';
  return modal.innerText?.slice(0, 800);
});
console.log('Settings content:\n', settingsSections);
await page.keyboard.press('Escape');
await sleep(400);

// ── STEP 16: EXPORT MODAL ─────────────────────────────────────────────────
console.log('\n[16] Export modal...');
const exportResult = await evalPage(() => {
  const btns = [...document.querySelectorAll('button')];
  const el = btns.find(b => b.textContent?.trim() === 'Export' || b.textContent?.includes('Export'));
  if (el) { el.click(); return 'OK: ' + el.textContent?.trim(); }
  return 'NOT_FOUND';
});
console.log('Export:', exportResult);
await sleep(800);
await shot('export-modal');
const exportText = await getText('[role="dialog"], [class*="modal"]');
console.log('Export modal content:', exportText?.slice(0,300));
await page.keyboard.press('Escape');
await sleep(400);

// ── STEP 17: RECALL TAB ───────────────────────────────────────────────────
console.log('\n[17] Recall tab full exploration...');
await clickText('Recall');
await sleep(2000);
await shot('recall-tab-landing');

const recallContent = await evalPage(() => document.body.innerText?.slice(0, 600));
console.log('Recall body text:\n', recallContent);

// Check sub-sections
const recallBtns = await evalPage(() => {
  return [...document.querySelectorAll('button, [role="tab"]')].map(b => b.textContent?.trim()).filter(Boolean).slice(0, 20);
});
console.log('Recall buttons/tabs:', recallBtns);
await shot('recall-sections');

// Try each recall section
for (const section of ['Conversations', 'Rediscover', 'Crates', 'Identity', 'Combos', 'Health']) {
  const r = await clickText(section);
  if (r !== 'NOT_FOUND') {
    await sleep(800);
    await shot(`recall-${section.toLowerCase()}`);
  }
}

// ── STEP 18: RECALL CONVERSATIONS ─────────────────────────────────────────
console.log('\n[18] Recall conversations — typing a query...');
await clickText('Conversations');
await sleep(500);
const convInput = await evalPage(() => {
  const el = document.querySelector('input[placeholder*="Ask"], input[placeholder*="ask"], textarea[placeholder*="Ask"], input[placeholder*="Search your"], textarea');
  return el ? el.placeholder : null;
});
console.log('Conversations input:', convInput);

if (convInput) {
  await click('input[placeholder*="Ask"], textarea', 'conversations input');
  await page.keyboard.type('show me my top 10 most played tracks', { delay: 40 });
  await sleep(500);
  await shot('recall-conversations-typing');
  await page.keyboard.press('Enter');
  await sleep(2000);
  await shot('recall-conversations-result');
}

// ── STEP 19: DISCOVER TAB ─────────────────────────────────────────────────
console.log('\n[19] Discover tab...');
await clickText('Discover');
await sleep(1500);
await shot('discover-tab');

const discoverBody = await evalPage(() => document.body.innerText?.slice(0, 500));
console.log('Discover body:\n', discoverBody);

const discoverBtns = await evalPage(() => {
  return [...document.querySelectorAll('button, [role="tab"]')].map(b => b.textContent?.trim()).filter(Boolean).slice(0,20);
});
console.log('Discover buttons:', discoverBtns);

// ── STEP 20: IMPORT MODAL ─────────────────────────────────────────────────
console.log('\n[20] Import modal...');
await clickText('Prepare');
await sleep(500);
const importResult = await evalPage(() => {
  const btns = [...document.querySelectorAll('button')];
  const el = btns.find(b => b.textContent?.trim() === 'Import');
  if (el) { el.click(); return 'OK'; }
  return 'NOT_FOUND';
});
console.log('Import:', importResult);
await sleep(800);
await shot('import-modal');
const importText = await getText('[role="dialog"], [class*="modal"]');
console.log('Import modal content:', importText?.slice(0, 300));
await page.keyboard.press('Escape');
await sleep(400);

// ── STEP 21: NEW SET BUTTON ───────────────────────────────────────────────
console.log('\n[21] New Set...');
// Find + button or new set button near timeline header
const newSetResult = await evalPage(() => {
  const btns = [...document.querySelectorAll('button, [role="button"]')];
  const el = btns.find(b => b.textContent?.includes('+') && (b.closest('[class*="timeline"]') || b.closest('[class*="set"]')))
          ?? btns.find(b => b.title?.toLowerCase().includes('new set') || b.getAttribute('aria-label')?.toLowerCase().includes('new set'));
  if (el) { el.click(); return 'OK: ' + (el.title || el.textContent?.trim()); }
  // Dump timeline buttons
  const t = [...document.querySelectorAll('[class*="timeline"] button')];
  return 'NOT_FOUND. Timeline btns: ' + t.map(b => `"${b.textContent?.trim()}" title="${b.title}"`).join(', ');
});
console.log('New Set:', newSetResult);
await sleep(600);
await shot('new-set-action');
await page.keyboard.press('Escape');
await sleep(400);

// ── STEP 22: KEYBOARD SHORTCUTS (⌘K) ─────────────────────────────────────
console.log('\n[22] Command palette ⌘K...');
await page.keyboard.press('Meta+k');
await sleep(800);
await shot('command-palette');
await page.keyboard.press('Escape');
await sleep(400);

// ── STEP 23: SET SAFETY INDICATOR ────────────────────────────────────────
console.log('\n[23] Set safety inspection...');
const safetyText = await evalPage(() => {
  const el = document.querySelector('[class*="safety"], [class*="Safety"]');
  return el ? el.innerText : 'NOT_FOUND';
});
console.log('Set safety text:', safetyText);

// ── STEP 24: TIMELINE ZOOM/ENERGY CURVE ──────────────────────────────────
console.log('\n[24] Timeline energy curve area...');
await shot('timeline-full');

// Click the Energy tab in timeline header
await clickText('Energy');
await sleep(500);
await shot('timeline-energy-view');

await clickText('BPM');
await sleep(500);
await shot('timeline-bpm-view');

// ── STEP 25: SUGGESTIONS PANEL ────────────────────────────────────────────
console.log('\n[25] Suggestions panel interaction...');
// Click a suggestion card
const suggResult = await evalPage(() => {
  const cards = [...document.querySelectorAll('[class*="suggestion-card"], [class*="SuggestionCard"]')];
  if (cards.length === 0) return 'no cards';
  cards[0].click();
  return 'clicked: ' + cards[0].textContent?.trim().slice(0,50);
});
console.log('Suggestion card:', suggResult);
await sleep(600);
await shot('suggestion-card-click');

// ── STEP 26: FEEDBACK MODAL ───────────────────────────────────────────────
console.log('\n[26] Feedback modal (MessageSquareHeart)...');
const feedbackResult = await evalPage(() => {
  const btns = [...document.querySelectorAll('button, [role="button"]')];
  const el = btns.find(b =>
    b.getAttribute('aria-label')?.toLowerCase().includes('feedback') ||
    b.title?.toLowerCase().includes('feedback') ||
    b.textContent?.toLowerCase().includes('feedback')
  );
  if (el) { el.click(); return 'OK: ' + (el.title || el.getAttribute('aria-label')); }
  return 'NOT_FOUND. All btn titles: ' + btns.map(b => b.title || b.getAttribute('aria-label')).filter(Boolean).join(', ');
});
console.log('Feedback btn:', feedbackResult);
await sleep(700);
await shot('feedback-modal');
await page.keyboard.press('Escape');
await sleep(400);

// ── STEP 27: USB DETECTION PANEL ─────────────────────────────────────────
console.log('\n[27] USB detection panel...');
const usbResult = await evalPage(() => {
  const btns = [...document.querySelectorAll('button, [role="button"]')];
  const el = btns.find(b =>
    b.getAttribute('aria-label')?.toLowerCase().includes('usb') ||
    b.title?.toLowerCase().includes('usb') ||
    b.textContent?.toLowerCase().includes('usb')
  );
  if (el) { el.click(); return 'OK: ' + (el.title || el.textContent?.trim()); }
  return 'NOT_FOUND. All btns: ' + btns.slice(0,8).map(b => `"${b.textContent?.trim()}" title="${b.title}"`).join(' | ');
});
console.log('USB panel:', usbResult);
await sleep(700);
await shot('usb-panel');
await page.keyboard.press('Escape');
await sleep(400);

// ── STEP 28: FINAL COMPREHENSIVE SHOT ─────────────────────────────────────
console.log('\n[28] Final states...');
await clickText('Prepare');
await sleep(800);
await clickText('Library');
await sleep(400);
await shot('final-prepare-library');

await clickText('Recall');
await sleep(800);
await shot('final-recall');

await clickText('Discover');
await sleep(800);
await shot('final-discover');

// ── COLLECT CONSOLE ERRORS ─────────────────────────────────────────────────
console.log('\n[collecting console errors]');
const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
await sleep(1000);
if (errors.length) console.log('CONSOLE ERRORS:\n', errors.join('\n'));
else console.log('No new console errors.');

console.log('\n=== Part 2 complete. Screenshots in', SHOT_DIR, '===');
await sleep(500);
await app.close();
process.exit(0);
