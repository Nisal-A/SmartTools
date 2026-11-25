import fs from 'node:fs';
import puppeteer from 'puppeteer';

/**
 * Hardened Warm Chromium Pool for Multi-Size PDF Rendering (Render 512 MB Tuned)
 *
 * Features:
 * 1. Single warm headless Chromium instance reused across PDF renders with auto-relaunch on disconnect.
 * 2. Isolated BrowserContext per render job (`createBrowserContext()`).
 * 3. Bounded concurrency queue (capped at 2 in `production` for Render 512 MB RAM, 3 in dev).
 * 4. Strict SSRF request interception: blocks all outbound network requests
 *    except `data:image/*` and whitelisted Cloudinary/self-hosted image URLs.
 * 5. Guaranteed page & context cleanup in `finally` blocks + SIGINT/SIGTERM hooks.
 */

export const RENDER_SAFE_CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',
  '--single-process',
];

function getMaxConcurrentRenders() {
  if (process.env.PDF_MAX_CONCURRENCY) {
    const parsed = Number(process.env.PDF_MAX_CONCURRENCY);
    if (Number.isInteger(parsed) && parsed >= 1) return parsed;
  }
  return process.env.NODE_ENV === 'production' ? 2 : 3;
}

const DEFAULT_ALLOWED_IMAGE_HOSTS = ['res.cloudinary.com'];

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
];

function getAllowedImageHosts() {
  const extra = (process.env.PDF_ALLOWED_IMAGE_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_IMAGE_HOSTS, ...extra]);
}

/**
 * Validates whether a page request URL is permitted during PDF rendering.
 * Blocks SSRF attempts against internal services, cloud metadata IPs, file://, etc.
 */
export function isAllowedPdfRequest(urlStr, resourceType = '') {
  if (!urlStr) return false;

  if (urlStr === 'about:blank' || urlStr.startsWith('about:')) {
    return true;
  }

  if (urlStr.startsWith('data:')) {
    return /^data:(image\/|font\/|application\/font)/i.test(urlStr);
  }

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST_PATTERNS.some((rx) => rx.test(hostname))) {
    return false;
  }

  if (resourceType && resourceType !== 'image' && resourceType !== 'font') {
    return false;
  }

  const allowedHosts = getAllowedImageHosts();
  for (const allowed of allowedHosts) {
    if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves Chromium executable path:
 * 1. `process.env.PUPPETEER_EXECUTABLE_PATH || undefined` (primary Docker/Render path)
 * 2. Bundled Puppeteer Chromium or local system Chrome/Edge fallback for local dev
 */
function resolveChromiumExecutablePath() {
  const envPath = (process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  if (envPath) {
    return envPath;
  }

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch {
    // Fall through to system browser discovery for local dev
  }

  const systemCandidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of systemCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function buildChromiumArgs() {
  // Note: On Windows desktop Chrome, `--single-process` can crash Win32 renderer threads;
  // on Linux/Docker (Render), the full low-memory flag set is used.
  const baseFlags =
    process.platform === 'win32' && process.env.NODE_ENV !== 'production'
      ? RENDER_SAFE_CHROMIUM_ARGS.filter(
          (flag) => flag !== '--single-process' && flag !== '--no-zygote'
        )
      : [...RENDER_SAFE_CHROMIUM_ARGS];

  return [
    ...baseFlags,
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
  ];
}

let browserInstance = null;
let browserLaunchPromise = null;
let activeJobs = 0;
const waitQueue = [];
let shutdownHooksRegistered = false;

function acquireSlot() {
  const maxConcurrent = getMaxConcurrentRenders();
  if (activeJobs < maxConcurrent) {
    activeJobs += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(resolve);
  });
}

function releaseSlot() {
  const maxConcurrent = getMaxConcurrentRenders();
  if (waitQueue.length > 0 && activeJobs <= maxConcurrent) {
    const nextResolve = waitQueue.shift();
    nextResolve();
  } else {
    activeJobs = Math.max(0, activeJobs - 1);
  }
}

function registerShutdownHooks() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const handleShutdown = async () => {
    await shutdownPuppeteerPool();
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
}

/**
 * Launches or returns the warm singleton Chromium browser instance.
 * Automatically clears `browserInstance` on unexpected disconnect so subsequent calls relaunch.
 */
export async function getWarmBrowser() {
  registerShutdownHooks();

  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  browserInstance = null;

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    resolveChromiumExecutablePath() ||
    undefined;

  browserLaunchPromise = puppeteer
    .launch({
      headless: true,
      executablePath,
      args: buildChromiumArgs(),
    })
    .then((browser) => {
      browserInstance = browser;
      browserLaunchPromise = null;

      browser.on('disconnected', () => {
        if (browserInstance === browser) {
          browserInstance = null;
        }
      });

      return browser;
    })
    .catch((err) => {
      browserLaunchPromise = null;
      throw err;
    });

  return browserLaunchPromise;
}

async function openIsolatedContextAndPage(browser) {
  const context =
    typeof browser.createBrowserContext === 'function'
      ? await browser.createBrowserContext()
      : await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  return { context, page };
}

/**
 * Executes a PDF rendering task inside an isolated BrowserContext and Page
 * with concurrency queuing, SSRF request interception, and automatic browser
 * relaunch if Chromium disconnected unexpectedly.
 */
export async function withIsolatedPage(taskFn) {
  await acquireSlot();

  let context = null;
  let page = null;

  try {
    let browser = await getWarmBrowser();

    try {
      ({ context, page } = await openIsolatedContextAndPage(browser));
    } catch {
      // Browser disconnected mid-flight; force relaunch once
      if (browserInstance === browser) {
        browserInstance = null;
      }
      await browser.close().catch(() => {});
      browser = await getWarmBrowser();
      ({ context, page } = await openIsolatedContextAndPage(browser));
    }

    // Enable strict SSRF request interception
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (isAllowedPdfRequest(url, resourceType)) {
        request.continue().catch(() => {});
      } else {
        request.abort('blockedbyclient').catch(() => {});
      }
    });

    return await taskFn(page);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    releaseSlot();
  }
}

export function getPuppeteerPoolStats() {
  return {
    isBrowserWarm: Boolean(browserInstance && browserInstance.connected),
    activeJobs,
    queuedJobs: waitQueue.length,
    maxConcurrency: getMaxConcurrentRenders(),
  };
}

export async function shutdownPuppeteerPool() {
  const currentBrowser = browserInstance;
  browserInstance = null;
  browserLaunchPromise = null;

  if (currentBrowser) {
    await currentBrowser.close().catch(() => {});
  }
}
