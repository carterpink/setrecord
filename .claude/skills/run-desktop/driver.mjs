// SetRecord Electron REPL driver — macOS / agent use
import { _electron as electron } from 'playwright-core';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '../../..');
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');

let app = null;
let page = null;

async function getPage() {
  if (!app) return null;
  // Find the renderer page (not devtools)
  const wins = app.windows();
  return wins.find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow();
}

const COMMANDS = {
  async launch() {
    if (app) return console.log('already launched');
    console.log('launching SetRecord...');
    app = await electron.launch({
      executablePath: electronBin,
      args: [APP_DIR],
      env: { ...process.env },
      timeout: 30_000,
    });
    await new Promise(r => setTimeout(r, 5_000));
    page = await getPage();
    if (page) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await new Promise(r => setTimeout(r, 3_000));
    }
    console.log('launched.', app.windows().length, 'window(s)');
    for (const w of app.windows()) console.log(' ', w.url());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f, fullPage: false });
    console.log('screenshot:', f);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('click', sel, '→', r);
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(t => {
      const all = [...document.querySelectorAll('button, a, [role="button"], [role="tab"], li, span')];
      const el = all.find(e => e.textContent?.trim() === t)
              ?? all.find(e => e.textContent?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName + ' "' + el.textContent?.trim().slice(0, 40) + '"';
    }, text);
    console.log('click-text', JSON.stringify(text), '→', r);
  },

  async fill(args) {
    if (!page) return console.log('ERROR: launch first');
    const [sel, ...rest] = args.split(' ');
    const val = rest.join(' ');
    const r = await page.evaluate(([s, v]) => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                  || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'OK';
    }, [sel, val]);
    console.log('fill', sel, '→', r);
  },

  async type(text) { if (page) { await page.keyboard.type(text, { delay: 30 }); console.log('typed:', text); } },
  async press(key) { if (page) { await page.keyboard.press(key); console.log('pressed:', key); } },

  async wait(args) {
    if (!page) return console.log('ERROR: launch first');
    const [sel, msStr] = args.split(' ');
    const ms = msStr ? parseInt(msStr) : 10_000;
    try { await page.waitForSelector(sel, { timeout: ms }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async sleep(ms) { await new Promise(r => setTimeout(r, parseInt(ms) || 1000)); console.log('slept', ms, 'ms'); },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText?.slice(0, 2000) ?? '(null)',
      sel || null));
  },

  async html(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerHTML?.slice(0, 2000) ?? '(null)',
      sel || null));
  },

  async windows() {
    if (!app) return console.log('ERROR: launch first');
    for (const w of app.windows()) console.log(' ', w.url());
    try {
      const wcs = await app.evaluate(({ webContents }) =>
        webContents.getAllWebContents().map(w => ({ id: w.id, type: w.getType(), url: w.getURL() })));
      console.log('webContents:');
      for (const w of wcs) console.log(` [${w.id}] ${w.type}: ${w.url}`);
    } catch (e) { console.log('evaluate error:', e.message); }
  },

  async reload() { if (page) { await page.reload(); await new Promise(r => setTimeout(r, 2000)); console.log('reloaded'); } },

  async focus(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.focus(); return 'OK';
    }, sel);
    console.log('focus', sel, '→', r);
  },

  async scroll(args) {
    if (!page) return console.log('ERROR: launch first');
    const [sel, dir] = args.split(' ');
    const r = await page.evaluate(([s, d]) => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.scrollBy(0, d === 'up' ? -300 : 300);
      return 'OK';
    }, [sel, dir]);
    console.log('scroll', args, '→', r);
  },

  async count(sel) {
    if (!page) return console.log('ERROR: launch first');
    const n = await page.evaluate(s => document.querySelectorAll(s).length, sel);
    console.log(sel, '→', n, 'elements');
  },

  async quit() {
    if (app) await app.close().catch(() => {});
    app = null; page = null;
    console.log('closed');
  },

  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async line => {
  const trimmed = line.trim();
  if (!trimmed) return rl.prompt();
  const spaceIdx = trimmed.indexOf(' ');
  const cmd = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); return rl.prompt(); }
  try { await fn(rest); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('SetRecord driver — "help" for commands, "launch" to start');
rl.prompt();
