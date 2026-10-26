import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Worker,
  type Page,
} from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let context: BrowserContext, worker: Worker, server: Server, profile: string;
let chatCount = 0,
  tagsCount = 0,
  cancelledCount = 0;
let behavior: 'normal' | 'slow' | 'error' | 'offline' | 'empty' | 'broken' = 'normal';
let unsafeOutput = false;
const prompts: Record<string, unknown>[] = [];
const fixture = (native = true, dark = false) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Search fixture</title><style>body{margin:0;background:${dark ? '#202124' : '#fff'};color:${dark ? '#e8eaed' : '#202124'};font:14px Arial}header{height:90px;border-bottom:1px solid #8883;padding:25px 32px;box-sizing:border-box}input{margin-left:45px;padding:13px 25px;border:1px solid #8885;border-radius:30px;width:560px;background:transparent;color:inherit}main{margin:30px 30px 50px 180px;max-width:700px}a{color:${dark ? '#b5a4ff' : '#4030aa'};text-decoration:none}h3{font-size:20px;font-weight:400;margin:8px 0}article{margin:25px 0;line-height:1.65}h2{font-size:19px}</style></head><body><header><strong>Search fixture</strong><input aria-label="Search" name="q" value="why is the sky blue"></header><main id="search">${native ? '<section data-ai-overview="true" style="display: grid"><h2>AI Overview</h2><p>Representative native overview. Google’s original answer and controls remain available alongside Local Overview.</p><button onclick="this.textContent=\'Expanded native overview\'">Show more</button></section>' : ''}<div id="rso"><article><a href="https://science.nasa.gov/earth/why-is-the-sky-blue/"><h3>Why is the sky blue? — NASA Science</h3></a><p>Air molecules scatter shorter wavelengths of sunlight more strongly. Blue light is scattered in all directions.</p></article><article><a href="https://www.noaa.gov/jetstream/atmosphere/blue-sky"><h3>Sunlight and our atmosphere — NOAA</h3></a><p>Light is scattered by gases and particles in the atmosphere. The sky changes color with the Sun’s angle.</p></article></div></main></body></html>`;
async function configure(patch: Record<string, unknown>) {
  await worker.evaluate(async (value) => {
    await chrome.storage.local.set(value);
  }, patch);
}
async function search(native = true, dark = false): Promise<Page> {
  const page = await context.newPage();
  await page.route('https://www.google.com/search*', (route) =>
    route.fulfill({ contentType: 'text/html', body: fixture(native, dark) }),
  );
  await page.goto('https://www.google.com/search?q=why+is+the+sky+blue');
  await expect(page.locator('#local-overview-root')).toBeVisible();
  return page;
}
test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.end();
      return;
    }
    if (behavior === 'offline') {
      res.destroy();
      return;
    }
    if (req.url === '/api/tags') {
      tagsCount++;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          models:
            behavior === 'empty'
              ? []
              : [
                  { name: 'llama-local:3b' },
                  { name: 'qwen-local:4b' },
                  {
                    name: 'cloud-example',
                    remote_host: 'https://ollama.com',
                    remote_model: 'example',
                  },
                ],
        }),
      );
      return;
    }
    if (req.url !== '/api/chat') {
      res.writeHead(404);
      res.end();
      return;
    }
    let body = '';
    req.on('data', (part) => {
      body += part.toString();
    });
    req.on('end', () => {
      chatCount++;
      const data = JSON.parse(body);
      prompts.push(data);
      if (behavior === 'error') {
        res.writeHead(500);
        res.end('{}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.flushHeaders();
      let finished = false;
      const begin =
        JSON.stringify({
          message: { content: 'The sky appears blue because air scatters sunlight. ☀ ' },
          done: false,
        }) + '\n';
      const bytes = Buffer.from(begin);
      const split = bytes.indexOf(Buffer.from('☀')) + 1;
      res.write(bytes.subarray(0, split));
      const first = setTimeout(() => res.write(bytes.subarray(split)), 60);
      const selectedBehavior = behavior;
      const timer = setTimeout(
        () => {
          if (selectedBehavior === 'broken') {
            res.end();
            return;
          }
          const final = {
            model: data.model,
            message: {
              content: `Shorter blue wavelengths scatter more strongly [1].\n\n${unsafeOutput ? '<img src=x onerror=alert(1)> [999]' : 'This is called Rayleigh scattering. Near sunset, sunlight passes through more atmosphere, leaving more of the warmer colors.'}`,
            },
            done: true,
            eval_count: 48,
            eval_duration: 2_000_000_000,
            total_duration: 3_000_000_000,
            prompt_eval_duration: 400_000_000,
          };
          finished = true;
          res.end(JSON.stringify(final) + '\n');
        },
        behavior === 'slow' ? 15_000 : 750,
      );
      res.on('close', () => {
        clearTimeout(timer);
        clearTimeout(first);
        if (!finished) cancelledCount++;
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No mock address');
  profile = await mkdtemp(path.join(tmpdir(), 'local-overview-test-'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1320, height: 1000 },
    args: [
      `--disable-extensions-except=${path.resolve('dist')}`,
      `--load-extension=${path.resolve('dist')}`,
    ],
  });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await configure({ endpoint: `http://127.0.0.1:${address.port}` });
});
test.beforeEach(async () => {
  behavior = 'normal';
  unsafeOutput = false;
  chatCount = 0;
  tagsCount = 0;
  prompts.length = 0;
  await configure({
    enabled: true,
    model: '',
    autoGenerate: false,
    stream: true,
    grounding: false,
    interactionOnly: false,
    autoRegenerate: true,
    theme: 'auto',
    showStats: true,
  });
});
test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus)
    for (const page of context.pages())
      console.log(
        'Failed UI state:',
        await page.locator('#local-overview-root').evaluateAll((nodes) =>
          nodes.map((node) => ({
            status: node.shadowRoot?.querySelector('.status')?.textContent,
            notice: node.shadowRoot?.querySelector('.notice')?.textContent,
          })),
        ),
      );
  for (const page of context.pages()) await page.close();
});
test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (profile && path.resolve(profile).startsWith(path.resolve(tmpdir(), 'local-overview-test-')))
    await rm(profile, { recursive: true, force: true });
});

