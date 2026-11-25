import fs from 'node:fs';
import puppeteer from 'puppeteer';

/**
 * Hardened Warm Chromium Pool for Multi-Size PDF Rendering
 *
 * Features:
 * 1. Single warm headless Chromium instance reused across PDF renders.
 * 2. Isolated BrowserContext per render job (`createBrowserContext()`).
 * 3. Bounded concurrency queue (max 3 concurrent renders).
 * 4. Strict SSRF request interception: blocks all outbound network requests
 *    except `data:image/*` and whitelisted Cloudinary/self-hosted image URLs.
 * 5. Guaranteed page & context cleanup in `finally` blocks + SIGINT/SIGTERM hooks.
 */

const MAX_CONCURRENT_RENDERS = Number(process.env.PDF_MAX_CONCURRENCY) || 3;

const DEFAULT_ALLOWED_IMAGE_HOSTS = [
  'res.cloudinary.com',
];

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
 *
 * @param {string} urlStr
 * @param {string} [resourceType]
 * @returns {boolean}
 */
export function isAllowedPdfRequest(urlStr, resourceType = 'image') {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();

  // Allow Chromium's internal blank document / inline HTML document load for page.setContent()
  if (trimmed === 'about:blank' || trimmed.startsWith('data:text/html')) {
    return resourceType === 'document' || !resourceType;
  }

  // Allow inline base64 data:image/* logos (used by Guest Mode local logos)
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(trimmed)) {
    return true;
  }

  // Only image sub-resources may be fetched over HTTP/HTTPS from whitelisted hosts
  if (resourceType && resourceType !== 'image') {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Explicitly block loopback, link-local, metadata, and RFC1918 private addresses
    if (PRIVATE_HOST_PATTERNS.some((regex) => regex.test(hostname))) {
      return false;
    }

    const allowedHosts = getAllowedImageHosts();
    return allowedHosts.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Resolves a working Chrome/Chromium executable path across environments.
 */
function resolveChromiumExecutablePath() {
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch {
    // Fall through to system browser discovery
  }

  const systemCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of systemCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

let browserInstance = null;
let browserLaunchPromise = null;
let activeJobs = 0;
const waitQueue = [];
let shutdownHooksRegistered = false;

function acquireSlot() {
  if (activeJobs < MAX_CONCURRENT_RENDERS) {
    activeJobs += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(resolve);
  });
}

function releaseSlot() {
  if (waitQueue.length > 0) {
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
 */
export async function getWarmBrowser() {
  registerShutdownHooks();

  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  const executablePath = resolveChromiumExecutablePath();

  browserLaunchPromise = puppeteer
    .launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
      ],
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

/**
 * Executes a PDF rendering task inside an isolated BrowserContext and Page
 * with concurrency queuing and SSRF request interception enabled.
 *
 * @template T
 * @param {(page: import('puppeteer').Page) => Promise<T>} taskFn
 * @returns {Promise<T>}
 */
export async function withIsolatedPage(taskFn) {
  await acquireSlot();

  let context = null;
  let page = null;

  try {
    const browser = await getWarmBrowser();

    context =
      typeof browser.createBrowserContext === 'function'
        ? await browser.createBrowserContext()
        : await browser.createIncognitoBrowserContext();

    page = await context.newPage();

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

/**
 * Returns pool telemetry for health checks and diagnostics.
 */
export function getPuppeteerPoolStats() {
  return {
    isBrowserWarm: Boolean(browserInstance && browserInstance.connected),
    activeJobs,
    queuedJobs: waitQueue.length,
    maxConcurrency: MAX_CONCURRENT_RENDERS,
  };
}

/**
 * Cleanly closes the warm Chromium instance.
 */
export async function shutdownPuppeteerPool() {
  const currentBrowser = browserInstance;
  browserInstance = null;
  browserLaunchPromise = null;

  if (currentBrowser) {
    await currentBrowser.close().catch(() => {});
  }
}
