// Drives the real app UI on two emulated phones against CKB public testnet.
//
//   npm run public:build:e2e && CHROME_PATH=/path/to/chrome npm run test:browser
//
// Phone A (Pixel 5) is the owner, phone B (iPhone 13) is the workshop. Each page gets a
// throwaway key from .deploy/testnet-keys.json in place of the JoyID popup, which the
// e2e build accepts and the production build ignores. Screenshots go to SHOTS_DIR.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import puppeteer, { KnownDevices } from 'puppeteer-core';
import { ClientPublicTestnet, SignerCkbPrivateKey } from '@ckb-ccc/core';

const root = new URL('../', import.meta.url).pathname;
const dist = join(root, 'public-web/dist-e2e');
const shots = process.env.SHOTS_DIR ?? join(root, '.deploy/browser-e2e');
const keys = JSON.parse(readFileSync(join(root, '.deploy/testnet-keys.json'), 'utf8'));
if (!existsSync(join(dist, 'index.html'))) throw new Error('Run `npm run public:build:e2e` first.');
mkdirSync(shots, { recursive: true });
const workshopCkt = await new SignerCkbPrivateKey(new ClientPublicTestnet({ url: 'https://testnet.ckb.dev/' }), keys.workshop).getRecommendedAddress();

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = existsSync(path) && !path.endsWith('/') ? path : join(dist, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(4190, '127.0.0.1');
const base = 'http://127.0.0.1:4190/';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-gpu'] });
let step = 0;
async function phone(device, key) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.emulate(KnownDevices[device]);
  await page.evaluateOnNewDocument((k) => { window.__LP_TEST_KEY = k; }, key);
  page.on('pageerror', (error) => console.log(`  [${device}] page error: ${error.message}`));
  return page;
}
async function snap(page, name) {
  step += 1;
  await page.screenshot({ path: join(shots, `${String(step).padStart(2, '0')}-${name}.png`), fullPage: true });
}
async function clickText(page, selector, text) {
  const handle = await page.waitForFunction((sel, t) => [...document.querySelectorAll(sel)].find((el) => el.textContent.includes(t) && !el.disabled), { timeout: 30000 }, selector, text);
  await handle.asElement().click();
}
async function type(page, label, value) {
  const handle = await page.waitForFunction((l) => [...document.querySelectorAll('label.field')].find((el) => el.textContent.includes(l))?.querySelector('input,textarea'), {}, label);
  await handle.asElement().type(value);
}
async function waitNotice(page, text, timeout = 240000) {
  const handle = await page.waitForFunction((t) => {
    const error = document.querySelector('.notice-error');
    if (error) return `ERROR: ${error.textContent}`;
    return [...document.querySelectorAll('.notice')].some((n) => n.textContent.includes(t)) && 'ok';
  }, { timeout, polling: 1000 }, text);
  const result = await handle.jsonValue();
  if (result !== 'ok') throw new Error(result);
}
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

try {
  const owner = await phone('Pixel 5', keys.owner);
  const workshop = await phone('iPhone 13', keys.workshop);
  console.log(`[${elapsed()}] owner phone: create passport`);
  await owner.goto(base);
  await owner.waitForSelector('.wallet-btn code');
  await snap(owner, 'owner-home');
  await clickText(owner, 'button', 'Create a passport');
  await type(owner, 'Laptop model', 'HP EliteBook 840 G5 (browser test)');
  await type(owner, 'Owner label', 'Test owner');
  await type(owner, 'Workshop testnet address', workshopCkt);
  await snap(owner, 'owner-create-form');
  await clickText(owner, 'button', 'Review passport');
  await owner.waitForSelector('.sheet');
  await snap(owner, 'owner-create-confirm');
  await clickText(owner, '.sheet button', 'Continue to wallet');
  await waitNotice(owner, 'Passport created.');
  const passportUrl = owner.url();
  await snap(owner, 'owner-passport-created');
  console.log(`[${elapsed()}]   created ${passportUrl.split('passport=')[1].slice(0, 20)}…`);

  console.log(`[${elapsed()}] workshop phone: draft repair`);
  await workshop.goto(passportUrl);
  await workshop.waitForFunction(() => document.querySelector('.actions-card h2')?.textContent === 'Record a repair', { timeout: 60000 });
  await type(workshop, 'What was done', 'Replaced hinge and cleaned keyboard (browser test)');
  await snap(workshop, 'workshop-repair-form');
  await clickText(workshop, 'button', 'Sign draft');
  await workshop.waitForSelector('.link-field', { timeout: 120000 });
  const link = await workshop.$eval('.link-field', (el) => el.value);
  await snap(workshop, 'workshop-link-ready');
  console.log(`[${elapsed()}]   link ${link.length} chars`);

  console.log(`[${elapsed()}] owner phone: review and approve`);
  await owner.goto('about:blank');
  await owner.goto(link);
  await owner.waitForSelector('.repair-note', { timeout: 60000 });
  const note = await owner.$eval('.repair-note', (el) => el.textContent);
  if (!note.includes('Replaced hinge')) throw new Error(`Approval page shows the wrong note: ${note}`);
  await snap(owner, 'owner-approval');
  await clickText(owner, 'button', 'Approve and sign');
  await waitNotice(owner, 'Repair added to the passport.');
  const events = await owner.$$eval('.timeline .event', (els) => els.map((e) => e.querySelector('strong').textContent));
  await snap(owner, 'owner-history-after-repair');
  console.log(`[${elapsed()}]   history: ${events.join(' <- ')}`);
  if (events.length !== 2 || events[0] !== 'Repair recorded') throw new Error('Repair did not appear in the history.');

  console.log(`[${elapsed()}] owner phone: close passport`);
  await clickText(owner, 'button', 'Close passport');
  await owner.waitForSelector('.sheet');
  await clickText(owner, '.sheet button', 'Close passport');
  await waitNotice(owner, 'Passport closed');
  await snap(owner, 'owner-closed');
  console.log(`[${elapsed()}] PASS`);
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