test('real MV3 transport streams, switches models, cites sources, and leaves Google controls untouched', async () => {
  const page = await search();
  const host = page.locator('#local-overview-root'),
    native = page.locator('[data-ai-overview]');
  const originalHTML = await native.evaluate((el) => el.outerHTML);
  await expect(native).toBeVisible();
  await expect(host.locator('[data-mode]')).toHaveCount(0);
  await expect(host).not.toContainText('On your device');
  await page.waitForTimeout(250);
  expect(chatCount).toBe(0);
  await configure({ grounding: true });
  unsafeOutput = true;
  await host.locator('.generate').click();
  await expect(host.locator('.answer')).toContainText('☀');
  await expect(host.getByRole('button', { name: 'Stop generating' })).toBeVisible();
  await expect(host.getByRole('button', { name: '↻ Regenerate' })).toBeVisible();
  await expect(host.locator('.answer a')).toHaveAttribute(
    'href',
    'https://science.nasa.gov/earth/why-is-the-sky-blue/',
  );
  await expect(host.locator('.answer img')).toHaveCount(0);
  await expect(host.locator('.answer')).not.toContainText('[999]');
  await expect(host.getByLabel('Ollama model').locator('option')).toHaveCount(2);
  unsafeOutput = false;
  await host.getByLabel('Ollama model').selectOption('qwen-local:4b');
  await expect(host.locator('.answer')).toHaveText('');
  await host.locator('.generate').click();
  await expect.poll(() => chatCount).toBe(2);
  await expect(host.getByRole('button', { name: '↻ Regenerate' })).toBeVisible();
  expect(prompts[1].model).toBe('qwen-local:4b');
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.screenshot({
    path: 'artifacts/screenshots/google-local.png',
    fullPage: true,
    animations: 'disabled',
  });
  await expect(native).toBeVisible();
  expect(await native.evaluate((el) => el.outerHTML)).toBe(originalHTML);
  await native.getByRole('button').click();
  await expect(native.getByRole('button')).toHaveText('Expanded native overview');
  expect(chatCount).toBe(2);
});

test('missing/delayed native overview, dark theme, duplicate prevention and disable', async () => {
  const page = await search(false, true);
  const host = page.locator('#local-overview-root');
  await expect(host).toHaveAttribute('data-theme', 'dark');
  await host.locator('.generate').click();
  await expect(host.getByRole('button', { name: '↻ Regenerate' })).toBeVisible();
  await page.evaluate(() => {
    const native = document.createElement('section');
    native.dataset.aiOverview = 'true';
    native.textContent = 'Delayed native AI Overview';
    document.querySelector('#search')!.append(native);
  });
  await expect(page.locator('[data-ai-overview]')).toBeVisible();
  for (let i = 0; i < 12; i++)
    await page.evaluate(() =>
      document.querySelector('#rso')!.append(document.createElement('span')),
    );
  await page.waitForTimeout(500);
  await expect(host).toHaveCount(1);
  await mkdir('artifacts/screenshots', { recursive: true });
  await page.screenshot({
    path: 'artifacts/screenshots/google-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
  await configure({ enabled: false });
  await expect(host).toHaveCount(0);
  await expect(page.locator('[data-ai-overview]')).toBeVisible();
  await expect(page.locator('#rso h3')).toHaveCount(2);
});

test('Stop cancels the actual request; navigation rejects stale chunks and keeps one interface', async () => {
  behavior = 'slow';
  await configure({ autoGenerate: true });
  const page = await search();
  const host = page.locator('#local-overview-root');
  await expect(host.locator('.answer')).toContainText('sky appears');
  const previous = cancelledCount;
  await host.getByRole('button', { name: 'Stop generating' }).click();
  await expect.poll(() => cancelledCount).toBeGreaterThan(previous);
  await expect(host.locator('.notice')).toContainText('stopped');
  await host.getByRole('button', { name: '↻ Regenerate' }).click();
  await expect.poll(() => chatCount).toBe(2);
  await page.evaluate(() => history.pushState({}, '', '/search?q=a+new+question'));
  await expect(host.locator('.answer')).not.toContainText('sky appears');
  await expect.poll(() => chatCount).toBe(3);
  for (const query of ['second', 'third', 'fourth']) {
    await page.evaluate((q) => {
      history.pushState({}, '', `/search?q=${q}`);
      document.querySelector('#rso')!.append(document.createElement('i'));
    }, query);
    await page.waitForTimeout(250);
  }
  await expect(host).toHaveCount(1);
  await expect(page.locator('[data-ai-overview]')).toBeVisible();
  await configure({ enabled: false });
  await expect(host).toHaveCount(0);
});

test('offline, empty models, model errors, and interrupted streams recover with Retry', async () => {
  const page = await search();
  const host = page.locator('#local-overview-root');
  behavior = 'offline';
  await host.locator('.generate').click();
  await expect(host.locator('.notice')).toContainText(/offline|running|Start Ollama/i);
  behavior = 'empty';
  await host.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(host.locator('.notice')).toContainText('No local models');
  behavior = 'error';
  await host.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(host.locator('.notice')).toContainText('HTTP 500');
  behavior = 'broken';
  await host.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(host.locator('.notice')).toContainText('interrupted');
  behavior = 'normal';
  await host.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(host.getByRole('button', { name: '↻ Regenerate' })).toBeVisible();
  expect(JSON.stringify(prompts.at(-1))).not.toContain('NASA');
});

test('actual extension popup and options save settings, restrict endpoints, and expose no provider selector', async () => {
  const base = worker.url().replace(/\/background\.js$/, '');
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 354, height: 600 });
  await popup.goto(`${base}/popup.html`);
  await expect(popup.locator('body')).toContainText('Local Overview');
  await expect(popup.locator('body')).toContainText('llama-local');
  await expect(popup.locator('#enabled')).toBeChecked();
  await expect(popup.locator('[data-mode], #mode, #preferredMode, #rememberMode')).toHaveCount(0);
  await popup.locator('#model').selectOption('qwen-local:4b');
  await expect(popup.locator('#save-status')).toContainText('Saved');
  await mkdir('artifacts/screenshots', { recursive: true });
  await popup.locator('body').screenshot({
    path: 'artifacts/screenshots/popup.png',
    animations: 'disabled',
  });
  const options = await context.newPage();
  await options.goto(`${base}/options.html`);
  await expect(options.locator('#model option')).toHaveCount(3);
  await expect(options.locator('#mode, #preferredMode, #rememberMode')).toHaveCount(0);
  await options.screenshot({
    path: 'artifacts/screenshots/options.png',
    fullPage: true,
    animations: 'disabled',
  });
  await options.locator('#endpoint').fill('https://example.com');
  await options.locator('#connect').click();
  await expect(options.locator('#save-status')).toContainText('loopback');
  await options.locator('#theme').selectOption('dark');
  await expect(options.locator('html')).toHaveAttribute('data-theme', 'dark');
  await options.setViewportSize({ width: 380, height: 900 });
  expect(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
});
